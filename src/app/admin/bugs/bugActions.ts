'use server'

import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function markResolved(id: string) {
  await requireAdmin('/admin')
  if (!UUID_RE.test(id)) throw new Error('מזהה לא תקין')

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('bug_reports')
    .update({ status: 'resolved' })
    .eq('id', id)
  if (error) throw new Error('שגיאה בעדכון הדיווח')

  revalidatePath('/admin/bugs')
  revalidatePath('/admin', 'layout')
}
