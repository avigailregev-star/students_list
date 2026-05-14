'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { LessonType } from '@/types/database'
import { DAYS_HE } from '@/lib/utils/hebrew'

export async function createGroup(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = formData.get('name') as string
  const lessonType = formData.get('lesson_type') as LessonType
  const isMangan = formData.get('is_mangan_school') === 'true'
  const schoolName = isMangan ? (formData.get('school_name') as string) : null
  const grade = isMangan ? (formData.get('grade') as string) : null
  const maxStudentsRaw = formData.get('max_students') as string
  const maxStudents = maxStudentsRaw && maxStudentsRaw !== '' ? parseInt(maxStudentsRaw, 10) : null

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

  // Check for conflicts with existing groups for this teacher
  const { data: teacherGroups } = await supabase.from('groups').select('id').eq('teacher_id', user.id)
  if (teacherGroups && teacherGroups.length > 0) {
    const { data: existingSchedules } = await supabase
      .from('group_schedules')
      .select('day_of_week, start_time')
      .in('group_id', teacherGroups.map(g => g.id))

    for (const newSched of schedules) {
      const conflict = existingSchedules?.find(
        s => s.day_of_week === newSched.day_of_week && s.start_time.startsWith(newSched.start_time)
      )
      if (conflict) {
        const dayName = DAYS_HE[newSched.day_of_week]
        throw new Error(`כבר קיים שיעור ביום ${dayName} בשעה ${newSched.start_time}. לא ניתן לשבץ שני שיעורים באותה שעה.`)
      }
    }
  }

  // Insert group
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ teacher_id: user.id, name, lesson_type: lessonType, is_mangan_school: isMangan, school_name: schoolName, grade, max_students: maxStudents })
    .select()
    .single()

  if (groupError) throw groupError

  // Insert schedules
  const { error: schedError } = await supabase
    .from('group_schedules')
    .insert(schedules.map(s => ({ ...s, group_id: group.id })))

  if (schedError) throw schedError

  // For individual lessons, auto-create the student
  const isIndividual = lessonType === 'individual_45' || lessonType === 'individual_60'
  if (isIndividual) {
    const studentName = formData.get('student_name') as string
    if (studentName) {
      await supabase.from('students').insert({ group_id: group.id, name: studentName })
    }
  }

  revalidatePath('/')
  redirect(`/groups/${group.id}`)
}
