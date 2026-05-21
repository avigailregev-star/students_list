import { createAdminClient } from '@/lib/supabase/admin'

async function getGroupContext(groupId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('groups')
    .select('teachers(name), group_schedules(day_of_week, start_time)')
    .eq('id', groupId)
    .single()
  if (!data) return null
  const teacherName = (data.teachers as unknown as { name: string } | null)?.name
  const schedule = (data.group_schedules as unknown as { day_of_week: number; start_time: string }[] | null)?.[0]
  return teacherName ? { teacherName, schedule } : null
}

export async function syncStudentAdded({
  groupId,
  studentName,
  instrument,
  parentPhone,
}: {
  groupId: string
  studentName: string
  instrument?: string | null
  parentPhone?: string | null
}) {
  try {
    const ctx = await getGroupContext(groupId)
    if (!ctx) return

    const supabase = createAdminClient()

    // If registration already exists for this student+teacher, don't create a duplicate
    const { data: existing } = await supabase
      .from('registrations')
      .select('id, group_id')
      .eq('student_name', studentName)
      .eq('teacher', ctx.teacherName)
      .maybeSingle()

    if (existing) {
      if (!existing.group_id) {
        await supabase.from('registrations').update({ group_id: groupId }).eq('id', existing.id)
      }
      return
    }

    const { data: inserted, error: insertErr } = await supabase.from('registrations').insert({
      student_name: studentName,
      parent_name: '',
      parent_phone: parentPhone || null,
      parent_email: '',
      type: 'new',
      instruments: instrument ? [instrument] : [],
      teacher: ctx.teacherName,
      assigned_day: ctx.schedule ? String(ctx.schedule.day_of_week) : null,
      assigned_time: ctx.schedule?.start_time || null,
      status: 'שובץ',
    }).select('id').single()

    if (insertErr) {
      console.error('syncStudentAdded insert error:', insertErr.message)
      return
    }

    if (inserted?.id) {
      await supabase.from('registrations').update({ group_id: groupId }).eq('id', inserted.id)
    }
  } catch (e) {
    console.error('syncStudentAdded error:', e)
  }
}

export async function syncStudentRemoved({
  studentName,
  groupId,
}: {
  studentName: string
  groupId: string
}) {
  try {
    const ctx = await getGroupContext(groupId)
    if (!ctx) return

    const supabase = createAdminClient()

    const { data: reg } = await supabase
      .from('registrations')
      .select('id')
      .eq('student_name', studentName)
      .eq('teacher', ctx.teacherName)
      .maybeSingle()

    if (!reg) return

    await supabase.from('registrations').update({
      teacher: null,
      assigned_day: null,
      assigned_time: null,
      status: 'חדש',
      group_id: null,
    }).eq('id', reg.id)
  } catch (e) {
    console.error('syncStudentRemoved error:', e)
  }
}
