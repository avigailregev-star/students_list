import { describe, expect, it } from 'vitest'
import { formatLessonTimeRange, getLessonDurationMinutes, getLessonEndTime } from './lessonTimes'

describe('lesson time display', () => {
  it('derives a 45-minute end time for a regular lesson', () => {
    expect(formatLessonTimeRange('15:00:00', 'individual_45')).toBe('15:00–15:45')
  })

  it('derives the correct end time for 60-minute and double lessons', () => {
    expect(getLessonEndTime('15:00', 'individual_60')).toBe('16:00')
    expect(getLessonEndTime('16:00', 'orchestra')).toBe('17:30')
    expect(getLessonEndTime('17:45', 'choir')).toBe('19:15')
  })

  it('uses the stored end time when one exists', () => {
    expect(formatLessonTimeRange('16:00', 'orchestra', '18:00:00')).toBe('16:00–18:00')
    expect(getLessonDurationMinutes('16:00', 'orchestra', '18:00:00')).toBe(120)
  })
})
