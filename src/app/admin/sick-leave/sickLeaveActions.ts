'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function approveLesson(lessonId: string) {
  await requireAdmin('/admin')
  const supabase = createAdminClient()
  await supabase.from('lessons').update({ admin_approval_status: 'approved' }).eq('id', lessonId)
  revalidatePath('/admin/sick-leave')
}

export async function rejectLesson(lessonId: string) {
  await requireAdmin('/admin')
  const supabase = createAdminClient()
  await supabase.from('lessons')
    .update({ admin_approval_status: 'rejected', is_sick_leave: false })
    .eq('id', lessonId)
  revalidatePath('/admin/sick-leave')
}
