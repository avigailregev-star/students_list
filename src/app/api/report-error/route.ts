import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBugReportEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { errorMessage, errorStack, pageUrl, userDescription } = await request.json() as {
      errorMessage: string
      errorStack?: string
      pageUrl: string
      userDescription?: string
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let teacherName: string | null = null
    let teacherId: string | null = null

    if (user) {
      teacherId = user.id
      const { data: teacher } = await supabase
        .from('teachers')
        .select('name')
        .eq('id', user.id)
        .single()
      teacherName = teacher?.name ?? null
    }

    await supabase.from('bug_reports').insert({
      teacher_id: teacherId,
      teacher_name: teacherName,
      page_url: pageUrl,
      error_message: errorMessage,
      error_stack: errorStack ?? null,
      user_description: userDescription ?? null,
    })

    await sendBugReportEmail({
      teacherName: teacherName ?? 'לא ידוע',
      errorMessage,
      pageUrl,
      userDescription,
      createdAt: new Date().toLocaleString('he-IL'),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[report-error]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
