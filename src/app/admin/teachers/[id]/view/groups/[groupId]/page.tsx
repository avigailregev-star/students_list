import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import StudentList from '@/components/students/StudentList'
import type { Group, GroupSchedule, Student } from '@/types/database'
import { DAYS_HE } from '@/lib/utils/hebrew'
import ViewOnlyBanner from '../../ViewOnlyBanner'
import ViewNav from '../../ViewNav'

interface Props {
  params: Promise<{ id: string; groupId: string }>
}

export default async function AdminTeacherViewGroupPage({ params }: Props) {
  const { id, groupId } = await params
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: group, error } = await supabase
    .from('groups')
    .select('*, group_schedules(*)')
    .eq('id', groupId)
    .eq('teacher_id', id)
    .single()

  if (error || !group) notFound()

  const typedGroup = group as Group & { group_schedules: GroupSchedule[] }

  const { data: studentsRaw } = await supabase
    .from('students')
    .select('*')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('name')
  const students = (studentsRaw ?? []) as Student[]

  const headerColor = typedGroup.lesson_type === 'group'
    ? 'from-teal-400 to-teal-600 shadow-teal-200'
    : 'from-violet-400 to-violet-600 shadow-violet-200'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <ViewOnlyBanner teacherId={id} />
      <div className={`bg-gradient-to-bl ${headerColor} text-white rounded-b-[36px] shadow-lg px-5 pt-8 pb-6`}>
        <h1 className="text-xl font-bold truncate">{typedGroup.name}</h1>
        <p className="text-sm text-white/70 mt-0.5">
          {typedGroup.lesson_type === 'group' ? 'קבוצה' : 'שיעור יחיד'}
          {typedGroup.is_mangan_school && typedGroup.school_name && (
            <> · {typedGroup.school_name}{typedGroup.grade ? ` כיתה ${typedGroup.grade}` : ''}</>
          )}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {typedGroup.group_schedules.map(s => (
            <span key={s.id} className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-xl">
              {DAYS_HE[s.day_of_week]} · {s.start_time.slice(0, 5)}
            </span>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 max-w-md mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-sm py-3.5 text-center mb-5">
          <p className="text-2xl font-bold text-teal-500">{students.length}</p>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">תלמידים</p>
        </div>

        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">תלמידים</h2>
        <StudentList students={students} groupId={groupId} readOnly />
      </div>

      <ViewNav teacherId={id} />
    </div>
  )
}
