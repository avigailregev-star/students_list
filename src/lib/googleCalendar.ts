import { createAdminClient } from '@/lib/supabase/admin'

export type SchoolEventPayload = {
  id: string
  name: string
  startDate: string  // "YYYY-MM-DD"
  endDate: string    // "YYYY-MM-DD"
}

export type LessonPayload = {
  id: string
  groupName: string
  date: string       // "YYYY-MM-DD"
  startTime: string  // "HH:MM:SS"
  endTime: string    // "HH:MM:SS"
}

function nextDay(date: string): string {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export async function getAccessToken(
  userId: string
): Promise<{ accessToken: string; calendarId: string } | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('google_tokens')
    .select('refresh_token, calendar_id')
    .eq('user_id', userId)
    .single()
  if (!data) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    console.error('googleCalendar: token refresh failed', await res.text())
    return null
  }
  const { access_token } = await res.json() as { access_token: string }
  return { accessToken: access_token, calendarId: data.calendar_id }
}

async function calendarFetch(
  userId: string,
  path: string,
  options: RequestInit = {}
): Promise<Response | null> {
  const token = await getAccessToken(userId)
  if (!token) return null
  return fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(token.calendarId)}${path}`,
    { ...options, headers: { Authorization: `Bearer ${token.accessToken}`, ...(options.headers ?? {}) } }
  )
}

export async function pushSchoolEvent(
  userId: string,
  p: SchoolEventPayload
): Promise<string | null> {
  const res = await calendarFetch(userId, '/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: p.name,
      start: { date: p.startDate },
      end: { date: nextDay(p.endDate) },
      extendedProperties: { private: { source: 'teacher-app', appEventId: p.id } },
    }),
  })
  if (!res || !res.ok) { console.error('googleCalendar: pushSchoolEvent failed', await res?.text()); return null }
  return ((await res.json()) as { id: string }).id
}

export async function updateSchoolEvent(
  userId: string,
  googleEventId: string,
  p: SchoolEventPayload
): Promise<void> {
  const res = await calendarFetch(userId, `/events/${googleEventId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: p.name,
      start: { date: p.startDate },
      end: { date: nextDay(p.endDate) },
    }),
  })
  if (!res || !res.ok) console.error('googleCalendar: updateSchoolEvent failed', await res?.text())
}

export async function deleteGCalEvent(
  userId: string,
  googleEventId: string
): Promise<void> {
  const res = await calendarFetch(userId, `/events/${googleEventId}`, { method: 'DELETE' })
  if (res && !res.ok && res.status !== 410) {
    console.error('googleCalendar: deleteGCalEvent failed', await res.text())
  }
}

export async function pushLesson(
  userId: string,
  p: LessonPayload
): Promise<string | null> {
  const res = await calendarFetch(userId, '/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: p.groupName,
      start: { dateTime: `${p.date}T${p.startTime.slice(0, 5)}:00`, timeZone: 'Asia/Jerusalem' },
      end:   { dateTime: `${p.date}T${p.endTime.slice(0, 5)}:00`,   timeZone: 'Asia/Jerusalem' },
      extendedProperties: { private: { source: 'teacher-app', appLessonId: p.id } },
    }),
  })
  if (!res || !res.ok) { console.error('googleCalendar: pushLesson failed', await res?.text()); return null }
  return ((await res.json()) as { id: string }).id
}

export async function listAppEventIds(userId: string): Promise<string[]> {
  const token = await getAccessToken(userId)
  if (!token) return []
  const params = new URLSearchParams({
    privateExtendedProperty: 'source=teacher-app',
    maxResults: '2500',
    singleEvents: 'true',
    timeMin: new Date().toISOString(),
  })
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(token.calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  )
  if (!res.ok) { console.error('googleCalendar: listAppEventIds failed', await res.text()); return [] }
  return ((await res.json()) as { items: { id: string }[] }).items?.map(e => e.id) ?? []
}
