import { createClient } from '@/lib/supabase/server'
import type { Teacher } from '@/types/database'

export async function getTeachersForAdmin(): Promise<Teacher[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('teachers')
    .select('id, name, email, phone, role, created_at')
    .eq('role', 'teacher')
    .order('name', { ascending: true })
  return (data ?? []) as Teacher[]
}
