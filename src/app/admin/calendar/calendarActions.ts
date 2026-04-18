'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
import type { SchoolEventType } from '@/types/database'

const AUTO_SYNC_TYPES: SchoolEventType[] = ['holiday', 'vacation']

const VALID_EVENT_TYPES: SchoolEventType[] = [
  'holiday', 'vacation', 'concert', 'makeup_day', 'school_start', 'school_end',
]

async function requireAdmin() {
  const { supabase, user } = await _requireAdmin('/admin')
  return { supabase, userId: user.id }
}

export async function createEvent(formData: FormData) {
  const { supabase, userId } = await requireAdmin()

  const name      = (formData.get('name') as string | null)?.trim()
  const eventType = formData.get('event_type') as string
  const startDate = (formData.get('start_date') as string | null)?.trim()
  const endDate   = (formData.get('end_date') as string | null)?.trim() || startDate
  const teacherIds = formData.getAll('teacher_ids') as string[]

  if (!name) throw new Error('שם האירוע חסר')
  if (!startDate) throw new Error('תאריך האירוע חסר')
  if (!VALID_EVENT_TYPES.includes(eventType as SchoolEventType)) {
    throw new Error('סוג אירוע לא תקין')
  }

  const { data: event, error } = await supabase
    .from('school_events')
    .insert({ name, event_type: eventType, start_date: startDate, end_date: endDate, created_by: userId })
    .select('id')
    .single()

  if (error || !event) throw new Error('שגיאה ביצירת האירוע')

  // Insert assignments for non-auto-sync event types
  if (!AUTO_SYNC_TYPES.includes(eventType as SchoolEventType) && teacherIds.length > 0) {
    const rows = teacherIds.map(tid => ({ event_id: event.id, teacher_id: tid }))
    const { error: assignError } = await supabase
      .from('school_event_assignments')
      .insert(rows)
    if (assignError) throw new Error('שגיאה בשיוך המורות')
  }

  revalidatePath('/admin/calendar')
}

export async function deleteEvent(eventId: string) {
  const { supabase } = await requireAdmin()
  // Assignments cascade-delete via FK
  const { error } = await supabase.from('school_events').delete().eq('id', eventId)
  if (error) throw new Error('שגיאה במחיקת האירוע')
  revalidatePath('/admin/calendar')
}
