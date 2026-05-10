import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/layout/BottomNav'
import AvailabilityClient from './AvailabilityClient'
import { getAvailabilityRanges } from './actions'

export default async function AvailabilityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase.from('teachers').select('role').eq('id', user.id).single()
  const isAdmin = teacher?.role === 'admin'

  const { ranges, error } = await getAvailabilityRanges()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-8 pb-6">
        <h1 className="text-xl font-bold">זמינות</h1>
        <p className="text-sm text-white/70 mt-1">ימים ושעות פנויים לרישום</p>
      </div>

      {error && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-xs text-red-700 font-mono break-all">
          שגיאת DB: {error}
        </div>
      )}

      <AvailabilityClient initialRanges={ranges}/>

      <BottomNav isAdmin={isAdmin}/>
    </div>
  )
}
