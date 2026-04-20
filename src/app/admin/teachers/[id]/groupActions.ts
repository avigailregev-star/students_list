'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
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

export async function createGroupForTeacher(teacherId: string, data: GroupFormData): Promise<{ error?: string }> {
  if (!UUID_RE.test(teacherId)) return { error: 'מזהה מורה לא תקין' }
  if (!data.name.trim()) return { error: 'שם קבוצה נדרש' }
  if (!VALID_TYPES.includes(data.lessonType)) return { error: 'סוג שיעור לא תקין' }
  if (data.dayOfWeek < 0 || data.dayOfWeek > 5) return { error: 'יום לא תקין' }
  if (!data.startTime) return { error: 'שעת התחלה נדרשת' }

  await requireAdmin()
  const supabase = createAdminClient()

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

  if (groupError || !group) {
    console.error('createGroup error:', groupError)
    return { error: `שגיאה ביצירת הקבוצה: ${groupError?.message ?? 'unknown'}` }
  }

  const { error: schedError } = await supabase
    .from('group_schedules')
    .insert({
      group_id: group.id,
      day_of_week: data.dayOfWeek,
      start_time: data.startTime,
      end_time: data.endTime ?? null,
    })

  if (schedError) {
    console.error('createSchedule error:', schedError)
    return { error: `שגיאה בשמירת המועד: ${schedError.message}` }
  }

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
    if (studError) {
      console.error('createStudents error:', studError)
      return { error: `שגיאה בהוספת תלמידים: ${studError.message}` }
    }
  }

  revalidatePath(`/admin/teachers/${teacherId}`)
  return {}
}

export async function updateGroup(groupId: string, teacherId: string, data: GroupFormData): Promise<{ error?: string }> {
  if (!UUID_RE.test(groupId)) return { error: 'מזהה קבוצה לא תקין' }
  if (!data.name.trim()) return { error: 'שם קבוצה נדרש' }
  if (!VALID_TYPES.includes(data.lessonType)) return { error: 'סוג שיעור לא תקין' }

  await requireAdmin()
  const supabase = createAdminClient()

  const { error: groupError } = await supabase
    .from('groups')
    .update({ name: data.name.trim(), lesson_type: data.lessonType })
    .eq('id', groupId)

  if (groupError) {
    console.error('updateGroup error:', groupError)
    return { error: `שגיאה בעדכון הקבוצה: ${groupError.message}` }
  }

  await supabase.from('group_schedules').delete().eq('group_id', groupId)
  const { error: schedError } = await supabase
    .from('group_schedules')
    .insert({
      group_id: groupId,
      day_of_week: data.dayOfWeek,
      start_time: data.startTime,
      end_time: data.endTime ?? null,
    })

  if (schedError) {
    console.error('updateSchedule error:', schedError)
    return { error: `שגיאה בעדכון המועד: ${schedError.message}` }
  }

  revalidatePath(`/admin/teachers/${teacherId}`)
  return {}
}

export async function deleteGroup(groupId: string, teacherId: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(groupId)) return { error: 'מזהה קבוצה לא תקין' }
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase.from('groups').delete().eq('id', groupId)
  if (error) {
    console.error('deleteGroup error:', error)
    return { error: `שגיאה במחיקת הקבוצה: ${error.message}` }
  }
  revalidatePath(`/admin/teachers/${teacherId}`)
  return {}
}

export async function addStudentToGroup(groupId: string, teacherId: string, student: { name: string; instrument?: string; parentPhone?: string }): Promise<{ error?: string }> {
  if (!UUID_RE.test(groupId)) return { error: 'מזהה קבוצה לא תקין' }
  if (!student.name.trim()) return { error: 'שם תלמיד נדרש' }
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase.from('students').insert({
    group_id: groupId,
    name: student.name.trim(),
    instrument: student.instrument?.trim() || null,
    parent_phone: student.parentPhone?.trim() || null,
    is_active: true,
  })
  if (error) {
    console.error('addStudent error:', error)
    return { error: `שגיאה בהוספת תלמיד: ${error.message}` }
  }
  revalidatePath(`/admin/teachers/${teacherId}`)
  return {}
}

export async function removeStudentFromGroup(studentId: string, teacherId: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(studentId)) return { error: 'מזהה תלמיד לא תקין' }
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase.from('students').delete().eq('id', studentId)
  if (error) {
    console.error('removeStudent error:', error)
    return { error: `שגיאה במחיקת תלמיד: ${error.message}` }
  }
  revalidatePath(`/admin/teachers/${teacherId}`)
  return {}
}
