import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import MarkResolvedButton from './MarkResolvedButton'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'עכשיו'
  if (minutes < 60) return `לפני ${minutes} דקות`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `לפני ${hours} שעות`
  const days = Math.floor(hours / 24)
  return `לפני ${days} ימים`
}

export default async function AdminBugsPage() {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: reports } = await supabase
    .from('bug_reports')
    .select('id, teacher_name, page_url, error_message, user_description, status, created_at')
    .order('created_at', { ascending: false })

  const newCount = (reports ?? []).filter(r => r.status === 'new').length

  return (
    <div className="min-h-screen bg-gray-50 pb-24 px-4 pt-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">דיווחי באגים</h1>
          {newCount > 0 && (
            <p className="text-sm text-red-500 font-medium mt-0.5">{newCount} דיווחים חדשים</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {(reports ?? []).map(report => (
            <div
              key={report.id}
              className={`bg-white rounded-2xl shadow-sm px-4 py-4 ${
                report.status === 'new' ? 'border-r-4 border-red-400' : 'opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-gray-900">
                      {report.teacher_name ?? 'לא ידוע'}
                    </span>
                    {report.status === 'new' && (
                      <span className="text-[10px] font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded-xl">
                        חדש
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 font-mono bg-gray-50 rounded-lg px-2 py-1 mb-2 line-clamp-2">
                    {report.error_message}
                  </p>

                  {report.user_description && (
                    <p className="text-xs text-gray-600 italic mb-2">
                      ״{report.user_description}״
                    </p>
                  )}

                  <p className="text-[10px] text-gray-400">{report.page_url}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(report.created_at)}</p>
                </div>

                {report.status === 'new' && <MarkResolvedButton id={report.id} />}
              </div>
            </div>
          ))}

          {(reports ?? []).length === 0 && (
            <p className="text-center text-gray-400 text-sm py-12">אין דיווחי באגים 🎉</p>
          )}
        </div>
      </div>
    </div>
  )
}
