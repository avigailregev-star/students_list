import { describe, expect, test, vi, beforeEach } from 'vitest'

type Row = Record<string, any>

function createFakeSupabase(tables: Record<string, Row[]>) {
  function from(table: string) {
    const rows = tables[table] ?? (tables[table] = [])
    const filters: [string, any][] = []
    const inclusionFilters: [string, unknown[]][] = []
    let pendingUpsert: Row | null = null
    let upsertConflictKeys: string[] | null = null

    const applyFilters = (list: Row[]) => list.filter((r) => filters.every(([k, v]) => r[k] === v) && inclusionFilters.every(([k, values]) => values.includes(r[k])))

    const builder: any = {
      select() { return builder },
      in(col: string, values: unknown[]) { inclusionFilters.push([col, values]); return builder },
      then(resolve: (value: unknown) => void) { resolve({ data: applyFilters(rows), error: null }) },
      eq(col: string, val: any) { filters.push([col, val]); return builder },
      order() { return builder },
      limit() { return builder },
      upsert(obj: Row, opts?: { onConflict?: string }) {
        pendingUpsert = obj
        upsertConflictKeys = opts?.onConflict ? opts.onConflict.split(',') : null
        return builder
      },
      async maybeSingle() {
        const matched = applyFilters(rows)
        return { data: matched[0] ?? null, error: null }
      },
      async single() {
        if (pendingUpsert) {
          if (upsertConflictKeys) {
            const existing = rows.find((r) => upsertConflictKeys!.every((k) => r[k] === pendingUpsert![k]))
            if (existing) {
              Object.assign(existing, pendingUpsert)
              return { data: existing, error: null }
            }
          }
          const inserted = { id: `generated-${rows.length + 1}`, ...pendingUpsert }
          rows.push(inserted)
          return { data: inserted, error: null }
        }
        const matched = applyFilters(rows)
        if (matched.length === 0) return { data: null, error: { message: 'not found' } }
        return { data: matched[0], error: null }
      },
    }
    return builder
  }
  return { from }
}

const tables: Record<string, Row[]> = {}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => createFakeSupabase(tables),
}))

import { getOrCreateLesson, shouldDisplayAsHoliday } from '@/lib/queries/attendance'

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  tables.lessons = []
  tables.attendance = []
})

describe('getOrCreateLesson', () => {
  test('creates a new lesson with the given holiday status when none exists yet', async () => {
    const lesson = await getOrCreateLesson('group-1', '2026-09-10', '10:00:00', true, 'ראש השנה')

    expect(lesson.is_holiday).toBe(true)
    expect(lesson.holiday_name).toBe('ראש השנה')
  })

  test('updates the holiday status of an existing lesson that has no recorded attendance', async () => {
    tables.lessons.push({ id: 'lesson-1', group_id: 'group-1', date: '2026-09-10', start_time: '10:00:00', is_makeup: false, is_holiday: false, holiday_name: null })

    const lesson = await getOrCreateLesson('group-1', '2026-09-10', '10:00:00', true, 'חג לא צפוי')

    expect(lesson.is_holiday).toBe(true)
    expect(lesson.holiday_name).toBe('חג לא צפוי')
  })

  test('keeps an existing lesson non-holiday when it already has recorded attendance, even if a holiday is added later', async () => {
    tables.lessons.push({ id: 'lesson-1', group_id: 'group-1', date: '2026-09-10', start_time: '10:00:00', is_makeup: false, is_holiday: false, holiday_name: null })
    tables.attendance.push({ id: 'att-1', lesson_id: 'lesson-1', student_id: 'student-1', status: 'present' })

    const lesson = await getOrCreateLesson('group-1', '2026-09-10', '10:00:00', true, 'חג שנוסף בדיעבד')

    expect(lesson.is_holiday).toBe(false)
    expect(lesson.holiday_name).toBe(null)
  })

  test('reuses the same lesson and attendance when its scheduled hour changes on the same day', async () => {
    tables.lessons.push({ id: 'lesson-1', group_id: 'group-1', date: '2026-09-10', start_time: '10:00:00', is_makeup: false, is_holiday: false })
    tables.attendance.push({ id: 'att-1', lesson_id: 'lesson-1', student_id: 'student-1', status: 'present' })

    const lesson = await getOrCreateLesson('group-1', '2026-09-10', '11:00:00', false)

    expect(lesson.id).toBe('lesson-1')
    expect(tables.lessons).toHaveLength(1)
    expect(tables.attendance[0].status).toBe('present')
  })
})

describe('shouldDisplayAsHoliday', () => {
  test('is a holiday when the date is a holiday and nothing was ever taught', () => {
    expect(shouldDisplayAsHoliday(true, 0)).toBe(true)
  })

  test('is not a holiday when the date is not a holiday', () => {
    expect(shouldDisplayAsHoliday(false, 0)).toBe(false)
  })

  test('stops being treated as a holiday once real attendance was recorded', () => {
    expect(shouldDisplayAsHoliday(true, 1)).toBe(false)
  })
})

test('QA: regular lesson must not shadow a separate makeup later on the same date', async () => {
  tables.lessons.push(
    { id: 'regular-1', group_id: 'group-1', date: '2026-09-10', start_time: '10:00:00', is_makeup: false },
    { id: 'makeup-1', group_id: 'group-1', date: '2026-09-10', start_time: '16:00:00', is_makeup: true },
  )
  const lesson = await getOrCreateLesson('group-1', '2026-09-10', '16:00:00', false)
  expect(lesson.id).toBe('makeup-1')
})

test('QA: two regular schedules on the same weekday must retain separate attendance', async () => {
  tables.group_schedules = [{ group_id: 'group-1', day_of_week: 4, start_time: '10:00:00' }, { group_id: 'group-1', day_of_week: 4, start_time: '16:00:00' }]
  tables.lessons.push({ id: 'regular-1', group_id: 'group-1', date: '2026-09-10', start_time: '10:00:00', is_makeup: false })
  const lesson = await getOrCreateLesson('group-1', '2026-09-10', '16:00:00', false)
  expect(lesson.id).not.toBe('regular-1')
})

 test('QA: a makeup stored as HH:MM is found from a HH:MM:SS link', async () => {
   tables.lessons.push({ id: 'makeup-short', group_id: 'group-1', date: '2026-09-10', start_time: '16:00', is_makeup: true })
   expect((await getOrCreateLesson('group-1', '2026-09-10', '16:00:00', false)).id).toBe('makeup-short')
 })
