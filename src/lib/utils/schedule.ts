import type { GroupSchedule, GroupWithSchedules, Holiday, LessonSlot } from '@/types/database'

/**
 * שנת הלימודים הנוכחית מתחילה ב-1.9.2026 — אין שיעורים לפני תאריך זה.
 */
export const SCHOOL_YEAR_START = new Date(2026, 8, 1)

/**
 * Given a day_of_week (0=Sun..6=Sat), returns the next Date that falls on that day
 * starting from `from` (inclusive if same day).
 */
export function getNextDateForDayOfWeek(dayOfWeek: number, from: Date = new Date()): Date {
  const date = new Date(from)
  date.setHours(0, 0, 0, 0)
  const current = date.getDay()
  const diff = (dayOfWeek - current + 7) % 7
  date.setDate(date.getDate() + diff)
  return date
}

/**
 * Returns the nearest upcoming lesson date for a group, based on its schedules.
 * If the group has multiple schedules, returns the earliest upcoming one.
 */
export function getNextLessonDate(schedules: GroupSchedule[], from: Date = new Date()): Date | null {
  if (schedules.length === 0) return null
  const effectiveFrom = from < SCHOOL_YEAR_START ? SCHOOL_YEAR_START : from
  const candidates = schedules.map(s => getNextDateForDayOfWeek(s.day_of_week, effectiveFrom))
  candidates.sort((a, b) => a.getTime() - b.getTime())
  return candidates[0]
}

/**
 * Returns the most recent past lesson date (or today if today is a lesson day).
 * Used for the attendance page so teachers mark the lesson that already happened.
 */
export function getLastLessonDate(schedules: GroupSchedule[], from: Date = new Date()): Date | null {
  if (schedules.length === 0) return null
  const base = new Date(from)
  base.setHours(0, 0, 0, 0)
  const current = base.getDay()

  const candidates = schedules.map(s => {
    const date = new Date(base)
    const backDiff = (current - s.day_of_week + 7) % 7
    date.setDate(date.getDate() - backDiff)
    return date
  })

  // Return the most recent one (closest to today going backward)
  candidates.sort((a, b) => b.getTime() - a.getTime())
  const result = candidates[0]
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (result > today) return null
  if (result < SCHOOL_YEAR_START) return null
  return result
}

/**
 * July (6) and August (7) are summer — no regular lessons.
 * Makeup slots are tracked separately and bypass this check.
 */
export function isSummerMonth(month: number): boolean {
  return month === 6 || month === 7
}

/**
 * Checks if a date is a holiday (Friday, Saturday, or exists in holidays list).
 */
export function isHolidayDate(
  date: Date,
  holidays: Holiday[]
): { isHoliday: boolean; name?: string } {
  const day = date.getDay()
  if (day === 5) return { isHoliday: true, name: 'שישי' }
  if (day === 6) return { isHoliday: true, name: 'שבת' }

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const match = holidays.find(h => h.date === dateStr)
  if (match) return { isHoliday: true, name: match.name }

  return { isHoliday: false }
}

/**
 * Returns the start of the week (Sunday) for a given date.
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

/**
 * For each group+schedule, computes the Date within the given week.
 */
export function getLessonSlotsForWeek(
  groups: GroupWithSchedules[],
  weekStart: Date
): LessonSlot[] {
  const slots: LessonSlot[] = []

  for (const group of groups) {
    for (const schedule of group.group_schedules) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + schedule.day_of_week)

      if (date < SCHOOL_YEAR_START) continue
      if (isSummerMonth(date.getMonth())) continue

      slots.push({
        groupId: group.id,
        groupName: group.name,
        lessonType: group.lesson_type,
        isMangan: group.is_mangan_school,
        schoolName: group.school_name,
        grade: group.grade,
        date,
        startTime: schedule.start_time.slice(0, 5),
        dayOfWeek: schedule.day_of_week,
      })
    }
  }

  // Sort by day then time
  slots.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    return a.startTime.localeCompare(b.startTime)
  })

  return slots
}

/**
 * Returns all lesson slots for every day in the given calendar month.
 */
export function getLessonSlotsForMonth(
  groups: GroupWithSchedules[],
  year: number,
  month: number  // 0-indexed (0=Jan)
): LessonSlot[] {
  if (isSummerMonth(month)) return []

  const slots: LessonSlot[] = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    if (date < SCHOOL_YEAR_START) continue
    const dow = date.getDay()
    for (const group of groups) {
      for (const schedule of group.group_schedules) {
        if (schedule.day_of_week === dow) {
          slots.push({
            groupId: group.id,
            groupName: group.name,
            lessonType: group.lesson_type,
            isMangan: group.is_mangan_school,
            schoolName: group.school_name,
            grade: group.grade,
            date: new Date(date),
            startTime: schedule.start_time.slice(0, 5),
            dayOfWeek: dow,
          })
        }
      }
    }
  }

  slots.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    return a.startTime.localeCompare(b.startTime)
  })

  return slots
}
