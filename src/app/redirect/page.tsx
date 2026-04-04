import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RedirectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: teacher } = await supabase
    .from('teachers')
    .select('role')
    .eq('id', user.id)
    .single()
  redirect(teacher?.role === 'admin' ? '/admin' : '/')
}
