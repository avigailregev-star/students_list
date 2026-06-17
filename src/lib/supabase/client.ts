import { createBrowserClient } from '@supabase/ssr'

// Supabase uses BroadcastChannel(storageKey) to sync auth state between tabs.
// We patch it once per tab so each tab gets an isolated channel — preventing
// Tab 2's login from overwriting Tab 1's in-memory React session.
// Limitation: the auth cookie is still shared, so hard navigations in Tab 1
// after Tab 2 logs in will use Tab 2's server-side session.
if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>)['_sbTabBCPatched']) {
  (window as unknown as Record<string, unknown>)['_sbTabBCPatched'] = true

  const tabId = (() => {
    const existing = sessionStorage.getItem('_sb_tab_id')
    if (existing) return existing
    const id = Math.random().toString(36).slice(2)
    sessionStorage.setItem('_sb_tab_id', id)
    return id
  })()

  const OrigBC = globalThis.BroadcastChannel
  globalThis.BroadcastChannel = class extends OrigBC {
    constructor(name: string) {
      super(`${name}--tab-${tabId}`)
    }
  }
}

let _client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  return (_client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))
}
