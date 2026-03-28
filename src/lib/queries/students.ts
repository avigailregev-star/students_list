import { createClient } from '@/lib/supabase/server'
import type { Student } from '@/types/database'

export async function getStudentsByGroup(groupId: string): Promise<Student[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertStudent(student: {
  id?: string
  group_id: string
  name: string
  instrument: string | null
  parent_phone: string | null
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('students').upsert({
    ...student,
    is_active: true,
  })
  if (error) throw error
}

export async function deactivateStudent(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('students')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}
