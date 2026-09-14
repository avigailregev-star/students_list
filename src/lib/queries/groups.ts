import { createClient } from '@/lib/supabase/server'
import type { GroupWithSchedules } from '@/types/database'

const INDIVIDUAL_LESSON_TYPES = new Set([
  'individual_45',
  'individual_60',
  'melodies_individual',
])

export function hideEmptyIndividualLessons<T extends { lesson_type: string; students?: { is_active?: boolean }[] }>(groups: T[]): T[] {
  return groups.filter(group => (
    !INDIVIDUAL_LESSON_TYPES.has(group.lesson_type)
    || (group.students ?? []).some(student => student.is_active !== false)
  ))
}

export async function getGroupsWithSchedules(): Promise<GroupWithSchedules[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('groups')
    .select('*, group_schedules(*), students(*)')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return hideEmptyIndividualLessons(((data ?? []) as GroupWithSchedules[]).map(group => ({
    ...group,
    students: (group.students ?? []).filter(student => student.is_active),
  })))
}
