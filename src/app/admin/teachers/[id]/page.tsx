import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import EditTeacherForm from './EditTeacherForm'

interface Props { params: Promise<{ id: string }> }

export default async function TeacherDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('teachers').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, name, email, role, hourly_rate, created_at')
    .eq('id', id)
    .single()

  if (!teacher) notFound()

  // Fetch groups with student counts
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, lesson_type, is_mangan_school, school_name, grade')
    .eq('teacher_id', id)
    .order('created_at', { ascending: true })

  // Fetch lesson stats for this teacher
  const { count: completedLessons } = await supabase
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .in('group_id', (groups ?? []).map(g => g.id))
    .eq('status', 'completed')

  const { count: canceledLessons } = await supabase
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .in('group_id', (groups ?? []).map(g => g.id))
    .eq('status', 'teacher_canceled')

  const totalPay = (completedLessons ?? 0) * teacher.hourly_rate

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
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

      <div className="px-4 py-5 flex flex-col gap-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'קבוצות', value: groups?.length ?? 0, color: 'text-teal-600' },
            { label: 'שיעורים', value: completedLessons ?? 0, color: 'text-emerald-500' },
            { label: 'ביטולים', value: canceledLessons ?? 0, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl shadow-sm py-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Pay summary */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-600 font-medium">תעריף: ₪{teacher.hourly_rate}/שעה</p>
            <p className="text-lg font-bold text-emerald-700 mt-0.5">סה״כ שכר: ₪{totalPay.toLocaleString()}</p>
          </div>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>

        {/* Edit form */}
        <EditTeacherForm
          teacherId={teacher.id}
          initialName={teacher.name}
          initialRate={teacher.hourly_rate}
        />

        {/* Groups */}
        {(groups ?? []).length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">קבוצות</p>
            <div className="flex flex-col gap-2">
              {(groups ?? []).map(g => (
                <div key={g.id} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                    g.lesson_type === 'group' ? 'bg-teal-500' : 'bg-violet-500'
                  }`}>
                    {g.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{g.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {g.lesson_type === 'group' ? 'קבוצה' : 'יחיד'}
                      {g.is_mangan_school && g.school_name && ` · ${g.school_name}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
