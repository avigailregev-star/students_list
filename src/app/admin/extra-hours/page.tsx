import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import ExtraHoursAdminClient from './ExtraHoursAdminClient'
import type { ExtraHoursRequestWithTeacher } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function ExtraHoursAdminPage() {
  await requireAdmin()
  const supabase = createAdminClient()
  const [{ data: requests }, { data: teachers }] = await Promise.all([
    supabase.from('extra_hours_requests').select('*, teachers(name)').order('created_at', { ascending: false }),
    supabase.from('teachers').select('id, name').neq('role', 'admin').order('name'),
  ])
  return <div className="min-h-screen"><header className="bg-gradient-to-bl from-violet-500 to-violet-700 text-white rounded-b-[36px] shadow-lg shadow-violet-200 px-5 pt-10 pb-7"><p className="text-xs font-semibold text-violet-100 uppercase tracking-widest">ניהול</p><h1 className="text-2xl font-bold">שעות נוספות</h1><p className="text-sm text-violet-100 mt-1">אישור בקשות והוספה לדיווח החודשי</p></header><ExtraHoursAdminClient initialRequests={(requests ?? []) as ExtraHoursRequestWithTeacher[]} teachers={(teachers ?? []) as { id: string; name: string }[]} /></div>
}
