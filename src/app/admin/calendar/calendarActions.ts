'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
import type { SchoolEventType } from '@/types/database'
import { pushSchoolEvent, deleteGCalEvent } from '@/lib/googleCalendar'

const AUTO_SYNC_TYPES: SchoolEventType[] = ['holiday', 'vacation']

const VALID_EVENT_TYPES: SchoolEventType[] = [
  'holiday', 'vacation', 'concert', 'makeup_day', 'school_start', 'school_end',
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireAdmin() {
  const { supabase, user } = await _requireAdmin('/admin')
  return { supabase, userId: user.id }
}

export async function createEvent(formData: FormData) {
  const { supabase, userId } = await requireAdmin()

  const name       = (formData.get('name') as string | null)?.trim()
  const eventType  = formData.get('event_type') as string
  const startDate  = (formData.get('start_date') as string | null)?.trim()
  const endDate    = (formData.get('end_date') as string | null)?.trim() || startDate
  const teacherIds = formData.getAll('teacher_ids') as string[]

  if (!name) throw new Error('שם האירוע חסר')
  if (!startDate) throw new Error('תאריך האירוע חסר')
  if (endDate && endDate < startDate) throw new Error('תאריך סיום קודם לתאריך התחלה')
  if (!VALID_EVENT_TYPES.includes(eventType as SchoolEventType)) throw new Error('סוג אירוע לא תקין')
  if (teacherIds.some(tid => !UUID_RE.test(tid))) throw new Error('מזהה מורה לא תקין')

  const { data: event, error } = await supabase
    .from('school_events')
    .insert({ name, event_type: eventType, start_date: startDate, end_date: endDate, created_by: userId })
    .select('id')
    .single()

  if (error || !event) throw new Error('שגיאה ביצירת האירוע')

  if (!AUTO_SYNC_TYPES.includes(eventType as SchoolEventType) && teacherIds.length > 0) {
    const rows = teacherIds.map(tid => ({ event_id: event.id, teacher_id: tid }))
    const { error: assignError } = await supabase
      .from('school_event_assignments')
      .insert(rows)
    if (assignError) throw new Error('שגיאה בשיוך המורות')
  }

  revalidatePath('/admin/calendar')
  revalidatePath('/')

  // Push to admin's Google Calendar (fire-and-forget)
  void (async () => {
    try {
      const gcalId = await pushSchoolEvent(userId, {
        id: event.id, name: name!, startDate: startDate!, endDate: endDate!,
      })
      if (gcalId) {
        await supabase.from('school_events').update({ google_event_id: gcalId }).eq('id', event.id)
      }

      // Push to teachers' Google Calendars
      let teacherIdsToPush: string[] = teacherIds
      if (AUTO_SYNC_TYPES.includes(eventType as SchoolEventType)) {
        const { data: allTeachers } = await supabase
          .from('teachers').select('id').eq('role', 'teacher')
        teacherIdsToPush = (allTeachers ?? []).map(t => t.id)
      }
      for (const tid of teacherIdsToPush) {
        const tGcalId = await pushSchoolEvent(tid, {
          id: event.id, name: name!, startDate: startDate!, endDate: endDate!,
        })
        if (tGcalId) {
          await supabase.from('google_event_assignments').insert({
            school_event_id: event.id, teacher_id: tid, google_event_id: tGcalId,
          })
        }
      }
    } catch (e) {
      console.error('createEvent: google push failed', e)
    }
  })()
}

export async function deleteEvent(eventId: string) {
  const { supabase, userId } = await requireAdmin()

  // Fetch GCal IDs before deletion (FK cascade will remove assignments)
  const { data: ev } = await supabase
    .from('school_events').select('google_event_id').eq('id', eventId).single()
  const { data: assignments } = await supabase
    .from('google_event_assignments')
    .select('teacher_id, google_event_id')
    .eq('school_event_id', eventId)

  // Assignments cascade-delete via FK
  const { error } = await supabase.from('school_events').delete().eq('id', eventId)
  if (error) throw new Error('שגיאה במחיקת האירוע')
  revalidatePath('/admin/calendar')
  revalidatePath('/')

  // Delete from Google Calendars (fire-and-forget)
  void (async () => {
    try {
      if (ev?.google_event_id) await deleteGCalEvent(userId, ev.google_event_id)
      for (const a of assignments ?? []) {
        await deleteGCalEvent(a.teacher_id, a.google_event_id)
      }
    } catch (e) {
      console.error('deleteEvent: google delete failed', e)
    }
  })()
}
