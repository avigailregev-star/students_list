'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import type { LessonType } from '@/types/database'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_TYPES: LessonType[] = [
  'individual_45','individual_60','group','theory','orchestra','choir','melodies_individual','melodies_group',
]

export interface GroupFormData {
  name: string
  lessonType: LessonType
  dayOfWeek: number
  startTime: string
  endTime?: string
  students: { name: string; instrument?: string; parentPhone?: string }[]
}

export async function createGroupForTeacher(teacherId: string, data: GroupFormData) {
  if (!UUID_RE.test(teacherId)) throw new Error('מזהה מורה לא תקין')
  if (!data.name.trim()) throw new Error('שם קבוצה נדרש')
  if (!VALID_TYPES.includes(data.lessonType)) throw new Error('סוג שיעור לא תקין')
  if (data.dayOfWeek < 0 || data.dayOfWeek > 5) throw new Error('יום לא תקין')
  if (!data.startTime) throw new Error('שעת התחלה נדרשת')

  const { supabase } = await requireAdmin()

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      teacher_id: teacherId,
      name: data.name.trim(),
      lesson_type: data.lessonType,
      is_mangan_school: false,
    })
    .select('id')
    .single()

  if (groupError || !group) throw new Error('שגיאה ביצירת הקבוצה')

  const { error: schedError } = await supabase
    .from('group_schedules')
    .insert({
      group_id: group.id,
      day_of_week: data.dayOfWeek,
      start_time: data.startTime,
      end_time: data.endTime ?? null,
    })

  if (schedError) throw new Error('שגיאה בשמירת המועד')

  if (data.students.length > 0) {
    const { error: studError } = await supabase
      .from('students')
      .insert(data.students.map(s => ({
        group_id: group.id,
        name: s.name.trim(),
        instrument: s.instrument?.trim() || null,
        parent_phone: s.parentPhone?.trim() || null,
        is_active: true,
      })))
    if (studError) throw new Error('שגיאה בהוספת תלמידים')
  }

  revalidatePath(`/admin/teachers/${teacherId}`)
}

export async function updateGroup(groupId: string, teacherId: string, data: GroupFormData) {
  if (!UUID_RE.test(groupId)) throw new Error('מזהה קבוצה לא תקין')
  if (!data.name.trim()) throw new Error('שם קבוצה נדרש')
  if (!VALID_TYPES.includes(data.lessonType)) throw new Error('סוג שיעור לא תקין')

  const { supabase } = await requireAdmin()

  const { error: groupError } = await supabase
    .from('groups')
    .update({ name: data.name.trim(), lesson_type: data.lessonType })
    .eq('id', groupId)

  if (groupError) throw new Error('שגיאה בעדכון הקבוצה')

  // Replace schedule: delete existing, insert new
  await supabase.from('group_schedules').delete().eq('group_id', groupId)
  const { error: schedError } = await supabase
    .from('group_schedules')
    .insert({
      group_id: groupId,
      day_of_week: data.dayOfWeek,
      start_time: data.startTime,
      end_time: data.endTime ?? null,
    })

  if (schedError) throw new Error('שגיאה בעדכון המועד')

  revalidatePath(`/admin/teachers/${teacherId}`)
}

export async function deleteGroup(groupId: string, teacherId: string) {
  if (!UUID_RE.test(groupId)) throw new Error('מזהה קבוצה לא תקין')
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('groups').delete().eq('id', groupId)
  if (error) throw new Error('שגיאה במחיקת הקבוצה')
  revalidatePath(`/admin/teachers/${teacherId}`)
}

export async function addStudentToGroup(groupId: string, teacherId: string, student: { name: string; instrument?: string; parentPhone?: string }) {
  if (!UUID_RE.test(groupId)) throw new Error('מזהה קבוצה לא תקין')
  if (!student.name.trim()) throw new Error('שם תלמיד נדרש')
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('students').insert({
    group_id: groupId,
    name: student.name.trim(),
    instrument: student.instrument?.trim() || null,
    parent_phone: student.parentPhone?.trim() || null,
    is_active: true,
  })
  if (error) throw new Error('שגיאה בהוספת תלמיד')
  revalidatePath(`/admin/teachers/${teacherId}`)
}

export async function removeStudentFromGroup(studentId: string, teacherId: string) {
  if (!UUID_RE.test(studentId)) throw new Error('מזהה תלמיד לא תקין')
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('students').delete().eq('id', studentId)
  if (error) throw new Error('שגיאה במחיקת תלמיד')
  revalidatePath(`/admin/teachers/${teacherId}`)
}
