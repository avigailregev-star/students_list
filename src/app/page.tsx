import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGroupsWithSchedules } from '@/lib/queries/groups'
import { getEventsForTeacher } from '@/lib/queries/events'
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

  const metaRole = (user.user_metadata as Record<string, string>)?.role
  const isAdmin = metaRole === 'admin' || teacher?.role === 'admin'

  const [groups, events] = await Promise.all([
    getGroupsWithSchedules(),
    getEventsForTeacher(),
  ])

  return (
    <DashboardClient
      groups={groups}
      teacherName={teacher?.name ?? 'מורה'}
      events={events}
      isAdmin={isAdmin}
    />
  )
}
