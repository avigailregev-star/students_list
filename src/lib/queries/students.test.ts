import { describe, expect, test } from 'vitest'
import type { Student } from '@/types/database'
import { selectStudentsForAttendance } from './students'

function student(id: string, isActive: boolean): Student {
  return {
    id,
    group_id: 'group-1',
    name: id,
    instrument: null,
    parent_phone: null,
    is_active: isActive,
    created_at: '2026-09-01T00:00:00Z',
  }
}

describe('selectStudentsForAttendance', () => {
  test('uses an archived student for an old group that no longer has an active roster', () => {
    const archived = student('archived-student', false)

    expect(selectStudentsForAttendance([archived], [], true)).toEqual([archived])
  })

  test('does not put an archived student into a current or future empty lesson', () => {
    expect(selectStudentsForAttendance([student('archived-student', false)], [], false)).toEqual([])
  })

  test('keeps inactive students that already have attendance without adding unrelated archived students', () => {
    const active = student('active-student', true)
    const attended = student('attended-student', false)
    const unrelated = student('unrelated-student', false)

    expect(selectStudentsForAttendance(
      [active, attended, unrelated],
      [{ student_id: attended.id }],
      true
    )).toEqual([active, attended])
  })
})
