import { beforeEach, test, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
const state = vi.hoisted(() => ({ rows: [] as (string | number)[][] }))
vi.mock('xlsx', () => ({ utils: {
  aoa_to_sheet: (rows: (string | number)[][]) => { state.rows = rows; return {} },
  book_new: () => ({}), book_append_sheet: () => {},
}, writeFile: () => {} }))
import ExportButtons from '@/app/reports/ExportButtons'
import { getLessonUnits } from '@/lib/payroll/lessonUnits'
import { calculatePayroll } from '@/lib/payroll/calculate'
type Props = Parameters<typeof ExportButtons>[0]
function exportRows(students: Props['reportData'][number]['students'], type = 'individual_45') {
  const entries = new Map(students.flatMap(s => s.history).filter(h => h.status !== 'no_data').map(h => [h.date + ':' + h.startTime + ':' + h.isMakeup, h]))
  const lessons = [...entries].map(([id, h]) => ({ id, group_id: 'g', date: h.date, start_time: h.startTime ?? '10:00', is_makeup: h.isMakeup ?? false, is_holiday: false, status: 'scheduled', teacher_absence_reason: null, admin_approval_status: null, created_at: h.date }))
  const payrollMonths = calculatePayroll({ groups: [{ id: 'g', lesson_type: type, group_schedules: [{ day_of_week: 4, start_time: '10:00', end_time: '11:30' }] }], lessons, attendanceIds: new Set(lessons.map(l => l.id)), extraHours: [], today: '2026-09-30' })
  const element = ExportButtons({ month: '2026-09', teacherName: 'QA', payrollMonths,
    reportData: [{ name: 'QA group', lesson_type: type, group_schedules: [{ start_time: '10:00', end_time: '11:30' }], total_lessons: 1, students }],
  }) as ReactElement<{children: ReactElement<{onClick?: () => void}>[]}>
  element.props.children[1].props.onClick!()
  return state.rows.find(row => row[0] === 'סה"כ')!
}
function student(status: string, makeup = false) {
  return { name: 'QA', total_lessons: 1, lessons_attended: 1, lessons_absent: 0,
    brought_instrument: 0, history: [{ date: '2026-09-10', startTime: '10:00', status, brought: false, isMakeup: makeup }] }
}
beforeEach(() => { state.rows = [] })
test('QA: a later student with attendance must count even if first student has no_data', () => {
  const total = exportRows([student('no_data'), student('present')])
  expect(total[2]).toBe(1)
})
test('QA: 90-minute orchestra must export the same 2 units as payroll page', () => {
  const total = exportRows([student('present')], 'orchestra')
  const expected = getLessonUnits('orchestra', '10:00', [{ start_time: '10:00', end_time: '11:30' }])
  expect(total[5]).toBe(expected)
})
test('QA: a makeup and regular lesson on one date must both appear in payroll export', () => {
  const row = student('present')
  row.history.push({ date: '2026-09-10', startTime: '16:00', status: 'present', brought: false, isMakeup: true })
  const total = exportRows([row])
  expect(total[8]).toBe(1)
  expect(total[2]).toBe(1)
})
