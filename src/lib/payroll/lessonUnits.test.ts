import { describe, expect, it } from 'vitest'
import { getLessonUnits } from './lessonUnits'

describe('getLessonUnits', () => {
  it('counts a 90-minute orchestra as two academic hours', () => {
    expect(getLessonUnits('orchestra', '16:00:00', [
      { start_time: '16:00:00', end_time: '17:30:00' },
    ])).toBe(2)
  })

  it('counts 45 minutes as one academic hour', () => {
    expect(getLessonUnits('choir', '16:00:00', [
      { start_time: '16:00:00', end_time: '16:45:00' },
    ])).toBe(1)
  })

  it('keeps one unit for other lesson types and missing end times', () => {
    expect(getLessonUnits('theory', '16:00:00', [
      { start_time: '16:00:00', end_time: '18:00:00' },
    ])).toBe(1)
    expect(getLessonUnits('orchestra', '16:00:00', [
      { start_time: '16:00:00', end_time: null },
    ])).toBe(1)
  })
})
