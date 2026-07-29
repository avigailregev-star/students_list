'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { syncStudentAdded, syncStudentRemoved } from '@/lib/syncToRegistrations'

export async function saveStudent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const groupId = formData.get('group_id') as string
  const studentId = formData.get('student_id') as string | null
  const name = formData.get('name') as string
  const instrument = formData.get('instrument') as string
  const parentPhone = formData.get('parent_phone') as string

  if (studentId) {
    const { data: existing } = await supabase
      .from('students')
      .select('id, groups!inner(teacher_id)')
      .eq('id', studentId)
      .single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!existing || (existing.groups as any).teacher_id !== user.id) throw new Error('תלמיד לא נמצא')

    const { error } = await supabase.from('students').update({
      name, instrument: instrument || null, parent_phone: parentPhone || null,
    }).eq('id', studentId)
    if (error) throw new Error('שגיאה בעדכון התלמיד')
  } else {
    const { data: group } = await supabase
      .from('groups')
      .select('id')
      .eq('id', groupId)
      .eq('teacher_id', user.id)
      .single()
    if (!group) throw new Error('קבוצה לא נמצאה')

    const { error } = await supabase.from('students').insert({
      group_id: groupId, name, instrument: instrument || null, parent_phone: parentPhone || null, is_active: true,
    })
    if (error) throw new Error('שגיאה בהוספת התלמיד')
    await syncStudentAdded({ groupId, studentName: name, instrument: instrument || null, parentPhone: parentPhone || null })
  }

  revalidatePath(`/groups/${groupId}`)
}

export async function removeStudent(studentId: string, groupId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase
    .from('students')
    .select('name, groups!inner(teacher_id)')
    .eq('id', studentId)
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!student || (student.groups as any).teacher_id !== user.id) throw new Error('תלמיד לא נמצא')

  const { error } = await supabase
    .from('students')
    .update({ is_active: false })
    .eq('id', studentId)
  if (error) throw new Error('שגיאה במחיקת התלמיד')

  if (student?.name) await syncStudentRemoved({ studentName: student.name, groupId })

  revalidatePath(`/groups/${groupId}`)
}

export async function deleteGroup(groupId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .eq('teacher_id', user.id)
    .single()

  if (!group) throw new Error('קבוצה לא נמצאה')

  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId)

  if (error) throw error

  revalidatePath('/')
  redirect('/')
}
