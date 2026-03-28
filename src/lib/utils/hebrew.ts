export const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

export const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
]

export function formatDateHe(date: Date): string {
  const day = DAYS_HE[date.getDay()]
  const month = MONTHS_HE[date.getMonth()]
  return `${day}, ${date.getDate()} ${month}`
}

export function formatTimeHe(time: string): string {
  // Accepts "HH:MM:SS" or "HH:MM" and returns "HH:MM"
  return time.slice(0, 5)
}

export function getDayName(dayOfWeek: number): string {
  return DAYS_HE[dayOfWeek] ?? ''
}
