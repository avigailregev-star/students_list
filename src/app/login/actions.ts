'use server'

import { createClient } from '@/lib/supabase/server'

export async function getPostLoginRedirect(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return '/login'

  const { data: teacher } = await supabase
    .from('teachers')
    .select('role')
    .eq('id', user.id)
    .single()

  return teacher?.role === 'admin' ? '/admin' : '/'
}
