import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushSchoolEvent, pushLesson } from '@/lib/googleCalendar'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/settings?error=no_code', request.url))

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) {
    console.error('google callback: token exchange failed', await tokenRes.text())
    return NextResponse.redirect(new URL('/settings?error=token_exchange', request.url))
  }
  const { refresh_token } = await tokenRes.json() as { refresh_token?: string }
  if (!refresh_token) return NextResponse.redirect(new URL('/settings?error=no_refresh_token', request.url))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const admin = createAdminClient()
  await admin.from('google_tokens').upsert({
    user_id: user.id,
    refresh_token,
    calendar_id: 'primary',
    updated_at: new Date().toISOString(),
  })

  void retroactiveSync(user.id)

  return NextResponse.redirect(new URL('/settings?connected=1', request.url))
}

async function retroactiveSync(userId: string) {
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: autoEvents } = await admin
    .from('school_events')
    .select('id, name, start_date, end_date, event_type')
    .in('event_type', ['holiday', 'vacation'])
    .gte('end_date', today)

  const { data: assignedRows } = await admin
    .from('school_event_assignments')
    .select('event_id')
    .eq('teacher_id', userId)

  const assignedIds = (assignedRows ?? []).map(r => r.event_id)
  let assignedEvents: { id: string; name: string; start_date: string; end_date: string }[] = []
  if (assignedIds.length > 0) {
    const { data } = await admin
      .from('school_events')
      .select('id, name, start_date, end_date')
      .in('id', assignedIds)
      .gte('end_date', today)
    assignedEvents = data ?? []
  }

  const seen = new Set<string>()
  const allEvents = [...(autoEvents ?? []), ...assignedEvents].filter(e => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  for (const ev of allEvents) {
    const { data: existing } = await admin
      .from('google_event_assignments')
      .select('id')
      .eq('school_event_id', ev.id)
      .eq('teacher_id', userId)
      .single()
    if (existing) continue

    const gcalId = await pushSchoolEvent(userId, {
      id: ev.id, name: ev.name, startDate: ev.start_date, endDate: ev.end_date,
    })
    if (gcalId) {
      await admin.from('google_event_assignments').insert({
        school_event_id: ev.id, teacher_id: userId, google_event_id: gcalId,
      })
    }
  }

  const { data: groups } = await admin
    .from('groups')
    .select('id, name, group_schedules(end_time)')
    .eq('teacher_id', userId)

  if (!groups || groups.length === 0) return

  for (const group of groups) {
    const endTime = (group.group_schedules as { end_time: string | null }[])?.[0]?.end_time ?? null

    const { data: lessons } = await admin
      .from('lessons')
      .select('id, date, start_time, google_event_id')
      .eq('group_id', group.id)
      .eq('status', 'scheduled')
      .gte('date', today)
      .is('google_event_id', null)

    for (const lesson of lessons ?? []) {
      const computedEnd = endTime ?? addMinutesToTime(lesson.start_time, 60)
      const gcalId = await pushLesson(userId, {
        id: lesson.id,
        groupName: group.name,
        date: lesson.date,
        startTime: lesson.start_time,
        endTime: computedEnd,
      })
      if (gcalId) {
        await admin.from('lessons').update({ google_event_id: gcalId }).eq('id', lesson.id)
      }
    }
  }
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`
}
