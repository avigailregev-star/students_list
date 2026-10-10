import { describe, expect, test, vi, beforeEach } from 'vitest'

type Row = Record<string, any>

function createFakeSupabase(tables: Record<string, Row[]>) {
  function from(table: string) {
    const rows = tables[table] ?? (tables[table] = [])
    const filters: ((row: Row) => boolean)[] = []
    let pendingUpdate: Row | null = null
    let pendingInsert: Row | null = null
    let isDelete = false
    let rowLimit = Infinity

    const applyFilters = (list: Row[]) => list.filter((row) => filters.every((filter) => filter(row)))

    const builder: any = {
      select() { return builder },
      limit(value: number) { rowLimit = value; return builder },
      async maybeSingle() {
        const matched = applyFilters(rows).slice(0, rowLimit)
        return matched.length > 1 ? { data: null, error: { message: 'multiple rows' } } : { data: matched[0] ?? null, error: null }
      },
      eq(col: string, val: any) { filters.push((row) => row[col] === val); return builder },
      gte(col: string, val: any) { filters.push((row) => row[col] >= val); return builder },
      lte(col: string, val: any) { filters.push((row) => row[col] <= val); return builder },
      in(col: string, values: any[]) { filters.push((row) => values.includes(row[col])); return builder },
      update(obj: Row) { pendingUpdate = obj; return builder },
      insert(obj: Row) {
        pendingInsert = { id: obj.id ?? `generated-${rows.length + 1}`, ...obj }
        rows.push(pendingInsert)
        return builder
      },
      delete() { isDelete = true; return builder },
      async single() {
        if (pendingInsert) return { data: pendingInsert, error: null }
        const matched = applyFilters(rows)
        if (matched.length === 0) return { data: null, error: { message: 'not found' } }
        return { data: matched[0], error: null }
      },
      then(resolve: (v: { data: Row[]; count: number; error: null }) => void) {
        if (pendingUpdate) {
          for (const r of applyFilters(rows)) Object.assign(r, pendingUpdate)
        }
        if (isDelete) {
          for (const r of applyFilters(rows)) {
            const idx = rows.indexOf(r)
            if (idx >= 0) rows.splice(idx, 1)
          }
        }
        const matched = applyFilters(rows).slice(0, rowLimit)
        resolve({ data: matched, count: matched.length, error: null })
      },
    }
    return builder
  }
  return { from, auth: { getUser: async () => ({ data: { user: { id: 'teacher-1' } } }) } }
}

const tables: Record<string, Row[]> = {}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => createFakeSupabase(tables),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => createFakeSupabase(tables),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/googleCalendar', () => ({
  deleteGCalEvent: vi.fn(async () => {}),
  pushLesson: vi.fn(async () => null),
}))

import { cancelLesson, restoreLesson } from './lessonActions'
import { ADVANCE_NOTICE_REASON } from '@/lib/attendance/advanceNotice'

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  tables.groups = [{ id: 'group-1', teacher_id: 'teacher-1' }]
  tables.lessons = [
    { id: 'original-1', group_id: 'group-1', status: 'teacher_canceled', makeup_lesson_id: 'makeup-1' },
    { id: 'makeup-1', group_id: 'group-1', status: 'scheduled', is_makeup: true },
  ]
  tables.attendance = []
})

describe('cancelLesson justified-cancellation quota', () => {
  function cancellationForm(lessonId: string) {
    const form = new FormData()
    form.set('lesson_id', lessonId)
    form.set('reason', ADVANCE_NOTICE_REASON)
    form.set('notes', '2026-11-01')
    form.set('makeup_start_time', '15:00')
    form.set('is_sick_leave', 'false')
    return form
  }

  beforeEach(() => {
    tables.groups.push({ id: 'group-2', teacher_id: 'teacher-1' })
    tables.lessons = [
      { id: 'target-1', group_id: 'group-1', date: '2026-10-20', status: 'scheduled' },
      { id: 'other-pupil-1', group_id: 'group-2', date: '2026-09-10', status: 'teacher_canceled', teacher_absence_reason: ADVANCE_NOTICE_REASON },
      { id: 'other-pupil-2', group_id: 'group-2', date: '2026-09-17', status: 'teacher_canceled', teacher_absence_reason: ADVANCE_NOTICE_REASON },
    ]
  })

  test('does not pool cancellations from a different pupil group', async () => {
    await cancelLesson(cancellationForm('target-1'))

    expect(tables.lessons.find((lesson) => lesson.id === 'target-1')?.status).toBe('teacher_canceled')
  })

  test('blocks a third cancellation for the same pupil group', async () => {
    tables.lessons.push(
      { id: 'same-pupil-1', group_id: 'group-1', date: '2026-09-10', status: 'teacher_canceled', teacher_absence_reason: ADVANCE_NOTICE_REASON },
      { id: 'same-pupil-2', group_id: 'group-1', date: '2026-09-17', status: 'teacher_canceled', teacher_absence_reason: ADVANCE_NOTICE_REASON },
    )

    await expect(cancelLesson(cancellationForm('target-1'))).rejects.toThrow('מגבלת הביטולים')
    expect(tables.lessons.find((lesson) => lesson.id === 'target-1')?.status).toBe('scheduled')
  })
})

describe('restoreLesson', () => {
  test('preserves the makeup lesson and its attendance when the makeup already has recorded attendance', async () => {
    tables.attendance.push({ id: 'att-1', lesson_id: 'makeup-1', student_id: 'student-1', status: 'present' })

    await restoreLesson('original-1')

    const makeup = tables.lessons.find((l) => l.id === 'makeup-1')
    expect(makeup).toBeDefined()
    expect(tables.attendance.some((a) => a.lesson_id === 'makeup-1')).toBe(true)
  })

  test('still deletes the makeup lesson when it has no recorded attendance', async () => {
    await restoreLesson('original-1')

    const makeup = tables.lessons.find((l) => l.id === 'makeup-1')
    expect(makeup).toBeUndefined()
  })

  test('always restores the original lesson to scheduled status', async () => {
    tables.attendance.push({ id: 'att-1', lesson_id: 'makeup-1', student_id: 'student-1', status: 'present' })

    await restoreLesson('original-1')

    const original = tables.lessons.find((l) => l.id === 'original-1')
    expect(original?.status).toBe('scheduled')
  })
})
