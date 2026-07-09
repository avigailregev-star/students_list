import AdminNav from '@/components/layout/AdminNav'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createAdminClient()

  const [
    { count: bugsCount, error: bugsError },
    { count: messagesCount, error: messagesError },
    { count: vacationsCount, error: vacationsError },
  ] = await Promise.all([
    supabase.from('bug_reports').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('from_admin', false),
    supabase.from('vacation_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  if (bugsError) console.error('[AdminLayout] bug count fetch failed:', bugsError.message)
  if (messagesError) console.error('[AdminLayout] messages count fetch failed:', messagesError.message)
  if (vacationsError) console.error('[AdminLayout] vacations count fetch failed:', vacationsError.message)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {children}
      <AdminNav
        messagesCount={(messagesCount ?? 0) + (vacationsCount ?? 0) + (bugsCount ?? 0)}
      />
    </div>
  )
}
