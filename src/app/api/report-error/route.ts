import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBugReportEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      errorMessage?: string
      errorStack?: string
      pageUrl?: string
      userDescription?: string
    }

    const { errorMessage, errorStack, pageUrl, userDescription } = body

    if (!errorMessage || typeof errorMessage !== 'string') {
      return NextResponse.json({ ok: false, error: 'errorMessage required' }, { status: 400 })
    }
    if (!pageUrl || typeof pageUrl !== 'string') {
      return NextResponse.json({ ok: false, error: 'pageUrl required' }, { status: 400 })
    }

    // Get user info if authenticated (best-effort — works without session too)
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

    // Use admin client for insert — bypasses RLS so it works for both authenticated and anonymous reporters
    const adminClient = createAdminClient()
    const { error: insertError } = await adminClient.from('bug_reports').insert({
      teacher_id: teacherId,
      teacher_name: teacherName,
      page_url: pageUrl,
      error_message: errorMessage.slice(0, 1000),
      error_stack: errorStack ? errorStack.slice(0, 5000) : null,
      user_description: userDescription ?? null,
    })

    if (insertError) {
      console.error('[report-error] insert failed:', insertError)
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    await sendBugReportEmail({
      teacherName: teacherName ?? 'לא ידוע',
      errorMessage: errorMessage.slice(0, 1000),
      pageUrl,
      userDescription,
      createdAt: new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[report-error]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
