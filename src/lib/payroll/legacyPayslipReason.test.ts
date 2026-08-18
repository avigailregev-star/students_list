import { describe, expect, test } from 'vitest'
import { LEGACY_PAYSLIP_REASON, isLegacyPayableCancellation } from './legacyPayslipReason'

describe('isLegacyPayableCancellation', () => {
  test('is payable for the legacy payslip reason', () => {
    expect(isLegacyPayableCancellation(LEGACY_PAYSLIP_REASON)).toBe(true)
  })

  test('is not payable for a regular cancellation reason', () => {
    expect(isLegacyPayableCancellation('ביטול מורה עם השלמה')).toBe(false)
  })

  test('is not payable when there is no reason', () => {
    expect(isLegacyPayableCancellation(null)).toBe(false)
    expect(isLegacyPayableCancellation(undefined)).toBe(false)
  })
})
