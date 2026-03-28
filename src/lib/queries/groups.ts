import { createClient } from '@/lib/supabase/server'
import type { GroupWithSchedules } from '@/types/database'

export async function getGroupsWithSchedules(): Promise<GroupWithSchedules[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('groups')
    .select('*, group_schedules(*)')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as GroupWithSchedules[]
}
