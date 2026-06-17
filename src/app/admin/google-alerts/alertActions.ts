'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin as _requireAdmin } from '@/lib/auth'

export async function resolveAlert(alertId: string): Promise<void> {
  const { supabase } = await _requireAdmin('/admin')
  await supabase.from('google_sync_alerts').update({ resolved: true }).eq('id', alertId)
  revalidatePath('/admin/google-alerts')
  revalidatePath('/admin')
}
