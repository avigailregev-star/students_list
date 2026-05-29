import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'NOT SET'
  const keySet = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const keyPrefix = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 40) ?? 'NOT SET'

  let dbResult: string
  let teachers: string[] = []
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('teachers')
      .select('id, name')
      .order('created_at', { ascending: false })
      .limit(5)
    if (error) {
      dbResult = `DB ERROR: ${error.message}`
    } else {
      dbResult = 'OK'
      teachers = (data ?? []).map((t: { id: string; name: string }) => `${t.name} (${t.id.slice(0, 8)})`)
    }
  } catch (e) {
    dbResult = `EXCEPTION: ${e instanceof Error ? e.message : String(e)}`
  }

  return NextResponse.json({
    supabase_url: url,
    service_key_set: keySet,
    service_key_prefix: keyPrefix,
    db_connection: dbResult,
    last_5_teachers: teachers,
  })
}
