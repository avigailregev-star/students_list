// src/app/admin/messages/vacationActions.ts
'use server'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { pushSchoolEvent } from '@/lib/googleCalendar'

async function requireAdmin() {
  const { supabase } = await _requireAdmin('/admin')
  return { supabase }
}

export async function decideVacationRequest(
  id: string,
  status: 'approved' | 'rejected',
  adminNote?: string,
): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('vacation_requests')
    .update({
      status,
      admin_note: adminNote?.trim() || null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: 'שגיאה בעדכון הבקשה: ' + error.message }
  revalidatePath('/admin/messages')

  if (status === 'approved') {
    void (async () => {
      try {
        const admin = createAdminClient()
        const { data: req } = await admin
          .from('vacation_requests')
          .select('teacher_id, start_date, end_date')
          .eq('id', id)
          .single()
        if (req) {
          await pushSchoolEvent(req.teacher_id, {
            id: `vacation-${id}`,
            name: 'חופשה מאושרת',
            startDate: req.start_date,
            endDate: req.end_date,
          })
        }
      } catch (e) {
        console.error('decideVacationRequest: google push failed', e)
      }
    })()
  }

  return {}
}
