import { beforeEach, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
}))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth }),
}))

import { proxy } from './proxy'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  auth.getUser.mockResolvedValue({ data: { user: { id: 'teacher-1' } } })
})

function request(path: string, method: string) {
  return new NextRequest(`https://attendance.example${path}`, {
    method,
    headers: { 'x-tab-session': btoa(JSON.stringify({ access_token: 'test-token' })) },
  })
}

test('authenticated login action reaches the server instead of being redirected', async () => {
  const response = await proxy(request('/login', 'POST'))
  expect(response.headers.get('location')).toBeNull()
  expect(response.headers.get('x-middleware-next')).toBe('1')
  expect(auth.getUser).toHaveBeenCalled()
})

test.each(['GET', 'HEAD'])('authenticated login %s still redirects', async method => {
  const response = await proxy(request('/login', method))
  expect(response.headers.get('location')).toBe('https://attendance.example/redirect')
})

test('unauthenticated requests to protected pages still require login', async () => {
  auth.getUser.mockResolvedValue({ data: { user: null } })
  const response = await proxy(request('/dashboard', 'POST'))
  expect(response.headers.get('location')).toBe('https://attendance.example/login')
})

test('unauthenticated API requests still return 401', async () => {
  auth.getUser.mockResolvedValue({ data: { user: null } })
  const response = await proxy(request('/api/students', 'POST'))
  expect(response.status).toBe(401)
})
