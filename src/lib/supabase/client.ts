import { createBrowserClient } from '@supabase/ssr'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>)['_sbTabPatched']) {
  ;(window as unknown as Record<string, unknown>)['_sbTabPatched'] = true

  // Some mobile browsers / in-app WebViews restrict sessionStorage or lack
  // BroadcastChannel entirely. Guard the whole setup so those browsers fall
  // back to the shared-cookie session instead of failing to load the page's
  // script (which would leave buttons unresponsive).
  try {
    const tabId = (() => {
      const existing = sessionStorage.getItem('_sb_tab_id')
      if (existing) return existing
      const id = Math.random().toString(36).slice(2)
      sessionStorage.setItem('_sb_tab_id', id)
      return id
    })()

    // Isolate Supabase's BroadcastChannel per tab so Tab 2's login
    // doesn't update Tab 1's in-memory React session state.
    if (typeof globalThis.BroadcastChannel !== 'undefined') {
      const OrigBC = globalThis.BroadcastChannel
      globalThis.BroadcastChannel = class extends OrigBC {
        constructor(name: string) {
          super(`${name}--tab-${tabId}`)
        }
      }
    }

    // Inject x-tab-session header on every same-origin fetch so the middleware
    // can override the shared auth cookie with this tab's own session.
    const _origFetch = window.fetch.bind(window)
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input
        : input instanceof URL ? input.href
        : (input as Request).url
      const sameOrigin = url.startsWith('/') || url.startsWith(window.location.origin)
      if (sameOrigin) {
        try {
          const session = sessionStorage.getItem('_sb_tab_session')
          if (session) {
            const headers = new Headers(init?.headers)
            headers.set('x-tab-session', session)
            init = { ...init, headers }
          }
        } catch {
          // sessionStorage unavailable — fall back to the shared cookie session
        }
      }
      return _origFetch(input, init)
    }
  } catch {
    // Tab-isolation setup unsupported in this browser — app still works via
    // the normal shared-cookie session, just without per-tab isolation.
  }
}

let _client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  // Keep sessionStorage in sync when the token auto-refreshes so the
  // middleware always injects the latest valid session for this tab.
  if (typeof window !== 'undefined') {
    _client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      try {
        if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && session) {
          const json = JSON.stringify(session)
          const bytes = new TextEncoder().encode(json)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
          sessionStorage.setItem('_sb_tab_session', btoa(binary))
        } else if (event === 'SIGNED_OUT') {
          sessionStorage.removeItem('_sb_tab_session')
        }
      } catch {
        // sessionStorage unavailable — falls back to shared cookie session
      }
    })
  }
  return _client
}
