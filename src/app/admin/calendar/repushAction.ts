'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushSchoolEvent, updateSchoolEvent } from '@/lib/googleCalendar'

export async function repushAllEvents(): Promise<{ count: number }> {
  const { user } = await _requireAdmin('/admin')
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: events } = await admin
    .from('school_events')
    .select('id, name, start_date, end_date, google_event_id')
    .gte('end_date', today)

  let count = 0
  for (const ev of events ?? []) {
    if (ev.google_event_id) {
      await updateSchoolEvent(user.id, ev.google_event_id, {
        id: ev.id, name: ev.name, startDate: ev.start_date, endDate: ev.end_date,
      })
    } else {
      const gcalId = await pushSchoolEvent(user.id, {
        id: ev.id, name: ev.name, startDate: ev.start_date, endDate: ev.end_date,
      })
      if (gcalId) {
        await admin.from('school_events').update({ google_event_id: gcalId }).eq('id', ev.id)
      }
    }
    count++
  }

  revalidatePath('/admin/calendar')
  return { count }
}
