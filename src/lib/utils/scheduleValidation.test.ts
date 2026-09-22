import { expect, test } from 'vitest'
import { scheduleRange, schedulesOverlap } from './scheduleValidation'

test('detects a partial overlap with different start times', () => {
  expect(schedulesOverlap({ startTime: '10:00', lessonType: 'individual_45' }, { startTime: '10:30:00', lessonType: 'individual_60' })).toBe(true)
})
test('adjacent lessons are allowed regardless of seconds formatting', () => {
  expect(schedulesOverlap({ startTime: '10:00:00', lessonType: 'individual_45' }, { startTime: '10:45', lessonType: 'individual_60' })).toBe(false)
})
test('explicit duration overrides the default', () => {
  expect(schedulesOverlap({ startTime: '10:00', endTime: '12:00', lessonType: 'orchestra' }, { startTime: '11:45', lessonType: 'group' })).toBe(true)
})
test.each(['25:00', '10:99', 'garbage'])('rejects invalid start %s', startTime => {
  expect(scheduleRange({ startTime, lessonType: 'group' })).toBeNull()
})
test('rejects reversed times and lessons crossing midnight', () => {
  expect(scheduleRange({ startTime: '11:00', endTime: '10:00', lessonType: 'group' })).toBeNull()
  expect(scheduleRange({ startTime: '23:45', lessonType: 'individual_60' })).toBeNull()
})
