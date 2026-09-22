import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGroupsWithSchedules } from '@/lib/queries/groups'
import { getEventsForTeacher } from '@/lib/queries/events'
import { getMakeupLessons } from '@/lib/queries/attendance'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function HomePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const isAdmin = teacher?.role === 'admin'

  const [groups, events, makeupSlots] = await Promise.all([
    getGroupsWithSchedules(),
    getEventsForTeacher(),
    getMakeupLessons(),
  ])

  return (
    <DashboardClient
      groups={groups}
      teacherName={teacher?.name ?? 'מורה'}
      events={events}
      isAdmin={isAdmin}
      makeupSlots={makeupSlots}
      userId={user.id}
      initialDate={date}
    />
  )
}
