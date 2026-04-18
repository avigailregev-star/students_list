import { createClient } from '@/lib/supabase/server'
import type { SchoolEvent } from '@/types/database'

export async function getEventsForTeacher(): Promise<SchoolEvent[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Always-visible: holidays and vacations
  const { data: autoEvents, error: autoError } = await supabase
    .from('school_events')
    .select('*')
    .in('event_type', ['holiday', 'vacation'])
  if (autoError) throw autoError

  // Explicitly assigned: other event types
  const { data: assignedRows, error: assignError } = await supabase
    .from('school_event_assignments')
    .select('event_id')
    .eq('teacher_id', user.id)
  if (assignError) throw assignError

  const assignedIds = (assignedRows ?? []).map(r => r.event_id)

  let assignedEvents: SchoolEvent[] = []
  if (assignedIds.length > 0) {
    const { data, error: eventsError } = await supabase
      .from('school_events')
      .select('*')
      .in('id', assignedIds)
    if (eventsError) throw eventsError
    assignedEvents = (data ?? []) as SchoolEvent[]
  }

  // Merge, deduplicate by id
  const seen = new Set<string>()
  const all: SchoolEvent[] = []
  for (const ev of [...(autoEvents ?? []), ...assignedEvents]) {
    if (!seen.has(ev.id)) {
      seen.add(ev.id)
      all.push(ev as SchoolEvent)
    }
  }
  return all
}
