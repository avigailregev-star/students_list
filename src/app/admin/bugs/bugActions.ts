'use server'

import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function markResolved(id: string) {
  await requireAdmin()
  const supabase = createAdminClient()
  await supabase.from('bug_reports').update({ status: 'resolved' }).eq('id', id)
  revalidatePath('/admin/bugs')
}
