import { describe, expect, test } from 'vitest'
import { categorizeSickDates } from './sickLeaveTiers'

describe('categorizeSickDates', () => {
  test('excludes a sick-leave claim that admin rejected', () => {
    const result = categorizeSickDates([
      { date: '2026-03-10', teacher_absence_reason: 'מחלת מורה', admin_approval_status: 'rejected' },
    ])

    expect(result.has('2026-03-10')).toBe(false)
  })

  test('includes a sick-leave claim that is still pending approval', () => {
    const result = categorizeSickDates([
      { date: '2026-03-10', teacher_absence_reason: 'מחלת מורה', admin_approval_status: 'pending' },
    ])

    expect(result.get('2026-03-10')).toBe('unpaid')
  })

  test('includes an approved sick-leave claim', () => {
    const result = categorizeSickDates([
      { date: '2026-03-10', teacher_absence_reason: 'מחלת מורה', admin_approval_status: 'approved' },
    ])

    expect(result.get('2026-03-10')).toBe('unpaid')
  })

  test('ignores cancellations for reasons other than illness', () => {
    const result = categorizeSickDates([
      { date: '2026-03-10', teacher_absence_reason: 'ביטול מורה עם השלמה', admin_approval_status: null },
    ])

    expect(result.size).toBe(0)
  })

  test('tiers a 4-day consecutive illness as unpaid, half, half, full', () => {
    const result = categorizeSickDates([
      { date: '2026-03-10', teacher_absence_reason: 'מחלת מורה', admin_approval_status: 'approved' },
      { date: '2026-03-11', teacher_absence_reason: 'מחלת מורה', admin_approval_status: 'approved' },
      { date: '2026-03-12', teacher_absence_reason: 'מחלת מורה', admin_approval_status: 'approved' },
      { date: '2026-03-13', teacher_absence_reason: 'מחלת מורה', admin_approval_status: 'approved' },
    ])

    expect(result.get('2026-03-10')).toBe('unpaid')
    expect(result.get('2026-03-11')).toBe('half')
    expect(result.get('2026-03-12')).toBe('half')
    expect(result.get('2026-03-13')).toBe('full')
  })

  test('starts a new incident after a gap of more than one day', () => {
    const result = categorizeSickDates([
      { date: '2026-03-10', teacher_absence_reason: 'מחלת מורה', admin_approval_status: 'approved' },
      { date: '2026-03-11', teacher_absence_reason: 'מחלת מורה', admin_approval_status: 'approved' },
      { date: '2026-03-20', teacher_absence_reason: 'מחלת מורה', admin_approval_status: 'approved' },
    ])

    expect(result.get('2026-03-11')).toBe('half')
    expect(result.get('2026-03-20')).toBe('unpaid')
  })
})
