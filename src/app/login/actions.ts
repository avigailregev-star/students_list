'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function transferTeacherGroups(oldId: string, newId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('groups').update({ teacher_id: newId }).eq('teacher_id', oldId)
}
