import { getDefaultLessonDurationMinutes } from './lessonTimes'

type Slot = { startTime: string; endTime?: string | null; lessonType: string }
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/

export function scheduleRange(slot: Slot): [number, number] | null {
  if (!timePattern.test(slot.startTime) || (slot.endTime && !timePattern.test(slot.endTime))) return null
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
  const start = minutes(slot.startTime)
  const end = slot.endTime ? minutes(slot.endTime) : start + getDefaultLessonDurationMinutes(slot.lessonType)
  return end > start && end < 1440 ? [start, end] : null
}

export function schedulesOverlap(a: Slot, b: Slot): boolean {
  const first = scheduleRange(a)
  const second = scheduleRange(b)
  // Invalid existing hours must be corrected before adding another booking.
  return !first || !second || (first[0] < second[1] && second[0] < first[1])
}
