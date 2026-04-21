import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AttendanceStatus } from '@/types/database'

export async function POST(request: Request) {
  try {
    const { lessonId, studentId, status, broughtInstrument } = await request.json() as {
      lessonId: string
      studentId: string
      status: AttendanceStatus
      broughtInstrument: boolean
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('attendance').upsert({
      lesson_id: lessonId,
      student_id: studentId,
      status,
      brought_instrument: broughtInstrument,
    }, { onConflict: 'lesson_id,student_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
