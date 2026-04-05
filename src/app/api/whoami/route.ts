import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ authenticated: false, error: userError?.message })
  }

  const { data: teacher, error: dbError } = await supabase
    .from('teachers')
    .select('id, name, email, role')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    authenticated: true,
    user_id: user.id,
    user_email: user.email,
    user_metadata: user.user_metadata,
    teacher_row: teacher,
    db_error: dbError?.message ?? null,
  })
}
