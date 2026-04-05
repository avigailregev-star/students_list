import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Verifies the current user is an admin.
 * Checks user_metadata first (fast), falls back to teachers table (reliable).
 * Redirects to redirectTo if not admin.
 */
export async function requireAdmin(redirectTo = '/') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const metaRole = (user.user_metadata as Record<string, string>)?.role
  if (metaRole === 'admin') return { supabase, user }

  // Fallback: read from teachers table (handles stale JWT)
  const { data: teacher } = await supabase
    .from('teachers')
    .select('role')
    .eq('id', user.id)
    .single()

  if (teacher?.role !== 'admin') redirect(redirectTo)
  return { supabase, user }
}
