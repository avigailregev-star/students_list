import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RedirectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const role = (user.user_metadata as Record<string, string>)?.role ?? 'teacher'
  redirect(role === 'admin' ? '/admin' : '/')
}
