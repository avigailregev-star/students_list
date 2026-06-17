import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { initiateGoogleConnect, disconnectGoogle } from './googleActions'
import SyncButton from './SyncButton'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const admin = createAdminClient()
  const { data: token } = await admin
    .from('google_tokens').select('calendar_id').eq('user_id', user.id).single()

  const isConnected = !!token

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">הגדרות</p>
            <h1 className="text-xl font-bold">יומן גוגל</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 flex flex-col gap-4">
        {params.connected === '1' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm font-semibold text-emerald-700">
            יומן גוגל חובר בהצלחה ✓
          </div>
        )}
        {params.error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm font-semibold text-red-700">
            שגיאה בחיבור יומן גוגל. נסי שוב.
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isConnected ? 'bg-emerald-100' : 'bg-gray-100'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isConnected ? '#10b981' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800">יומן גוגל</p>
              <p className={`text-xs font-semibold ${isConnected ? 'text-emerald-600' : 'text-gray-400'}`}>
                {isConnected ? 'מחובר ✓' : 'לא מחובר'}
              </p>
            </div>
          </div>

          {!isConnected ? (
            <form action={initiateGoogleConnect}>
              <button type="submit" className="w-full py-3 bg-teal-500 text-white font-bold rounded-2xl text-sm hover:bg-teal-600 transition-colors">
                חבר יומן גוגל
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-2">
              <SyncButton />
              <form action={disconnectGoogle}>
                <button type="submit" className="w-full py-2.5 bg-gray-100 text-gray-500 font-semibold rounded-2xl text-sm hover:bg-gray-200 transition-colors">
                  נתק יומן גוגל
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
