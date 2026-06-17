// src/app/reports/vacationActions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitVacationRequest(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' }

  const startDate = formData.get('start_date') as string
  const endDate = formData.get('end_date') as string
  const note = (formData.get('note') as string)?.trim() || null

  if (!startDate || !endDate) return { error: 'נא לבחור תאריכים' }
  if (startDate > endDate) return { error: 'תאריך ההתחלה חייב להיות לפני תאריך הסיום' }

  const { error } = await supabase.from('vacation_requests').insert({
    teacher_id: user.id,
    start_date: startDate,
    end_date: endDate,
    note,
  })
  if (error) return { error: 'שגיאה בשליחת הבקשה: ' + error.message }

  revalidatePath('/reports')
  return {}
}
