import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import PayrollView from '@/app/reports/payroll/PayrollView'
import BottomNav from '@/components/layout/BottomNav'

import { loadPayroll } from '@/lib/payroll/load'

interface Props { params: Promise<{ id: string }> }

export default async function AdminTeacherReportsPage({ params }: Props) {
  const { id } = await params
  await requireAdmin()
  const supabase = createAdminClient()

  const [{ data: teacher, error }, months] = await Promise.all([
    supabase.from('teachers').select('name').eq('id', id).single(),
    loadPayroll(supabase, id),
  ])
  if (error) throw error
  if (!teacher) notFound()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24 print:bg-white print:pb-0">
      <div className="bg-gradient-to-bl from-violet-500 to-violet-700 text-white rounded-b-[36px] shadow-lg shadow-violet-200 px-5 pt-10 pb-7 print:hidden">
        <div className="flex items-center gap-3">
          <Link href={`/admin/teachers/${id}`} className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-violet-100 uppercase tracking-widest">דוח שעות</p>
            <h1 className="text-2xl font-bold">{teacher.name}</h1>
          </div>
        </div>
        <p className="text-sm text-violet-100 mt-1 mr-12">{months.length} חודשים</p>
      </div>

      <PayrollView months={months} teacherName={teacher.name} />
      <BottomNav />
    </div>
  )
}
