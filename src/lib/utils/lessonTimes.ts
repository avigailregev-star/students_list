import type { LessonType } from '@/types/database'

export function getDefaultLessonDurationMinutes(lessonType: LessonType | string): number {
  if (lessonType === 'individual_60') return 60
  if (lessonType === 'orchestra' || lessonType === 'choir') return 90
  return 45
}

export function addMinutesToTime(startTime: string, minutes: number): string {
  const [hours, mins] = startTime.slice(0, 5).split(':').map(Number)
  const total = (hours * 60 + mins + minutes) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function getLessonDurationMinutes(
  startTime: string,
  lessonType: LessonType | string,
  storedEndTime?: string | null,
): number {
  if (!storedEndTime) return getDefaultLessonDurationMinutes(lessonType)
  const [startHours, startMinutes] = startTime.slice(0, 5).split(':').map(Number)
  const [endHours, endMinutes] = storedEndTime.slice(0, 5).split(':').map(Number)
  const duration = endHours * 60 + endMinutes - (startHours * 60 + startMinutes)
  return duration > 0 ? duration : getDefaultLessonDurationMinutes(lessonType)
}

export function getLessonEndTime(
  startTime: string,
  lessonType: LessonType | string,
  storedEndTime?: string | null,
): string {
  return storedEndTime?.slice(0, 5)
    ?? addMinutesToTime(startTime, getDefaultLessonDurationMinutes(lessonType))
}

export function formatLessonTimeRange(
  startTime: string,
  lessonType: LessonType | string,
  storedEndTime?: string | null,
): string {
  return `${startTime.slice(0, 5)}–${getLessonEndTime(startTime, lessonType, storedEndTime)}`
}
