'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin as _requireAdmin } from '@/lib/auth'

async function requireAdmin() {
  const { supabase } = await _requireAdmin('/admin')
  return supabase
}

export async function approveLesson(lessonId: string) {
  const supabase = await requireAdmin()
  await supabase.from('lessons').update({ admin_approval_status: 'approved' }).eq('id', lessonId)
  revalidatePath('/admin/sick-leave')
}

export async function rejectLesson(lessonId: string) {
  const supabase = await requireAdmin()
  await supabase.from('lessons')
    .update({ admin_approval_status: 'rejected', is_sick_leave: false })
    .eq('id', lessonId)
  revalidatePath('/admin/sick-leave')
}
