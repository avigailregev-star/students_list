'use server'

import { revalidatePath } from 'next/cache'
import { revalidatePayroll } from '@/lib/payroll/revalidate'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function approveLesson(lessonId: string) {
  await requireAdmin('/admin')
  const supabase = createAdminClient()
  const { error } = await supabase.from('lessons').update({ admin_approval_status: 'approved' }).eq('id', lessonId)
  if (error) throw new Error('שגיאה באישור יום המחלה')
  revalidatePath('/admin/sick-leave')
  revalidatePayroll()
}

export async function rejectLesson(lessonId: string) {
  await requireAdmin('/admin')
  const supabase = createAdminClient()
  const { error } = await supabase.from('lessons')
    .update({ admin_approval_status: 'rejected', is_sick_leave: false })
    .eq('id', lessonId)
  if (error) throw new Error('שגיאה בדחיית יום המחלה')
  revalidatePath('/admin/sick-leave')
  revalidatePayroll()
}
