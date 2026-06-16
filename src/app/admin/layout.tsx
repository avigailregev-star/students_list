import AdminNav from '@/components/layout/AdminNav'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createAdminClient()

  const [{ count: bugsCount, error: bugsError }, { count: messagesCount, error: messagesError }] =
    await Promise.all([
      supabase.from('bug_reports').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('messages').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ])

  if (bugsError) console.error('[AdminLayout] bug count fetch failed:', bugsError.message)
  if (messagesError) console.error('[AdminLayout] messages count fetch failed:', messagesError.message)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {children}
      <AdminNav bugsCount={bugsCount ?? 0} messagesCount={messagesCount ?? 0} />
    </div>
  )
}
