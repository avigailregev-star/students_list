import Link from 'next/link'
import PayrollClient from './PayrollClient'
import { requireAdmin } from '@/lib/auth'

export default async function AdminPayrollPage() {
  const { supabase } = await requireAdmin()

  // Fetch all teachers
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, hourly_rate')
    .eq('role', 'teacher')
    .order('name')

  // Fetch all groups (to map teacher → groups)
  const { data: groups } = await supabase
    .from('groups')
    .select('id, teacher_id')

  // Fetch all lessons with status
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, group_id, date, status')

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
            <h1 className="text-xl font-bold">שכר חודשי</h1>
          </div>
        </div>
      </div>

      <PayrollClient
        teachers={teachers ?? []}
        groups={groups ?? []}
        lessons={lessons ?? []}
      />
    </div>
  )
}
