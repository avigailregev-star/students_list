import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDateHe } from '@/lib/utils/hebrew'
import ApprovalButtons from './ApprovalButtons'

export default async function AdminSickLeavePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if ((user.user_metadata as Record<string,string>)?.role !== 'admin') redirect('/')

  // Fetch all sick leave lessons with group+teacher info
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, date, teacher_absence_reason, admin_approval_status, groups(name, teacher_id, teachers(name))')
    .eq('is_sick_leave', true)
    .order('date', { ascending: false })

  const pending = (lessons ?? []).filter(l => l.admin_approval_status === 'pending')
  const decided = (lessons ?? []).filter(l => l.admin_approval_status !== 'pending')

  function LessonRow({ lesson, showActions }: { lesson: typeof pending[0]; showActions: boolean }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const group = (lesson.groups as any) as { name: string; teacher_id: string; teachers: { name: string } | null } | null
    const date = new Date(lesson.date + 'T12:00:00')
    return (
      <div className="bg-white rounded-2xl shadow-sm px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">{group?.teachers?.name ?? '—'}</p>
            <p className="text-xs text-gray-400 mt-0.5">{group?.name} · {formatDateHe(date)}</p>
            <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded-lg px-2 py-1 inline-block">
              {lesson.teacher_absence_reason}
            </p>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl shrink-0 ${
            lesson.admin_approval_status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
            lesson.admin_approval_status === 'rejected' ? 'bg-red-50 text-red-500' :
            'bg-amber-50 text-amber-600'
          }`}>
            {lesson.admin_approval_status === 'approved' ? 'אושר' :
             lesson.admin_approval_status === 'rejected' ? 'נדחה' : 'ממתין'}
          </span>
        </div>
        {showActions && <ApprovalButtons lessonId={lesson.id} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">ניהול</p>
            <h1 className="text-xl font-bold">בקשות מחלה</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 flex flex-col gap-4">
        {/* Pending */}
        {pending.length > 0 && (
          <div>
            <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">
              ממתינות לאישור ({pending.length})
            </p>
            <div className="flex flex-col gap-2">
              {pending.map(l => <LessonRow key={l.id} lesson={l} showActions={true} />)}
            </div>
          </div>
        )}

        {pending.length === 0 && (
          <div className="text-center py-10">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-700">אין בקשות ממתינות</p>
            <p className="text-xs text-gray-400 mt-1">כל הבקשות טופלו</p>
          </div>
        )}

        {/* Decided */}
        {decided.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">היסטוריה</p>
            <div className="flex flex-col gap-2">
              {decided.map(l => <LessonRow key={l.id} lesson={l} showActions={false} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
