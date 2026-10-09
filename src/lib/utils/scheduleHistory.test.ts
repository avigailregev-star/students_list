import { describe, expect, test } from 'vitest'
import type { GroupWithSchedules, LessonSlot } from '@/types/database'
import { mergeScheduledAndRecordedSlots } from './schedule'

const group = {
  id: 'group-1', name: 'פסנתר', teacher_id: 'teacher-1', lesson_type: 'individual_45',
  is_mangan_school: false, school_name: null, grade: null, max_students: null, created_at: '', students: [],
  group_schedules: [{ id: 'schedule-1', group_id: 'group-1', day_of_week: 3, start_time: '11:00:00', end_time: null, created_at: '' }],
} as GroupWithSchedules

function slot(date: string, startTime: string, isMakeup = false): LessonSlot {
  const value = new Date(`${date}T12:00:00`)
  return {
    groupId: group.id, groupName: group.name, lessonType: group.lesson_type,
    isMangan: false, schoolName: null, grade: null, date: value,
    startTime, dayOfWeek: value.getDay(), isMakeup,
  }
}

describe('mergeScheduledAndRecordedSlots', () => {
  test('shows recorded September lessons even when they are outside the generated window', () => {
    const recorded = slot('2026-09-01', '10:00')
    const result = mergeScheduledAndRecordedSlots([], [recorded], new Date('2026-10-09T12:00:00'))
    expect(result).toEqual([recorded])
  })

  test('uses only recorded history before today, never the current recurring projection', () => {
    const generatedOldDateAtNewTime = slot('2026-09-02', '11:00')
    const recordedAtOriginalTime = slot('2026-09-01', '10:00')
    const futureAtNewTime = slot('2026-10-14', '11:00')

    const result = mergeScheduledAndRecordedSlots(
      [generatedOldDateAtNewTime, futureAtNewTime],
      [recordedAtOriginalTime],
      new Date('2026-10-09T12:00:00')
    )

    expect(result).toEqual([recordedAtOriginalTime, futureAtNewTime])
  })

  test('deduplicates a recorded lesson that still matches the current schedule', () => {
    const generated = slot('2026-10-14', '11:00')
    const recorded = slot('2026-10-14', '11:00')
    expect(mergeScheduledAndRecordedSlots([generated], [recorded])).toHaveLength(1)
  })

  test('removes past generated cards even when they belong to a newly-created group', () => {
    const generatedFromReplacementGroup = { ...slot('2026-09-01', '10:00'), groupId: 'replacement-group' }
    const recordedOriginal = slot('2026-09-01', '10:00')

    expect(mergeScheduledAndRecordedSlots(
      [generatedFromReplacementGroup],
      [recordedOriginal],
      new Date('2026-10-09T12:00:00')
    )).toEqual([recordedOriginal])
  })
})
