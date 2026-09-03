type Schedule = {
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
): number {
  if (lessonType !== 'orchestra' && lessonType !== 'choir') return 1

  const schedule = schedules.find(item =>
    item.start_time.slice(0, 5) === lessonStartTime.slice(0, 5)
  ) ?? (schedules.length === 1 ? schedules[0] : undefined)

  if (!schedule?.end_time) return 1

  const durationMinutes = timeToMinutes(schedule.end_time) - timeToMinutes(schedule.start_time)
  return durationMinutes > 0 ? durationMinutes / 45 : 1
}
