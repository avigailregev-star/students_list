'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { LessonType } from '@/types/database'

export async function createGroup(formData: FormData) {
  const { user } = await requireAdmin()
  const supabase = createAdminClient()

  const name = formData.get('name') as string
  const lessonType = formData.get('lesson_type') as LessonType
  const isMangan = formData.get('is_mangan_school') === 'true'
  const schoolName = isMangan ? (formData.get('school_name') as string) : null
  const grade = isMangan ? (formData.get('grade') as string) : null
  const maxStudentsRaw = formData.get('max_students') as string
  const maxStudents = maxStudentsRaw && maxStudentsRaw !== '' ? Number(maxStudentsRaw) : null

  // Parse schedule(s)
  const schedules: { day_of_week: number; start_time: string }[] = []
  const day1 = formData.get('day_1')
  const time1 = formData.get('time_1')
  if (day1 && time1) {
    schedules.push({ day_of_week: Number(day1), start_time: time1 as string })
  }
  const day2 = formData.get('day_2')
  const time2 = formData.get('time_2')
  if (day2 && time2 && day2 !== '') {
    schedules.push({ day_of_week: Number(day2), start_time: time2 as string })
  }

  if (!name || schedules.length === 0) {
    throw new Error('שם הקבוצה ולפחות מועד אחד נדרשים')
  }

  // Prevent duplicate schedules within the same form
  if (schedules.length === 2 &&
    schedules[0].day_of_week === schedules[1].day_of_week &&
    schedules[0].start_time === schedules[1].start_time) {
    throw new Error('שני המועדים זהים. אנא בחרי יום ושעה שונים.')
  }

  if (maxStudents !== null && (!Number.isInteger(maxStudents) || maxStudents <= 0)) throw new Error('מספר התלמידים המרבי אינו תקין')
  const isIndividual = lessonType === 'individual_45' || lessonType === 'individual_60'
  const studentName = (formData.get('student_name') as string | null)?.trim()
  const { data: groupId, error } = await supabase.rpc('create_group_atomic', {
    p_actor_id: user.id, p_teacher_id: user.id, p_name: name, p_lesson_type: lessonType,
    p_schedules: schedules, p_students: isIndividual && studentName ? [{ name: studentName }] : [],
    p_is_mangan: isMangan, p_school_name: schoolName, p_grade: grade, p_max_students: maxStudents,
  })
  if (error || !groupId) throw new Error('שגיאה ביצירת הקבוצה: ' + (error?.message ?? 'לא התקבל אישור שמירה'))

  revalidatePath('/')
  redirect(`/groups/${groupId}`)
}
