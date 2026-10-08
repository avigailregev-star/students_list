import { describe, expect, test } from 'vitest'
import { calculatePayroll, israelToday, isWorkDay, totalLessonUnits, type PayrollGroup, type PayrollLesson, type PayrollExtraHours } from './calculate'
import { LEGACY_PAYSLIP_REASON } from './legacyPayslipReason'

const group: PayrollGroup = { id: 'g', lesson_type: 'individual_45', group_schedules: [{ day_of_week: 4, start_time: '10:00:00', end_time: '11:30:00' }] }
function lesson(id: string, patch: Partial<PayrollLesson> = {}): PayrollLesson {
  return { id, group_id: 'g', date: '2026-09-10', start_time: '10:00:00', is_makeup: false, is_holiday: false,
    status: 'scheduled', teacher_absence_reason: null, admin_approval_status: null, created_at: '2026-09-01', ...patch }
}
function calculate(lessons: PayrollLesson[], options: { groups?: PayrollGroup[]; ids?: string[]; extra?: PayrollExtraHours[] } = {}) {
  return calculatePayroll({ groups: options.groups ?? [group], lessons, attendanceIds: new Set(options.ids ?? lessons.map(l => l.id)),
    extraHours: options.extra ?? [], today: '2026-10-07' })
}
describe('payroll business scenarios', () => {
  test('frozen type, units and occurrence identities survive schedule changes', () => {
    const result = calculate([
      lesson('a', { payroll_lesson_type: 'individual_45', payroll_units: 1, payroll_occurrence_key: 'regular:2026-09-10:10:00' }),
      lesson('b', { start_time: '11:00', payroll_lesson_type: 'individual_45', payroll_units: 1, payroll_occurrence_key: 'regular:2026-09-10:11:00' }),
    ], { groups: [{ ...group, lesson_type: 'individual_60', group_schedules: [] }] })[0]
    expect(result.dayCounts[10].individual_45).toBe(2)
    expect(result.dayCounts[10].individual_60).toBe(0)
  })
  test('legacy baseline contributes the unchanged amount and a review marker', () => {
    const month = calculate([lesson('l', { payroll_lesson_type: 'orchestra', payroll_units: 2, payroll_snapshot_origin: 'legacy_baseline' })])[0]
    expect(month.dayCounts[10].ensemble).toBe(2)
    expect(month.unverifiedLessons).toBe(1)
  })
  test('cancelled and reported copies of one occurrence stop the report', () => {
    expect(() => calculate([lesson('held'), lesson('canceled', { status: 'teacher_canceled' })])).toThrow('סותרים')
  })
  test('conflicting snapshot units stop the report instead of choosing a duplicate', () => {
    expect(() => calculate([lesson('a', { payroll_units: 1 }), lesson('b', { payroll_units: 2 })])).toThrow('סותרים')
  })
  test('linked makeup inherits its original units if only the original has a snapshot', () => {
    const month = calculate([
      lesson('original', { status: 'teacher_canceled', makeup_lesson_id: 'makeup', payroll_units: 2, payroll_lesson_type: 'orchestra' }),
      lesson('makeup', { is_makeup: true, start_time: '19:00' }),
    ])[0]
    expect(month.dayCounts[10].makeup).toBe(2)
  })
  test.each([0, -1, NaN, Infinity, 33])('invalid snapshot units %s stop the report', units => {
    expect(() => calculate([lesson('bad', { payroll_units: units })])).toThrow('יחידות')
  })
  test('a duplicated extra-hours ID is counted once, separate requests accumulate', () => {
    const entry = { id: 'a', work_date: '2026-09-10', minutes: 45, activity_type: 'ישיבה', status: 'approved' }
    expect(calculate([], { extra: [entry, entry, { ...entry, id: 'b' }] })[0].dayCounts[10].extra_hours).toBe(1.5)
  })
  test.each([0, -30, 1441, 1.5])('invalid approved extra-hours minutes %s stop the report', minutes => {
    expect(() => calculate([], { extra: [{ work_date: '2026-09-10', minutes, activity_type: 'ישיבה', status: 'approved' }] })).toThrow('משך')
  })
  test('partial sick leave retains attendance and lists only approved canceled lessons in time order', () => {
    const sick = { status: 'teacher_canceled', teacher_absence_reason: 'מחלת מורה', admin_approval_status: 'approved' } as const
    const month = calculate([
      lesson('held'),
      lesson('sick', { ...sick, group_id: 'g2', start_time: '12:00' }),
      lesson('duplicate', { ...sick, group_id: 'g2', start_time: '12:00' }),
      lesson('early', { ...sick, group_id: 'g3', start_time: '09:00' }),
      lesson('pending', { ...sick, date: '2026-09-11', admin_approval_status: 'pending' }),
      lesson('rejected', { ...sick, date: '2026-09-12', admin_approval_status: 'rejected' }),
      lesson('holiday', { ...sick, is_holiday: true }),
      lesson('future', { ...sick, date: '2026-10-08' }),
      lesson('other', { ...sick, group_id: 'other' }),
    ], { groups: [group, { ...group, id: 'g2', lesson_type: 'individual_60' }, { ...group, id: 'g3', lesson_type: 'theory' }] })[0]
    expect(totalLessonUnits(month.dayCounts[10])).toBe(1)
    expect(isWorkDay(month.dayCounts[10])).toBe(true)
    expect(month.sickDays).toBe(1)
    expect(month.sickLeaveDetails[10]).toEqual([
      { startTime: '09:00', lessonType: 'theory' }, { startTime: '12:00', lessonType: 'individual_60' },
    ])
    expect(Object.keys(month.sickLeaveDetails)).toEqual(['10'])
  })
  test.each([
    ['individual_45', 'individual_45', 1], ['individual_60', 'individual_60', 1],
    ['melodies_individual', 'melodies', 1], ['melodies_group', 'melodies', 1], ['group', 'melodies', 1],
    ['orchestra', 'ensemble', 2], ['choir', 'ensemble', 2], ['theory', 'theory', 1], ['darcha', 'darcha', 1],
  ] as const)('%s is allocated to %s with %s units', (type, col, units) => {
    const day = calculate([lesson('l')], { groups: [{ ...group, lesson_type: type }] })[0].dayCounts[10]
    expect(day[col]).toBe(units); expect(totalLessonUnits(day)).toBe(units)
  })
  test.each(['ביטול מורה עם השלמה', 'מחלת מורה', 'ביטול מוצדק של תלמיד (עד שניים בשנה)', 'סיבה אחרת', null])('cancellation %s contributes no lesson units', reason => {
    expect(calculate([lesson('l', { status: 'teacher_canceled', teacher_absence_reason: reason })])).toEqual([])
  })
  test('original cancellation plus attended makeup pays only the makeup on its actual date', () => {
    const months = calculate([
      lesson('o', { status: 'teacher_canceled', teacher_absence_reason: 'ביטול מורה עם השלמה' }),
      lesson('m', { is_makeup: true, date: '2026-10-01' }),
    ])
    expect(months.map(m => m.key)).toEqual(['2026-10'])
    expect(months[0].dayCounts[1].makeup).toBe(1)
  })
  test('scheduled makeup is not paid until attendance is saved', () => {
    expect(calculate([lesson('m', { is_makeup: true })], { ids: [] })).toEqual([])
  })
  test('legacy paid original is retained without attendance and linked legacy makeup is not counted again', () => {
    const month = calculate([
      lesson('o', { status: 'teacher_canceled', teacher_absence_reason: LEGACY_PAYSLIP_REASON }),
      lesson('m', { is_makeup: true, date: '2026-09-11', teacher_absence_reason: LEGACY_PAYSLIP_REASON }),
    ], { ids: ['m'] })[0]
    expect(month.dayCounts[10].individual_45).toBe(1)
    expect(month.dayCounts[11].makeup).toBe(0)
  })
  test('separate groups and distinct makeup IDs on one date are not collapsed', () => {
    const day = calculate([
      lesson('a'), lesson('b', { group_id: 'g2' }), lesson('m1', { is_makeup: true }), lesson('m2', { is_makeup: true }),
    ], { groups: [group, { ...group, id: 'g2' }] })[0].dayCounts[10]
    expect([day.individual_45, day.makeup, totalLessonUnits(day)]).toEqual([2, 2, 4])
  })
  test('unrelated group lessons cannot enter this teacher report', () => {
    expect(calculate([lesson('other', { group_id: 'other' })])).toEqual([])
  })
  test('unknown lesson type stops export instead of silently losing a lesson', () => {
    expect(() => calculate([lesson('l')], { groups: [{ ...group, lesson_type: 'unknown' }] })).toThrow('סוג שיעור')
  })
  test('same start time on different weekdays uses the duration for that weekday', () => {
    const months = calculate([lesson('l')], { groups: [{ ...group, lesson_type: 'orchestra', group_schedules: [
      { day_of_week: 0, start_time: '10:00:00', end_time: '10:45:00' }, ...group.group_schedules,
    ] }] })
    expect(months[0].dayCounts[10].ensemble).toBe(2)
  })
  test('approved extra hours alone count as a workday while lesson total stays zero', () => {
    const day = calculate([], { extra: [{ work_date: '2026-09-10', minutes: 45, activity_type: 'ישיבה', status: 'approved' }] })[0].dayCounts[10]
    expect(day.extra_hours).toBe(0.75); expect(totalLessonUnits(day)).toBe(0); expect(isWorkDay(day)).toBe(true)
  })
  test('29 February in a leap year and 31 December stay in the correct month', () => {
    const months = calculate([lesson('leap', { date: '2024-02-29' }), lesson('year', { date: '2025-12-31' })])
    expect(months.map(m => [m.key, m.daysInMonth])).toEqual([['2025-12', 31], ['2024-02', 29]])
    expect(months[1].dayCounts[29].individual_45).toBe(1)
  })
  test('payroll cutoff uses the Israeli date even when the server is still on the previous UTC day', () => {
    expect(israelToday(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10-01')
  })
})
