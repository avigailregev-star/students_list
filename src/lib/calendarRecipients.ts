export function reconcileCalendarRecipients(desired: string[], existing: { teacher_id: string; google_event_id: string }[]) {
  const wanted = new Set(desired)
  const current = new Set(existing.map(row => row.teacher_id))
  return {
    remove: existing.filter(row => !wanted.has(row.teacher_id)),
    update: existing.filter(row => wanted.has(row.teacher_id)),
    add: [...wanted].filter(id => !current.has(id)),
  }
}
