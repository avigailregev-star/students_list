import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AttendanceStatus } from '@/types/database'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

export async function POST(request: Request) {
  try {
    const { lessonId, studentId, status, broughtInstrument } = await request.json() as {
      lessonId: string
      studentId: string
      status: AttendanceStatus | null
      broughtInstrument: boolean
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!UUID_RE.test(lessonId) || !UUID_RE.test(studentId) || (status !== null && !VALID_STATUSES.includes(status))) {
      return NextResponse.json({ error: 'Invalid attendance data' }, { status: 400 })
    }

    // Verify that both records belong to the signed-in teacher before using the
    // service client. This also makes edits reliable when an RLS policy permits
    // inserts but inadvertently blocks updates.
    const [{ data: lesson }, { data: student }] = await Promise.all([
      supabase.from('lessons').select('group_id, date, is_makeup, groups!inner(teacher_id)').eq('id', lessonId).maybeSingle(),
      supabase.from('students').select('group_id, groups!inner(teacher_id)').eq('id', studentId).maybeSingle(),
    ])
    const lessonOwner = (lesson?.groups as unknown as { teacher_id?: string } | null)?.teacher_id
    const studentOwner = (student?.groups as unknown as { teacher_id?: string } | null)?.teacher_id
    if (!lesson || !student || lesson.group_id !== student.group_id || lessonOwner !== user.id || studentOwner !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()
    // Older versions could create several regular lesson rows for the same
    // group/date after a schedule-hour change. Clear this student's status from
    // every duplicate before writing the single current value, otherwise an old
    // "absent" row remains visible in reports forever.
    let relatedLessonIds = [lessonId]
    if (!lesson.is_makeup) {
      const { data: sameDayLessons } = await admin
        .from('lessons')
        .select('id')
        .eq('group_id', lesson.group_id)
        .eq('date', lesson.date)
        .eq('is_makeup', false)
      relatedLessonIds = (sameDayLessons ?? []).map(row => row.id)
      if (!relatedLessonIds.includes(lessonId)) relatedLessonIds.push(lessonId)
    }

    const { error: cleanupError } = await admin
      .from('attendance')
      .delete()
      .in('lesson_id', relatedLessonIds)
      .eq('student_id', studentId)

    if (cleanupError) {
      console.error('[attendance] duplicate cleanup error:', cleanupError)
      return NextResponse.json({ error: cleanupError.message }, { status: 500 })
    }

    const { error } = status === null
      ? { error: null }
      : await admin.from('attendance').insert({
          lesson_id: lessonId,
          student_id: studentId,
          status,
          brought_instrument: broughtInstrument,
        })

    if (error) {
      console.error('[attendance] upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
