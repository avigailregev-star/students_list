import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getStudentsByGroup } from '@/lib/queries/students'
import StudentList from '@/components/students/StudentList'
import DeleteGroupButton from './DeleteGroupButton'
import type { Group, GroupSchedule } from '@/types/database'
import { DAYS_HE } from '@/lib/utils/hebrew'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GroupDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase.from('teachers').select('role').eq('id', user.id).single()
  const isAdmin = teacher?.role === 'admin'

  const { data: group, error } = await supabase
    .from('groups')
    .select('*, group_schedules(*)')
    .eq('id', id)
    .eq('teacher_id', user.id)
    .single()

  if (error || !group) notFound()

  const typedGroup = group as Group & { group_schedules: GroupSchedule[] }
  const students = await getStudentsByGroup(id)

  const headerColor = typedGroup.lesson_type === 'group'
    ? 'from-teal-400 to-teal-600 shadow-teal-200'
    : 'from-violet-400 to-violet-600 shadow-violet-200'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-6">
      {/* Header */}
      <div className={`bg-gradient-to-bl ${headerColor} text-white rounded-b-[36px] shadow-lg px-5 pt-8 pb-6`}>
        <div className="flex items-start gap-3 mb-4">
          <Link
            href="/"
            className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{typedGroup.name}</h1>
            <p className="text-sm text-white/70 mt-0.5">
              {typedGroup.lesson_type === 'group' ? 'קבוצה' : 'שיעור יחיד'}
              {typedGroup.is_mangan_school && typedGroup.school_name && (
                <> · {typedGroup.school_name}{typedGroup.grade ? ` כיתה ${typedGroup.grade}` : ''}</>
              )}
            </p>
          </div>
          {isAdmin && <DeleteGroupButton groupId={typedGroup.id} groupName={typedGroup.name} />}
        </div>

        {/* Schedule badges */}
        <div className="flex flex-wrap gap-2">
          {typedGroup.group_schedules.map(s => (
            <span
              key={s.id}
              className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-xl"
            >
              {DAYS_HE[s.day_of_week]} · {s.start_time.slice(0, 5)}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5 max-w-md mx-auto w-full">
        {/* Stats bar */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 bg-white rounded-2xl shadow-sm py-3.5 text-center">
            <p className="text-2xl font-bold text-teal-500">{students.length}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">תלמידים</p>
          </div>
          <Link
            href={`/groups/${id}/attendance`}
            className="flex-1 bg-teal-500 text-white rounded-2xl shadow-sm shadow-teal-200 py-3.5 text-center font-bold text-sm hover:bg-teal-600 transition-colors flex flex-col items-center justify-center gap-1"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-xs">סמן נוכחות</span>
          </Link>
        </div>

        {/* Section title */}
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">תלמידים</h2>

        <StudentList students={students} groupId={id} readOnly={!isAdmin} />
      </div>
    </div>
  )
}
