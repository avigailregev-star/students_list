'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listAppEventIds } from '@/lib/googleCalendar'

export async function initiateGoogleConnect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  url.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  redirect(url.toString())
}

export async function disconnectGoogle(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  await admin.from('google_tokens').delete().eq('user_id', user.id)
  await admin.from('google_event_assignments').delete().eq('teacher_id', user.id)

  const { data: groups } = await admin.from('groups').select('id').eq('teacher_id', user.id)
  if (groups && groups.length > 0) {
    await admin.from('lessons')
      .update({ google_event_id: null })
      .in('group_id', groups.map(g => g.id))
  }
}

export async function syncFromGoogle(): Promise<{ alertsCreated: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: groups } = await admin.from('groups').select('id').eq('teacher_id', user.id)
  if (!groups || groups.length === 0) return { alertsCreated: 0 }

  const { data: lessons } = await admin
    .from('lessons')
    .select('id, google_event_id')
    .in('group_id', groups.map(g => g.id))
    .gte('date', today)
    .eq('status', 'scheduled')
    .not('google_event_id', 'is', null)

  if (!lessons || lessons.length === 0) return { alertsCreated: 0 }

  const gcalIds = new Set(await listAppEventIds(user.id))
  const missing = lessons.filter(l => l.google_event_id && !gcalIds.has(l.google_event_id))
  if (missing.length === 0) return { alertsCreated: 0 }

  await admin.from('google_sync_alerts').upsert(
    missing.map(l => ({ teacher_id: user.id, lesson_id: l.id, type: 'deleted_in_google' })),
    { onConflict: 'teacher_id,lesson_id', ignoreDuplicates: true }
  )

  return { alertsCreated: missing.length }
}
