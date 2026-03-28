'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function saveStudent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const groupId = formData.get('group_id') as string
  const studentId = formData.get('student_id') as string | null
  const name = formData.get('name') as string
  const instrument = (formData.get('instrument') as string) || null
  const parentPhone = (formData.get('parent_phone') as string) || null

  const payload: Record<string, unknown> = {
    group_id: groupId,
    name,
    instrument,
    parent_phone: parentPhone,
    is_active: true,
  }
  if (studentId) payload.id = studentId

  const { error } = await supabase.from('students').upsert(payload)
  if (error) throw error

  revalidatePath(`/groups/${groupId}`)
}

export async function removeStudent(studentId: string, groupId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('students')
    .update({ is_active: false })
    .eq('id', studentId)
  if (error) throw error

  revalidatePath(`/groups/${groupId}`)
}
