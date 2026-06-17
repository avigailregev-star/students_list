// src/app/admin/messages/vacationActions.ts
'use server'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

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
  return {}
}
