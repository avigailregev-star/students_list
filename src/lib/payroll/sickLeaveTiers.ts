export type SickLeaveCancellation = {
  date: string
  teacher_absence_reason: string | null
  admin_approval_status?: 'pending' | 'approved' | 'rejected' | null
}

export type SickLeaveTier = 'unpaid' | 'half' | 'full'

const SICK_LEAVE_REASON = 'מחלת מורה'

/**
 * Groups a teacher's sick-leave cancellations into consecutive-day illness
 * incidents and tiers each day (day 1 unpaid, days 2-3 half, day 4+ full).
 * A claim an admin rejected does not count toward any tier.
 */
export function categorizeSickDates(
  cancellations: SickLeaveCancellation[]
): Map<string, SickLeaveTier> {
  const sickDatesSet = new Set<string>()
  for (const c of cancellations) {
    if (c.teacher_absence_reason === SICK_LEAVE_REASON && c.admin_approval_status !== 'rejected') {
      sickDatesSet.add(c.date)
    }
  }
  const sortedSickDates = Array.from(sickDatesSet).sort()

  const result = new Map<string, SickLeaveTier>()
  let incidentDay = 0
  for (let i = 0; i < sortedSickDates.length; i++) {
    const date = sortedSickDates[i]
    if (i === 0) {
      incidentDay = 1
    } else {
      const prev = new Date(sortedSickDates[i - 1])
      const curr = new Date(date)
      const gapDays = Math.round((curr.getTime() - prev.getTime()) / 86400000)
      incidentDay = gapDays > 1 ? 1 : incidentDay + 1
    }
    result.set(date, incidentDay === 1 ? 'unpaid' : incidentDay <= 3 ? 'half' : 'full')
  }

  return result
}
