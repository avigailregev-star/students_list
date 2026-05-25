import AdminNav from '@/components/layout/AdminNav'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createAdminClient()
  const { count, error } = await supabase
    .from('bug_reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new')

  if (error) console.error('[AdminLayout] bug count fetch failed:', error.message)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {children}
      <AdminNav bugsCount={count ?? 0} />
    </div>
  )
}
