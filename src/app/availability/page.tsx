import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/layout/BottomNav'
import AvailabilityClient from './AvailabilityClient'
import { getAvailabilitySlots } from './actions'
import type { TeacherAvailability } from '@/types/database'

export default async function AvailabilityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase.from('teachers').select('role').eq('id', user.id).single()
  const isAdmin = teacher?.role === 'admin'

  let slots: TeacherAvailability[] = []
  let dbError: string | null = null
  try {
    slots = await getAvailabilitySlots()
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-8 pb-6">
        <h1 className="text-xl font-bold">זמינות</h1>
        <p className="text-sm text-white/70 mt-1">ימים ושעות פנויים לרישום</p>
      </div>

      {dbError && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-mono break-all">
          {dbError}
        </div>
      )}

      <AvailabilityClient initialSlots={slots}/>

      <BottomNav isAdmin={isAdmin}/>
    </div>
  )
}
