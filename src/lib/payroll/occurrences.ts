type Schedule = { day_of_week?: number; start_time: string; end_time?: string | null }
type Occurrence = { id: string; date: string; start_time: string; is_makeup: boolean }

export function occurrenceKey(lesson: Occurrence, schedules: Schedule[]): string {
  if (lesson.is_makeup) return `makeup:${lesson.id}`
  const day = new Date(lesson.date + 'T12:00:00').getDay()
  const count = schedules.filter(s => s.day_of_week === day).length
  return `regular:${lesson.date}${count > 1 ? ':' + lesson.start_time.slice(0, 5) : ''}`
}

export function uniqueOccurrences<T extends Occurrence & { group_id: string }>(lessons: T[], schedules: Map<string, Schedule[]>): T[] {
  const seen = new Set<string>()
  return lessons.filter(lesson => {
    const key = `${lesson.group_id}:${occurrenceKey(lesson, schedules.get(lesson.group_id) ?? [])}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
