import AdminNav from '@/components/layout/AdminNav'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('bug_reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new')

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {children}
      <AdminNav bugsCount={count ?? 0} />
    </div>
  )
}
