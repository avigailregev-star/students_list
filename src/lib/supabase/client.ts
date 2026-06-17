import { createBrowserClient } from '@supabase/ssr'

let _client: ReturnType<typeof createBrowserClient> | undefined

function getTabStorageKey(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const existing = window.sessionStorage.getItem('_sb_tab_key')
  if (existing) return existing
  const key = `sb-auth-${Math.random().toString(36).slice(2)}`
  window.sessionStorage.setItem('_sb_tab_key', key)
  return key
}

export function createClient() {
  return (_client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        storageKey: getTabStorageKey(),
      },
    }
  ))
}