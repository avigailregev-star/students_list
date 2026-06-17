import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { resolveAlert } from './alertActions'

export const dynamic = 'force-dynamic'

export default async function GoogleAlertsPage() {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: alerts } = await admin
    .from('google_sync_alerts')
    .select(`
      id, type, created_at, resolved,
      teachers:teacher_id ( name ),
      lessons:lesson_id ( date, start_time, group_id )
    `)
    .eq('resolved', false)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">ניהול</p>
            <h1 className="text-xl font-bold">התראות יומן גוגל</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 flex flex-col gap-3">
        {(!alerts || alerts.length === 0) && (
          <div className="bg-white rounded-2xl shadow-sm px-4 py-6 text-center text-sm text-gray-400 font-semibold">
            אין התראות פתוחות ✓
          </div>
        )}
        {(alerts ?? []).map(alert => {
          const teacher = (alert.teachers as unknown) as { name: string } | null
          const lesson = (alert.lessons as unknown) as { date: string; start_time: string } | null
          return (
            <div key={alert.id} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{teacher?.name ?? '—'}</p>
                <p className="text-xs text-gray-400">
                  שיעור ב-{lesson?.date ?? '—'} — נמחק ביומן גוגל
                </p>
              </div>
              <form action={resolveAlert.bind(null, alert.id)}>
                <button type="submit" className="text-xs font-bold text-teal-500 px-3 py-1.5 bg-teal-50 rounded-xl hover:bg-teal-100 transition-colors whitespace-nowrap">
                  סמן כטופל
                </button>
              </form>
            </div>
          )
        })}
      </div>
    </div>
  )
}
