import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NewGroupForm from './NewGroupForm'

export default async function NewGroupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('role')
    .eq('id', user.id)
    .single()

  if (teacher?.role !== 'admin') redirect('/')

  return <NewGroupForm />
}
