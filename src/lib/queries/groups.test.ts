import { describe, expect, test } from 'vitest'
import { hideEmptyIndividualLessons } from './groups'

describe('hideEmptyIndividualLessons', () => {
  test('hides an old individual lesson after its student was transferred', () => {
    const groups = [
      { id: 'old', lesson_type: 'individual_45', students: [] },
      { id: 'new', lesson_type: 'individual_45', students: [{ is_active: true }] },
    ]

    expect(hideEmptyIndividualLessons(groups).map(group => group.id)).toEqual(['new'])
  })

  test('keeps empty group lessons because they may be scheduled before enrollment', () => {
    const groups = [{ id: 'ensemble', lesson_type: 'group', students: [] }]

    expect(hideEmptyIndividualLessons(groups)).toEqual(groups)
  })
})
