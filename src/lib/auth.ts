import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Verifies the current user is an admin.
 * Uses only the protected database role. User metadata is user-editable.
 * Redirects to redirectTo if not admin.
 */
export async function requireAdmin(redirectTo = '/') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('role')
    .eq('id', user.id)
    .single()

  if (teacher?.role !== 'admin') redirect(redirectTo.startsWith('/admin') ? '/' : redirectTo)
  return { supabase, user }
}
