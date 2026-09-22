import { beforeEach, test, expect, vi } from 'vitest'
const state = vi.hoisted(() => ({
  assignments: [] as { id: string; start_time: string; end_time: string }[],
  writes: 0,
}))
vi.mock('@/lib/auth', () => ({ requireAdmin: async () => ({ supabase: {
  from: () => {
    const builder = {
      select: () => builder, eq: () => builder,
      insert: async () => { state.writes++; return { error: null } },
      then: (resolve: (result: unknown) => void) => resolve({ data: state.assignments, error: null }),
    }
    return builder
  },
} }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { assignRoom } from '@/app/admin/rooms/roomActions'
beforeEach(() => { state.assignments = []; state.writes = 0 })
test('QA: adjacent room bookings at 10:00 must not overlap with database 10:00:00', async () => {
  state.assignments = [{ id: 'old', start_time: '09:00:00', end_time: '10:00:00' }]
  const result = await assignRoom('room', 'teacher', 1, '10:00', '11:00')
  expect(result.error).toBeUndefined()
})
test('QA: end before start must be rejected before writing a room assignment', async () => {
  const result = await assignRoom('room', 'teacher', 1, '14:00', '12:00')
  expect(result.error).toBeDefined()
  expect(state.writes).toBe(0)
})
