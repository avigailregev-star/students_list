/**
 * Historical cancellations tagged with this reason predate the current
 * "cancel with makeup" flow and were paid directly rather than through a
 * linked makeup lesson. They must still count toward payroll even though
 * their status is 'teacher_canceled'.
 */
export const LEGACY_PAYSLIP_REASON = 'העדרות מורה עם השלמה בתלוש נוכחי'

export function isLegacyPayableCancellation(reason: string | null | undefined): boolean {
  return reason === LEGACY_PAYSLIP_REASON
}
