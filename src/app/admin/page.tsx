import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if ((user.user_metadata as Record<string,string>)?.role !== 'admin') redirect('/')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('name')
    .eq('id', user.id)
    .single()

  const [{ count: teacherCount }, { count: groupCount }, { count: pendingCount }] = await Promise.all([
    supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
    supabase.from('groups').select('*', { count: 'exact', head: true }),
    supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('admin_approval_status', 'pending'),
  ])

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-8">
        <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest mb-1">ניהול בית ספר</p>
        <h1 className="text-2xl font-bold">שלום, {teacher?.name ?? 'מנהל'}</h1>
        <p className="text-sm text-teal-100 mt-0.5">לוח בקרה ראשי</p>
      </div>

      <div className="px-4 py-5 flex flex-col gap-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-teal-500">{teacherCount ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">מורים פעילים</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-violet-500">{groupCount ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">קבוצות</p>
          </div>
        </div>

        {/* Pending sick leave */}
        {(pendingCount ?? 0) > 0 && (
          <a href="/admin/sick-leave" className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-700">{pendingCount} בקשות מחלה ממתינות לאישור</p>
              <p className="text-xs text-amber-500">לחצי לאישור</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </a>
        )}

        {/* Quick links */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">קיצורי דרך</p>
          {[
            { href: '/admin/teachers', label: 'ניהול מורים ושכר', color: 'bg-teal-500', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
            { href: '/admin/calendar', label: 'לוח שנה שנתי וחגים', color: 'bg-violet-500', icon: 'M3 4h18v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4zM16 2v4M8 2v4M3 10h18' },
            { href: '/admin/payroll', label: 'דוחות שכר חודשיים', color: 'bg-emerald-500', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
          ].map(item => (
            <a key={item.href} href={item.href} className="bg-white rounded-2xl shadow-sm px-4 py-3.5 flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className={`w-9 h-9 ${item.color} rounded-xl flex items-center justify-center shrink-0`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon}/>
                </svg>
              </div>
              <span className="text-sm font-semibold text-gray-800">{item.label}</span>
              <svg className="mr-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
