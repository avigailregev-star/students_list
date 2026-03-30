'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: t } = await supabase.from('teachers').select('role').eq('id', user.id).single()
  if (t?.role !== 'admin') redirect('/admin')
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
