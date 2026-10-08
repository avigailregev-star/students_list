import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { isValidElement, type ReactNode } from 'react'
import type { MonthPayroll } from '@/app/reports/payroll/page'

type Row = Record<string, unknown>
const state = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, fail: '', revalidate: vi.fn() }))

// Simulates filtering, stable ordering and the API's 1,000-row response limit.
function client() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'teacher' } } }) },
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = []
      const orders: string[] = []
      let first = 0, last = 999
      let update: Row | undefined, insert: Row | undefined, deleting = false
      const result = () => {
        if (state.fail !== table) {
          const matched = (state.tables[table] ?? []).filter(r => filters.every(f => f(r)))
          if (update) { for (const row of matched) Object.assign(row, update); update = undefined }
          if (deleting) { state.tables[table] = (state.tables[table] ?? []).filter(r => !matched.includes(r)); deleting = false }
          if (insert) {
            const defaults = table === 'lessons' ? { is_holiday: false, created_at: '2026-10-07', admin_approval_status: null } : { status: 'pending' }
            const row = { id: `new-${state.tables[table].length}`, ...defaults, ...insert }
            state.tables[table].push(row); filters.push(r => r.id === row.id); insert = undefined
          }
        }
        return ({
        data: state.fail === table ? null : (state.tables[table] ?? []).filter(r => filters.every(f => f(r)))
          .sort((a, b) => { for (const key of orders) { const cmp = String(a[key]).localeCompare(String(b[key])); if (cmp) return cmp } return 0 })
          .slice(first, last + 1),
        error: state.fail === table ? { message: 'simulated read failure' } : null,
      }) }
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push(r => r[key] === value); return query },
        neq: (key: string, value: unknown) => { filters.push(r => r[key] !== value); return query },
        lte: (key: string, value: string) => { filters.push(r => String(r[key]) <= value); return query },
        in: (key: string, values: unknown[]) => { filters.push(r => values.includes(r[key])); return query },
        order: (key: string) => { orders.push(key); return query },
        range: (start: number, end: number) => { first = start; last = end; return query },
        limit: (count: number) => { last = count - 1; return query },
        update: (values: Row) => { update = values; return query },
        insert: (values: Row) => { insert = values; return query },
        delete: () => { deleting = true; return query },
        single: async () => { const r = result(); return { ...r, data: r.data?.[0] ?? null } },
        maybeSingle: async () => { const r = result(); return { ...r, data: r.data?.[0] ?? null } },
        then: (resolve: (r: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      }
      return query
    },
  }
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => client() }))
vi.mock('@/lib/auth', () => ({ requireAdmin: async () => ({ user: { id: 'admin' } }) }))
vi.mock('next/cache', () => ({ revalidatePath: state.revalidate }))
vi.mock('@/lib/googleCalendar', () => ({ deleteGCalEvent: vi.fn(), pushLesson: vi.fn(async () => null) }))
vi.mock('@/lib/queries/events', () => ({ getEventsForTeacher: async () => [] }))
vi.mock('next/navigation', () => ({ redirect: () => { throw Error('redirect') }, notFound: () => { throw Error('not found') } }))
import PayrollPage from '@/app/reports/payroll/page'
import AdminReportsPage from '@/app/admin/teachers/[id]/reports/page'
import ReportsPage from '@/app/reports/page'
import { cancelLesson, restoreLesson, deleteMakeupLesson } from '@/app/groups/[id]/attendance/lessonActions'
import { submitExtraHoursRequest } from '@/app/reports/extraHoursActions'
import { decideExtraHours, addExtraHours } from '@/app/admin/extra-hours/actions'
import { approveLesson as approveSickLeave, rejectLesson as rejectSickLeave } from '@/app/admin/sick-leave/sickLeaveActions'

function monthsIn(node: ReactNode): MonthPayroll[] | undefined {
  if (Array.isArray(node)) { for (const child of node) { const found = monthsIn(child); if (found) return found } }
  if (isValidElement<{ months?: MonthPayroll[]; payrollMonths?: MonthPayroll[]; children?: ReactNode }>(node)) {
    return node.props.months ?? node.props.payrollMonths ?? monthsIn(node.props.children)
  }
}
const pages = [
  ['teacher', () => PayrollPage()],
  ['admin', () => AdminReportsPage({ params: Promise.resolve({ id: 'teacher' }) })],
  ['monthly export source', () => ReportsPage()],
] as const
function lesson(id: string, overrides: Row = {}) {
  const row = { id, group_id: 'group', date: '2026-09-10', start_time: '10:00:00', status: 'scheduled',
    is_holiday: false, is_makeup: false, teacher_absence_reason: null, admin_approval_status: null,
    created_at: `2026-09-01T00:00:00`, ...overrides }
  state.tables.lessons.push(row)
  return row
}
function attendance(id: string, lessonId: string, status = 'present') {
  state.tables.attendance.push({ id, lesson_id: lessonId, status })
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-07T12:00:00Z'))
  state.fail = ''
  state.revalidate.mockClear()
  state.tables = {
    teachers: [{ id: 'teacher', name: 'בדיקה' }],
    groups: [{ id: 'group', teacher_id: 'teacher', lesson_type: 'individual_45', group_schedules: [{ day_of_week: 4, start_time: '10:00:00', end_time: '10:45:00' }] }],
    lessons: [], attendance: [], extra_hours_requests: [],
  }
})
afterEach(() => { vi.useRealTimers() })

describe.each(pages)('%s report: actual page loading and calculation', (_name, page) => {
  test.each(['present', 'absent', 'late', 'excused'])('recorded %s counts once regardless of student count', async status => {
    lesson('l'); attendance('a', 'l', status); attendance('b', 'l', status)
    expect(monthsIn(await page())![0].dayCounts[10].individual_45).toBe(1)
  })
  test('opening attendance without saving does not generate pay', async () => {
    lesson('empty'); expect(monthsIn(await page())).toEqual([])
  })
  test.each([false, true])('cancellation removes regular/makeup pay even with old attendance: makeup=%s', async isMakeup => {
    lesson('canceled', { status: 'teacher_canceled', is_makeup: isMakeup, teacher_absence_reason: 'ביטול מורה עם השלמה' }); attendance('a', 'canceled')
    const months = monthsIn(await page())!
    expect(months.reduce((sum, m) => sum + m.dayCounts[10].individual_45 + m.dayCounts[10].makeup, 0)).toBe(0)
  })
  test('restoring a cancellation restores exactly one recorded lesson', async () => {
    const l = lesson('l', { status: 'teacher_canceled' }); attendance('a', 'l')
    await page(); l.status = 'scheduled'
    expect(monthsIn(await page())![0].dayCounts[10].individual_45).toBe(1)
  })
  test('historical duplicate rows after rescheduling count once', async () => {
    lesson('a'); lesson('b', { start_time: '11:00:00' }); attendance('a1', 'a'); attendance('b1', 'b')
    expect(monthsIn(await page())![0].dayCounts[10].individual_45).toBe(1)
  })
  test('two scheduled slots and a makeup on the same date remain separate', async () => {
    state.tables.groups[0].group_schedules = [
      { day_of_week: 4, start_time: '10:00:00', end_time: '10:45:00' },
      { day_of_week: 4, start_time: '11:00:00', end_time: '11:45:00' },
    ]
    lesson('a'); lesson('b', { start_time: '11:00:00' }); lesson('m', { is_makeup: true, start_time: '16:00:00' })
    for (const id of ['a', 'b', 'm']) attendance(id, id)
    const day = monthsIn(await page())![0].dayCounts[10]
    expect([day.individual_45, day.makeup]).toEqual([2, 1])
  })
  test.each(['pending', 'rejected', null])('unapproved illness (%s) never enters sick totals', async status => {
    lesson('s', { status: 'teacher_canceled', teacher_absence_reason: 'מחלת מורה', admin_approval_status: status })
    expect(monthsIn(await page())!.reduce((sum, m) => sum + m.sickDays, 0)).toBe(0)
  })
  test('approved illness is one day across groups and maintains its tier across months', async () => {
    for (const [id, date] of [['a', '2026-08-31'], ['b', '2026-09-01'], ['c', '2026-09-01']]) {
      lesson(id, { date, status: 'teacher_canceled', teacher_absence_reason: 'מחלת מורה', admin_approval_status: 'approved' })
    }
    const september = monthsIn(await page())!.find(m => m.key === '2026-09')!
    expect([september.sickDays, september.sickUnpaid, september.sickHalf]).toEqual([1, 0, 1])
  })
  test('extra hours use approved minutes, exclude other teachers and future dates, support no groups', async () => {
    state.tables.groups = []
    state.tables.extra_hours_requests = [
      { id: 'a', teacher_id: 'teacher', work_date: '2026-09-10', minutes: 45, activity_type: 'ישיבה', status: 'approved' },
      { id: 'b', teacher_id: 'teacher', work_date: '2026-09-10', minutes: 90, activity_type: 'חזרה', status: 'approved' },
      { id: 'c', teacher_id: 'teacher', work_date: '2026-09-10', minutes: 60, status: 'pending' },
      { id: 'd', teacher_id: 'teacher', work_date: '2026-09-10', minutes: 60, status: 'rejected' },
      { id: 'e', teacher_id: 'other', work_date: '2026-09-10', minutes: 60, status: 'approved' },
      { id: 'f', teacher_id: 'teacher', work_date: '2026-10-08', minutes: 60, status: 'approved' },
    ]
    const months = monthsIn(await page())!
    expect(months.map(m => m.key)).toEqual(['2026-09'])
    expect(months[0].dayCounts[10].extra_hours).toBe(2.25)
  })
  test('holiday and future lessons are excluded even when attendance exists', async () => {
    lesson('holiday', { is_holiday: true }); lesson('future', { date: '2026-10-08' })
    attendance('a', 'holiday'); attendance('b', 'future'); expect(monthsIn(await page())).toEqual([])
  })
  test.each(['groups', 'lessons', 'attendance', 'extra_hours_requests'])('read error in %s fails instead of returning a misleading partial report', async table => {
    lesson('l'); attendance('a', 'l'); state.fail = table
    await expect(page()).rejects.toBeTruthy()
  })
  test('attendance beyond the API response limit is not silently omitted', async () => {
    lesson('a'); lesson('b', { date: '2026-09-11' })
    for (let i = 0; i < 1001; i++) attendance(String(i).padStart(5, '0'), 'a')
    attendance('99999', 'b')
    expect(monthsIn(await page())![0].dayCounts[11].individual_45).toBe(1)
  })
  test('more than 1,000 lessons and extra-hours requests are all included', async () => {
    for (let i = 0; i < 1001; i++) {
      const id = String(i).padStart(5, '0')
      lesson(id, { is_makeup: true }); attendance(id, id)
      state.tables.extra_hours_requests.push({ id, teacher_id: 'teacher', work_date: '2026-09-10', minutes: 30, status: 'approved' })
    }
    const day = monthsIn(await page())![0].dayCounts[10]
    expect([day.makeup, day.extra_hours]).toEqual([1001, 500.5])
  })
})

function form(values: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data }
async function report() { return monthsIn(await PayrollPage())! }
test('action flow: record → cancel with makeup → teach makeup → delete makeup → restore original', async () => {
  lesson('original'); attendance('a', 'original')
  expect((await report())[0].dayCounts[10].individual_45).toBe(1)
  await cancelLesson(form({ lesson_id: 'original', reason: 'ביטול מורה עם השלמה', notes: '2026-09-11', makeup_start_time: '16:00' }))
  expect(await report()).toEqual([])
  const makeup = state.tables.lessons.find(l => l.is_makeup)!
  attendance('b', String(makeup.id))
  expect((await report())[0].dayCounts[11].makeup).toBe(1)
  expect(await deleteMakeupLesson(String(makeup.id))).toEqual({ ok: true })
  expect(await report()).toEqual([])
  await restoreLesson('original')
  expect((await report())[0].dayCounts[10].individual_45).toBe(1)
  expect(state.revalidate).toHaveBeenCalledWith('/reports/payroll')
})
test('action flow: pending extra hours → administrator changes minutes and approves → report reflects approved amount', async () => {
  expect(await submitExtraHoursRequest(form({ work_date: '2026-09-10', unit_minutes: '45', quantity: '2', activity_type: 'ישיבה' }))).toEqual({})
  expect(await report()).toEqual([])
  expect(await decideExtraHours(String(state.tables.extra_hours_requests[0].id), 'approved', 60)).toEqual({})
  expect((await report())[0].dayCounts[10].extra_hours).toBe(1)
  expect(state.revalidate).toHaveBeenCalledWith('/reports/payroll')
})
test('action flow: rejected extra hours do not enter the report', async () => {
  await submitExtraHoursRequest(form({ work_date: '2026-09-10', unit_minutes: '30', quantity: '1', activity_type: 'ישיבה' }))
  await decideExtraHours(String(state.tables.extra_hours_requests[0].id), 'rejected', 30)
  expect(await report()).toEqual([])
})
test('action flow: administrator adds 3 × 45 minutes directly', async () => {
  expect(await addExtraHours(form({ teacher_id: 'teacher', work_date: '2026-09-10', unit_minutes: '45', quantity: '3', activity_type: 'ישיבה' }))).toEqual({})
  expect((await report())[0].dayCounts[10].extra_hours).toBe(2.25)
})
test('action flow: sick leave is excluded pending approval, included after approval, excluded after rejection', async () => {
  lesson('s'); attendance('a', 's')
  await cancelLesson(form({ lesson_id: 's', reason: 'מחלת מורה', is_sick_leave: 'true' }))
  expect(await report()).toEqual([])
  await approveSickLeave('s')
  expect((await report())[0].sickDays).toBe(1)
  await rejectSickLeave('s')
  expect(await report()).toEqual([])
  expect(state.revalidate).toHaveBeenCalledWith('/reports/payroll')
})
test.each([approveSickLeave, rejectSickLeave])('failed sick-leave decision surfaces the write error', async action => {
  lesson('s', { status: 'teacher_canceled', teacher_absence_reason: 'מחלת מורה', admin_approval_status: 'pending' })
  state.fail = 'lessons'
  await expect(action('s')).rejects.toThrow()
  expect(state.tables.lessons[0].admin_approval_status).toBe('pending')
})
