import type { GroupSchedule, GroupWithSchedules, Holiday, LessonSlot } from '@/types/database'

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
  const candidates = schedules.map(s => getNextDateForDayOfWeek(s.day_of_week, from))
  candidates.sort((a, b) => a.getTime() - b.getTime())
  return candidates[0]
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
