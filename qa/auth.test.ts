import { test, expect, vi } from 'vitest'

const state = vi.hoisted(() => ({
  update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
  from: vi.fn(() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'teacher' }, error: null }) }) }) })),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'teacher-1', user_metadata: { role: 'admin' } } } }) },
  from: state.from,
}) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  from: () => ({ update: state.update }),
}) }))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('redirect') } }))
import { requireAdmin } from '@/lib/auth'
import { transferTeacherGroups } from '@/app/login/actions'

test('QA: user-editable metadata must not grant admin without trusted role verification', async () => {
  await expect(requireAdmin()).rejects.toThrow('redirect')
  expect(state.from).toHaveBeenCalled()
})
test('QA: transfer must not write using service role without authenticating caller', async () => {
  await expect(transferTeacherGroups('other-teacher', 'attacker')).rejects.toThrow('redirect')
  expect(state.update).not.toHaveBeenCalled()
})
