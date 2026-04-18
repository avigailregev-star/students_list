import Link from 'next/link'
import CalendarClient from './CalendarClient'
import type { SchoolEvent, Teacher } from '@/types/database'
import { requireAdmin } from '@/lib/auth'
import { getTeachersForAdmin } from '@/lib/queries/teachers'

export default async function AdminCalendarPage() {
  const { supabase } = await requireAdmin()

  const [eventsResult, teachers] = await Promise.all([
    supabase
      .from('school_events')
      .select('*')
      .order('start_date', { ascending: true }),
    getTeachersForAdmin(),
  ])

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
            <h1 className="text-xl font-bold">לוח שנה שנתי</h1>
          </div>
        </div>
        <p className="text-sm text-teal-100 mt-2 mr-12">לחצי על יום להוספת אירוע</p>
      </div>

      <CalendarClient
        events={(eventsResult.data ?? []) as SchoolEvent[]}
        teachers={teachers}
      />
    </div>
  )
}
