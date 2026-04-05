import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGroupsWithSchedules } from '@/lib/queries/groups'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (teacher?.role === 'admin') redirect('/admin')

  const groups = await getGroupsWithSchedules()

  return (
    <DashboardClient
      groups={groups}
      teacherName={teacher?.name ?? 'מורה'}
    />
  )
}
