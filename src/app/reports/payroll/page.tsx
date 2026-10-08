import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PayrollView from './PayrollView'
import { loadPayroll } from '@/lib/payroll/load'
export type { DayCount, MonthPayroll } from '@/lib/payroll/calculate'
import BottomNav from '@/components/layout/BottomNav'

export default async function PayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: teacherData, error }, months] = await Promise.all([
    supabase.from('teachers').select('name').eq('id', user.id).single(),
    loadPayroll(supabase, user.id),
  ])
  if (error) throw error
  const teacherName = teacherData?.name ?? ''

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24 print:bg-white print:pb-0">
      <div className="bg-gradient-to-bl from-violet-500 to-violet-700 text-white rounded-b-[36px] shadow-lg shadow-violet-200 px-5 pt-10 pb-7 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-violet-100 uppercase tracking-widest">ייצוא</p>
            <h1 className="text-2xl font-bold">דוח שעות</h1>
          </div>
        </div>
        <p className="text-sm text-violet-100 mt-1 mr-12">{teacherName} · {months.length} חודשים</p>
      </div>

      <PayrollView months={months} teacherName={teacherName} />
      <BottomNav />
    </div>
  )
}
