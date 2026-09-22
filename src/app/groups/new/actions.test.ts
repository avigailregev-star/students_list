import { beforeEach, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({ rpc: vi.fn(), authorize: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAdmin: state.authorize }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: state.rpc }) }))
vi.mock('next/cache', () => ({ revalidatePath: state.revalidate }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error('redirect:' + url) } }))
import { createGroup } from './actions'

function form() {
  const data = new FormData()
  Object.entries({ name: 'QA group', lesson_type: 'individual_45', day_1: '0', time_1: '10:00', student_name: 'QA student', max_students: '2' })
    .forEach(([key, value]) => data.set(key, value))
  return data
}
beforeEach(() => {
  vi.clearAllMocks()
  state.authorize.mockResolvedValue({ user: { id: 'admin' } })
  state.rpc.mockResolvedValue({ data: 'group-id', error: null })
})
test('saves group, capacity, Sunday schedule and student in one operation', async () => {
  await expect(createGroup(form())).rejects.toThrow('redirect:/groups/group-id')
  expect(state.rpc).toHaveBeenCalledOnce()
  expect(state.rpc).toHaveBeenCalledWith('create_group_atomic', expect.objectContaining({
    p_actor_id: 'admin', p_max_students: 2, p_schedules: [{ day_of_week: 0, start_time: '10:00' }], p_students: [{ name: 'QA student' }],
  }))
})
test('failed student save never redirects to a partly saved group', async () => {
  state.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Student identity needs review' } })
  await expect(createGroup(form())).rejects.toThrow('Student identity needs review')
  expect(state.revalidate).not.toHaveBeenCalled()
})
test('requires administrator authorization before any write', async () => {
  state.authorize.mockRejectedValueOnce(new Error('forbidden'))
  await expect(createGroup(form())).rejects.toThrow('forbidden')
  expect(state.rpc).not.toHaveBeenCalled()
})
test.each(['0', '-1', '1.5', 'abc'])('rejects invalid capacity %s before saving', async value => {
  const data = form()
  data.set('max_students', value)
  await expect(createGroup(data)).rejects.toThrow('מספר התלמידים המרבי אינו תקין')
  expect(state.rpc).not.toHaveBeenCalled()
})
