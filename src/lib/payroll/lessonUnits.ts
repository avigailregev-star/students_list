type Schedule = {
  day_of_week?: number
  start_time: string
  end_time: string | null
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return hours * 60 + minutes
}

export function getLessonUnits(
  lessonType: string,
  lessonStartTime: string,
  schedules: Schedule[],
  lessonDate?: string,
): number {
  if (lessonType !== 'orchestra' && lessonType !== 'choir') return 1

  const day = lessonDate ? new Date(lessonDate + 'T12:00:00').getDay() : undefined
  const matchingDay = day === undefined ? [] : schedules.filter(item => item.day_of_week === day)
  const candidates = matchingDay.length ? matchingDay : schedules
  const schedule = candidates.find(item =>
    item.start_time.slice(0, 5) === lessonStartTime.slice(0, 5)
  ) ?? (candidates.length === 1 ? candidates[0] : undefined)

  if (!schedule?.end_time) return 1

  const durationMinutes = timeToMinutes(schedule.end_time) - timeToMinutes(schedule.start_time)
  return durationMinutes > 0 ? durationMinutes / 45 : 1
}
