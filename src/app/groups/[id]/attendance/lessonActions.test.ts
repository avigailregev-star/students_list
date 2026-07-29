import { describe, expect, test, vi, beforeEach } from 'vitest'

type Row = Record<string, any>

function createFakeSupabase(tables: Record<string, Row[]>) {
  function from(table: string) {
    const rows = tables[table] ?? (tables[table] = [])
    const filters: [string, any][] = []
    let pendingUpdate: Row | null = null
    let pendingInsert: Row | null = null
    let isDelete = false

    const applyFilters = (list: Row[]) => list.filter((r) => filters.every(([k, v]) => r[k] === v))

    const builder: any = {
      select() { return builder },
      eq(col: string, val: any) { filters.push([col, val]); return builder },
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
      then(resolve: (v: { error: null }) => void) {
        if (pendingUpdate) {
          for (const r of applyFilters(rows)) Object.assign(r, pendingUpdate)
        }
        if (isDelete) {
          for (const r of applyFilters(rows)) {
            const idx = rows.indexOf(r)
            if (idx >= 0) rows.splice(idx, 1)
          }
        }
        resolve({ error: null })
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

import { restoreLesson } from './lessonActions'

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  tables.groups = [{ id: 'group-1', teacher_id: 'teacher-1' }]
  tables.lessons = [
    { id: 'original-1', group_id: 'group-1', status: 'teacher_canceled', makeup_lesson_id: 'makeup-1' },
    { id: 'makeup-1', group_id: 'group-1', status: 'scheduled', is_makeup: true },
  ]
  tables.attendance = []
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
