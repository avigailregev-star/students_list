import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import DashboardClient from '@/components/dashboard/DashboardClient'
import ViewOnlyBanner from './ViewOnlyBanner'
import ViewNav from './ViewNav'
import type { GroupWithSchedules, LessonSlot, SchoolEvent } from '@/types/database'

interface Props { params: Promise<{ id: string }> }

export default async function AdminTeacherViewDashboardPage({ params }: Props) {
  const { id } = await params
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: teacher } = await supabase.from('teachers').select('name').eq('id', id).single()
  if (!teacher) notFound()

  const [{ data: groupsRaw }, { data: autoEvents }, { data: assignedRows }] = await Promise.all([
    supabase.from('groups').select('*, group_schedules(*)').eq('teacher_id', id).order('created_at', { ascending: true }),
    supabase.from('school_events').select('*').in('event_type', ['holiday', 'vacation']),
    supabase.from('school_event_assignments').select('event_id').eq('teacher_id', id),
  ])

  const groups = (groupsRaw ?? []) as GroupWithSchedules[]

  const assignedIds = (assignedRows ?? []).map((r: { event_id: string }) => r.event_id)
  let assignedEvents: SchoolEvent[] = []
  if (assignedIds.length > 0) {
    const { data } = await supabase.from('school_events').select('*').in('id', assignedIds)
    assignedEvents = (data ?? []) as SchoolEvent[]
  }
  const seenEventIds = new Set<string>()
  const events: SchoolEvent[] = []
  for (const ev of [...((autoEvents ?? []) as SchoolEvent[]), ...assignedEvents]) {
    if (!seenEventIds.has(ev.id)) {
      seenEventIds.add(ev.id)
      events.push(ev)
    }
  }

  const { data: makeupRows } = await supabase
    .from('lessons')
    .select('id, group_id, date, start_time, groups!inner(teacher_id, name, lesson_type, is_mangan_school, school_name, grade)')
    .eq('is_makeup', true)
    .eq('status', 'scheduled')
    .eq('groups.teacher_id', id)

  const makeupSlots: LessonSlot[] = (makeupRows ?? []).map((row: any) => {
    const d = new Date(row.date + 'T12:00:00')
    return {
      groupId: row.group_id,
      groupName: row.groups.name,
      lessonType: row.groups.lesson_type,
      isMangan: row.groups.is_mangan_school,
      schoolName: row.groups.school_name,
      grade: row.groups.grade,
      date: d,
      startTime: row.start_time.slice(0, 5),
      dayOfWeek: d.getDay(),
      isMakeup: true,
    }
  })

  return (
    <>
      <ViewOnlyBanner teacherId={id} />
      <DashboardClient
        groups={groups}
        teacherName={teacher.name}
        events={events}
        makeupSlots={makeupSlots}
        viewOnly
      />
      <ViewNav teacherId={id} />
    </>
  )
}
