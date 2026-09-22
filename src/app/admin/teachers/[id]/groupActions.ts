'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { LessonType } from '@/types/database'
import { syncStudentRemoved } from '@/lib/syncToRegistrations'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_TYPES: LessonType[] = [
  'individual_45','individual_60','group','theory','orchestra','choir','melodies_individual','melodies_group',
]

export interface GroupFormData {
  scheduleId?: string
  name: string
  lessonType: LessonType
  dayOfWeek: number
  startTime: string
  endTime?: string
  students: { name: string; instrument?: string; parentPhone?: string }[]
}

function isNextInternalError(err: unknown): boolean {
  // redirect() and notFound() throw special Next.js errors — let them propagate
  return typeof err === 'object' && err !== null && 'digest' in err
}

export async function createGroupForTeacher(teacherId: string, data: GroupFormData): Promise<{ error?: string }> {
  try {
    if (!UUID_RE.test(teacherId)) return { error: 'מזהה מורה לא תקין' }
    if (!data.name.trim()) return { error: 'שם קבוצה נדרש' }
    if (!VALID_TYPES.includes(data.lessonType)) return { error: 'סוג שיעור לא תקין' }
    if (data.dayOfWeek < 0 || data.dayOfWeek > 4) return { error: 'יום לא תקין' }
    if ((data.lessonType === 'orchestra' || data.lessonType === 'choir') && !data.endTime) return { error: 'שעת סיום נדרשת לתזמורת או מקהלה' }

    const { user } = await requireAdmin()
    const supabase = createAdminClient()
    const { error } = await supabase.rpc('create_group_atomic', {
      p_actor_id: user.id, p_teacher_id: teacherId, p_name: data.name.trim(), p_lesson_type: data.lessonType,
      p_schedules: [{ day_of_week: data.dayOfWeek, start_time: data.startTime, end_time: data.endTime || null }],
      p_students: data.students.map(s => ({ name: s.name.trim(), instrument: s.instrument?.trim() || null, parent_phone: s.parentPhone?.trim() || null })),
    })
    if (error) return { error: 'שגיאה ביצירת הקבוצה: ' + error.message }

    revalidatePath(`/admin/teachers/${teacherId}`)
    return {}
  } catch (err) {
    if (isNextInternalError(err)) throw err
    const msg = err instanceof Error ? err.message : String(err)
    console.error('createGroupForTeacher threw:', msg)
    return { error: msg }
  }
}

export async function updateGroup(groupId: string, teacherId: string, data: GroupFormData): Promise<{ error?: string }> {
  try {
    if (!UUID_RE.test(groupId)) return { error: 'מזהה קבוצה לא תקין' }
    if (!data.name.trim()) return { error: 'שם קבוצה נדרש' }
    if (!VALID_TYPES.includes(data.lessonType)) return { error: 'סוג שיעור לא תקין' }
    if ((data.lessonType === 'orchestra' || data.lessonType === 'choir') && !data.endTime) return { error: 'שעת סיום נדרשת לתזמורת או מקהלה' }

    const { user } = await requireAdmin()
    const supabase = createAdminClient()
    const { error } = await supabase.rpc('update_group_schedule_atomic', {
      p_actor_id: user.id, p_group_id: groupId, p_teacher_id: teacherId,
      p_schedule_id: data.scheduleId ?? null, p_name: data.name.trim(), p_lesson_type: data.lessonType,
      p_day: data.dayOfWeek, p_start: data.startTime, p_end: data.endTime || null,
    })
    if (error) return { error: 'לא ניתן לשמור את הקבוצה: ' + error.message }

    revalidatePath(`/admin/teachers/${teacherId}`)
    return {}
  } catch (err) {
    if (isNextInternalError(err)) throw err
    const msg = err instanceof Error ? err.message : String(err)
    console.error('updateGroup threw:', msg)
    return { error: msg }
  }
}

export async function deleteGroup(groupId: string, teacherId: string): Promise<{ error?: string }> {
  try {
    if (!UUID_RE.test(groupId)) return { error: 'מזהה קבוצה לא תקין' }
    await requireAdmin()
    const supabase = createAdminClient()

    // Delete dependents first to avoid FK violations
    const { data: lessons } = await supabase.from('lessons').select('id').eq('group_id', groupId)
    if (lessons && lessons.length > 0) {
      const lessonIds = lessons.map(l => l.id)
      await supabase.from('attendance').delete().in('lesson_id', lessonIds)
    }
    await supabase.from('lessons').delete().eq('group_id', groupId)
    const { data: groupStudents } = await supabase.from('students').select('name').eq('group_id', groupId)
    await supabase.from('students').delete().eq('group_id', groupId)
    if (groupStudents) await Promise.all(groupStudents.map(s => syncStudentRemoved({ studentName: s.name, groupId })))
    await supabase.from('group_schedules').delete().eq('group_id', groupId)

    const { error } = await supabase.from('groups').delete().eq('id', groupId)
    if (error) {
      console.error('deleteGroup error:', error)
      return { error: `שגיאה במחיקת הקבוצה: ${error.message}` }
    }
    revalidatePath(`/admin/teachers/${teacherId}`)
    return {}
  } catch (err) {
    if (isNextInternalError(err)) throw err
    const msg = err instanceof Error ? err.message : String(err)
    console.error('deleteGroup threw:', msg)
    return { error: msg }
  }
}

export async function addStudentToGroup(groupId: string, teacherId: string, student: { name: string; instrument?: string; parentPhone?: string }): Promise<{ error?: string }> {
  try {
    if (!UUID_RE.test(groupId)) return { error: 'מזהה קבוצה לא תקין' }
    if (!student.name.trim()) return { error: 'שם תלמיד נדרש' }
    const { user } = await requireAdmin()
    const supabase = createAdminClient()
    const { error } = await supabase.rpc('add_student_atomic', {
      p_actor_id: user.id, p_group_id: groupId, p_name: student.name.trim(),
      p_instrument: student.instrument?.trim() || null,
      p_parent_phone: student.parentPhone?.trim() || null,
    })
    if (error) {
      console.error('addStudent error:', error)
      return { error: `שגיאה בהוספת תלמיד: ${error.message}` }
    }
    revalidatePath(`/admin/teachers/${teacherId}`)
    return {}
  } catch (err) {
    if (isNextInternalError(err)) throw err
    const msg = err instanceof Error ? err.message : String(err)
    console.error('addStudentToGroup threw:', msg)
    return { error: msg }
  }
}

export async function removeStudentFromGroup(studentId: string, teacherId: string): Promise<{ error?: string }> {
  try {
    if (!UUID_RE.test(studentId)) return { error: 'מזהה תלמיד לא תקין' }
    await requireAdmin()
    const supabase = createAdminClient()
    const { data: student } = await supabase.from('students').select('name, group_id').eq('id', studentId).single()
    // Keep the student row so historical attendance continues to reference it.
    // A hard delete can cascade into attendance rows and erase lessons from reports.
    const { error } = await supabase.from('students').update({ is_active: false }).eq('id', studentId)
    if (error) {
      console.error('removeStudent error:', error)
      return { error: `שגיאה במחיקת תלמיד: ${error.message}` }
    }
    if (student?.name && student?.group_id) await syncStudentRemoved({ studentName: student.name, groupId: student.group_id })
    revalidatePath(`/admin/teachers/${teacherId}`)
    return {}
  } catch (err) {
    if (isNextInternalError(err)) throw err
    const msg = err instanceof Error ? err.message : String(err)
    console.error('removeStudentFromGroup threw:', msg)
    return { error: msg }
  }
}
