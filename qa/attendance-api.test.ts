import { test, expect, vi } from 'vitest'
const state = vi.hoisted(() => ({ rows: [{ status: 'present' }] }))
const lessonId = '11111111-1111-4111-8111-111111111111'
const studentId = '22222222-2222-4222-8222-222222222222'
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'teacher-1' } } }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
    data: { group_id: 'group-1', is_makeup: true, groups: { teacher_id: 'teacher-1' } },
  }) }) }) }),
}) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  rpc: async () => ({ error: { message: 'simulated atomic write failure' } }),
  from: () => ({
    delete: () => ({ in: () => ({ eq: async () => { state.rows = []; return { error: null } } }) }),
    insert: async () => ({ error: { message: 'simulated insert failure' } }),
  }),
}) }))
import { POST } from '@/app/api/attendance/route'
test('QA: failed replacement save must retain previously persisted attendance', async () => {
  const response = await POST(new Request('http://localhost/api/attendance', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonId, studentId, status: 'absent', broughtInstrument: false }),
  }))
  expect(response.status).toBe(500)
  expect(state.rows).toEqual([{ status: 'present' }])
})
