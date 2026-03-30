import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminTeachersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('teachers').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/')

  // Fetch all teachers with group counts
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, email, role, hourly_rate, created_at')
    .order('created_at', { ascending: true })

  const teacherList = teachers ?? []

  // Fetch group counts per teacher
  const { data: groupCounts } = await supabase
    .from('groups')
    .select('teacher_id')

  const countMap: Record<string, number> = {}
  for (const g of groupCounts ?? []) {
    countMap[g.teacher_id] = (countMap[g.teacher_id] ?? 0) + 1
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/admin" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">ניהול</p>
            <h1 className="text-xl font-bold">מורים</h1>
          </div>
        </div>
        <p className="text-sm text-teal-100 mt-1 mr-12">{teacherList.filter(t => t.role === 'teacher').length} מורים פעילים</p>
      </div>

      {/* Teacher list */}
      <div className="px-4 py-5 flex flex-col gap-3">
        {/* Invite note */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs text-blue-600 leading-relaxed">
            להוספת מורה חדש — שלח/י לו את קישור האפליקציה. לאחר ההרשמה יופיע כאן ותוכלי להגדיר את התעריף.
          </p>
        </div>

        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">רשימת מורים</p>

        {teacherList.filter(t => t.role === 'teacher').map(teacher => (
          <Link
            key={teacher.id}
            href={`/admin/teachers/${teacher.id}`}
            className="bg-white rounded-2xl shadow-sm px-4 py-3.5 flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <div className="w-11 h-11 rounded-2xl bg-teal-500 flex items-center justify-center text-white font-bold text-base shrink-0">
              {teacher.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{teacher.name}</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{teacher.email}</p>
            </div>
            <div className="text-left shrink-0 flex flex-col items-end gap-1">
              <span className="text-sm font-bold text-teal-600">
                ₪{teacher.hourly_rate > 0 ? teacher.hourly_rate : '—'}
              </span>
              <span className="text-[10px] text-gray-400">{countMap[teacher.id] ?? 0} קבוצות</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
        ))}

        {teacherList.filter(t => t.role === 'teacher').length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">אין מורים עדיין</p>
            <p className="text-xs mt-1">שתפי את קישור האפליקציה עם המורים</p>
          </div>
        )}
      </div>
    </div>
  )
}
