import { createAdminClient } from '@/lib/supabase/admin'

async function getGroupContext(groupId: string) {
  const supabase = createAdminClient()

  const { data: group, error: groupErr } = await supabase
    .from('groups')
    .select('teacher_id')
    .eq('id', groupId)
    .single()

  if (groupErr || !group?.teacher_id) {
    console.error('syncToRegistrations: group not found', groupId, groupErr?.message)
    return null
  }

  const { data: teacher, error: teacherErr } = await supabase
    .from('teachers')
    .select('name')
    .eq('id', group.teacher_id)
    .single()

  if (teacherErr || !teacher?.name) {
    console.error('syncToRegistrations: teacher not found', group.teacher_id, teacherErr?.message)
    return null
  }

  const { data: schedules } = await supabase
    .from('group_schedules')
    .select('day_of_week, start_time')
    .eq('group_id', groupId)

  const schedule = schedules?.[0] as { day_of_week: number; start_time: string } | undefined

  return { teacherName: teacher.name as string, schedule }
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
    if (!ctx) {
      console.error('syncStudentAdded: no context for group', groupId)
      return
    }

    const supabase = createAdminClient()

    const { data: existing, error: existErr } = await supabase
      .from('registrations')
      .select('id, group_id')
      .eq('student_name', studentName)
      .eq('teacher', ctx.teacherName)
      .maybeSingle()

    if (existErr) console.error('syncStudentAdded: existing check error', existErr.message)

    if (existing) {
      if (!existing.group_id) {
        await supabase.from('registrations').update({ group_id: groupId }).eq('id', existing.id)
      }
      return
    }

    const payload = {
      student_name: studentName,
      parent_name: 'הועבר מאפליקציית נוכחות',
      parent_phone: parentPhone || null,
      parent_email: 'attendance@local',
      type: 'new',
      instruments: instrument ? [instrument] : [],
      teacher: ctx.teacherName,
      assigned_day: ctx.schedule ? String(ctx.schedule.day_of_week) : null,
      assigned_time: ctx.schedule?.start_time || null,
      status: 'שובץ',
    }

    console.log('syncStudentAdded: inserting', JSON.stringify(payload))

    const { data: inserted, error: insertErr } = await supabase
      .from('registrations')
      .insert(payload)
      .select('id')
      .single()

    if (insertErr) {
      console.error('syncStudentAdded: insert failed', insertErr.message, insertErr.details, insertErr.hint)
      return
    }

    console.log('syncStudentAdded: inserted id', inserted?.id)

    if (inserted?.id) {
      const { error: updateErr } = await supabase
        .from('registrations')
        .update({ group_id: groupId })
        .eq('id', inserted.id)
      if (updateErr) console.error('syncStudentAdded: group_id update failed', updateErr.message)
    }
  } catch (e) {
    console.error('syncStudentAdded: unexpected error', e)
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
