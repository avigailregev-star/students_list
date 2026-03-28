import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getStudentsByGroup } from '@/lib/queries/students'
import StudentList from '@/components/students/StudentList'
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

  const { data: group, error } = await supabase
    .from('groups')
    .select('*, group_schedules(*)')
    .eq('id', id)
    .eq('teacher_id', user.id)
    .single()

  if (error || !group) notFound()

  const typedGroup = group as Group & { group_schedules: GroupSchedule[] }
  const students = await getStudentsByGroup(id)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-6">
      {/* Header */}
      <div className="bg-gradient-to-l from-indigo-500 to-purple-600 text-white px-4 py-5">
        <div className="flex items-start gap-3 mb-3">
          <Link
            href="/"
            className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-lg shrink-0"
          >
            ←
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{typedGroup.name}</h1>
            <p className="text-sm opacity-80 mt-0.5">
              {typedGroup.lesson_type === 'group' ? 'קבוצה' : 'שיעור יחיד'}
              {typedGroup.is_mangan_school && typedGroup.school_name && (
                <> · 🏫 {typedGroup.school_name}{typedGroup.grade ? ` כיתה ${typedGroup.grade}` : ''}</>
              )}
            </p>
          </div>
        </div>

        {/* Schedule badges */}
        <div className="flex flex-wrap gap-2 mt-2">
          {typedGroup.group_schedules.map(s => (
            <span
              key={s.id}
              className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full"
            >
              📅 {DAYS_HE[s.day_of_week]} {s.start_time.slice(0, 5)}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5 max-w-md mx-auto w-full">
        {/* Stats bar */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 bg-white border border-gray-100 rounded-xl py-3 text-center">
            <p className="text-2xl font-bold text-indigo-600">{students.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">תלמידים</p>
          </div>
          <Link
            href={`/groups/${id}/attendance`}
            className="flex-1 bg-indigo-600 text-white rounded-xl py-3 text-center font-semibold text-sm hover:bg-indigo-700 transition-colors flex flex-col items-center justify-center gap-0.5"
          >
            <span className="text-lg">✓</span>
            <span className="text-xs">סמן נוכחות</span>
          </Link>
        </div>

        {/* Section title */}
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
          תלמידים
        </h2>

        <StudentList students={students} groupId={id} />
      </div>
    </div>
  )
}
