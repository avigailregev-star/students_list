import { notFound } from 'next/navigation'
import Link from 'next/link'
import EditTeacherForm from './EditTeacherForm'
import AdminTeacherTabs from './AdminTeacherTabs'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { GroupWithSchedulesAndStudents } from '@/types/database'

interface Props { params: Promise<{ id: string }> }

export default async function TeacherDetailPage({ params }: Props) {
  const { id } = await params
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, name, email, role, created_at')
    .eq('id', id)
    .single()

  if (!teacher) notFound()

  const { data: groupsRaw } = await supabase
    .from('groups')
    .select('*, group_schedules(*), students(*)')
    .eq('teacher_id', id)
    .order('created_at', { ascending: true })

  const groups = (groupsRaw ?? []) as GroupWithSchedulesAndStudents[]

  const groupIds = groups.map(g => g.id)

  const [{ count: completedLessons }, { count: canceledLessons }] = groupIds.length > 0
    ? await Promise.all([
        supabase.from('lessons').select('id', { count: 'exact', head: true })
          .in('group_id', groupIds).eq('status', 'completed'),
        supabase.from('lessons').select('id', { count: 'exact', head: true })
          .in('group_id', groupIds).eq('status', 'teacher_canceled'),
      ])
    : [{ count: 0 }, { count: 0 }]

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/admin/teachers" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white font-bold text-xl shrink-0">
            {teacher.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{teacher.name}</h1>
            <p className="text-sm text-teal-100 truncate">{teacher.email}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 flex flex-col gap-4 pb-24">
        <EditTeacherForm teacherId={teacher.id} initialName={teacher.name} />
        <AdminTeacherTabs
          teacherId={teacher.id}
          groups={groups}
          completedLessons={completedLessons ?? 0}
          canceledLessons={canceledLessons ?? 0}
        />
      </div>
    </div>
  )
}
