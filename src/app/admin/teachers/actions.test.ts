import { describe, expect, test, vi, beforeEach } from 'vitest'

type Row = Record<string, any>

function createFakeFrom(tables: Record<string, Row[]>) {
  return function from(table: string) {
    const rows = tables[table] ?? (tables[table] = [])
    const filters: [string, any][] = []
    let pendingUpdate: Row | null = null
    let pendingInsert: Row | null = null
    let isDelete = false

    const applyFilters = (list: Row[]) => list.filter((r) => filters.every(([k, v]) => r[k] === v))

    const builder: any = {
      select() { return builder },
      eq(col: string, val: any) { filters.push([col, val]); return builder },
      update(obj: Row) { pendingUpdate = obj; return builder },
      insert(obj: Row) {
        pendingInsert = { id: obj.id ?? `generated-${rows.length + 1}`, ...obj }
        rows.push(pendingInsert)
        return builder
      },
      delete() { isDelete = true; return builder },
      then(resolve: (v: { error: null }) => void) {
        if (pendingUpdate) {
          for (const r of applyFilters(rows)) Object.assign(r, pendingUpdate)
        }
        if (isDelete) {
          for (const r of applyFilters(rows)) {
            const idx = rows.indexOf(r)
            if (idx >= 0) rows.splice(idx, 1)
          }
        }
        resolve({ error: null })
      },
    }
    return builder
  }
}

const tables: Record<string, Row[]> = {}
const mergeRpc = vi.fn(async () => ({ error: null as null | { message: string } }))
const generateLink = vi.fn()
const listUsers = vi.fn()
const createUser = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: createFakeFrom(tables),
    rpc: mergeRpc,
    auth: { admin: { generateLink, listUsers, createUser } },
  }),
}))
vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(async () => ({ supabase: {}, user: { id: 'admin-1' } })),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => (k === 'host' ? 'example.com' : null) }),
}))
vi.mock('@/lib/email', () => ({ sendTeacherInviteEmail: vi.fn() }))

import { redirect } from 'next/navigation'
import { sendTeacherInviteEmail } from '@/lib/email'
import { inviteTeacher, resendTeacherInvite } from './actions'

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  tables.teachers = [{ id: 'pending-1', name: 'רות', role: 'teacher', is_pending: true }]
  vi.clearAllMocks()
  mergeRpc.mockResolvedValue({ error: null })
})

describe('inviteTeacher', () => {
  test('returns the link and new user id, and never redirects, when the invite link succeeds', async () => {
    generateLink.mockResolvedValueOnce({
      data: { user: { id: 'new-1' }, properties: { action_link: 'https://app.test/invite-abc' } },
      error: null,
    })
    ;(sendTeacherInviteEmail as any).mockResolvedValueOnce(undefined)

    const result = await inviteTeacher('pending-1', 'rut@example.com', 'רות')

    expect(result).toEqual({ link: 'https://app.test/invite-abc', newUserId: 'new-1' })
    expect(redirect).not.toHaveBeenCalled()
  })

  test('still returns the link when the follow-up email send fails', async () => {
    generateLink.mockResolvedValueOnce({
      data: { user: { id: 'new-1' }, properties: { action_link: 'https://app.test/invite-abc' } },
      error: null,
    })
    ;(sendTeacherInviteEmail as any).mockRejectedValueOnce(new Error('smtp down'))

    const result = await inviteTeacher('pending-1', 'rut@example.com', 'רות')

    expect(result.link).toBe('https://app.test/invite-abc')
    expect(result.error).toBeUndefined()
    expect(redirect).not.toHaveBeenCalled()
  })

  test('returns an error and never emails when link generation itself fails', async () => {
    generateLink.mockResolvedValueOnce({ data: null, error: { message: 'invalid email' } })

    const result = await inviteTeacher('pending-1', 'bad-email', 'רות')

    expect(result.error).toContain('שגיאה ביצירת ההזמנה')
    expect(result.link).toBeUndefined()
    expect(sendTeacherInviteEmail).not.toHaveBeenCalled()
  })
})

describe('resendTeacherInvite', () => {
  test('still returns the link when the follow-up email send fails', async () => {
    generateLink.mockResolvedValueOnce({
      data: { properties: { action_link: 'https://app.test/recovery-xyz' } },
      error: null,
    })
    ;(sendTeacherInviteEmail as any).mockRejectedValueOnce(new Error('smtp down'))

    const result = await resendTeacherInvite('teacher-1', 'rut@example.com', 'רות')

    expect(result.link).toBe('https://app.test/recovery-xyz')
    expect(result.error).toBeUndefined()
  })

  test('returns an error when recovery, invite, and createUser all fail', async () => {
    generateLink
      .mockResolvedValueOnce({ data: null, error: { message: 'no user' } }) // recovery attempt
      .mockResolvedValueOnce({ data: null, error: { message: 'invite failed' } }) // invite fallback
    createUser.mockResolvedValueOnce({ data: null, error: { message: 'create failed' } })

    const result = await resendTeacherInvite('teacher-1', 'rut@example.com', 'רות')

    expect(result.error).toContain('שגיאה ביצירת קישור')
    expect(result.link).toBeUndefined()
  })
})

 test('does not email or report success when the atomic transfer fails', async () => {
   generateLink.mockResolvedValueOnce({ data: { user: { id: 'new-1' }, properties: { action_link: 'https://app.test/invite' } }, error: null })
   mergeRpc.mockResolvedValueOnce({ error: { message: 'transfer failed' } })
   const result = await inviteTeacher('pending-1', 'rut@example.com', 'רות')
   expect(result.error).toContain('transfer failed')
   expect(result.link).toBeUndefined()
   expect(sendTeacherInviteEmail).not.toHaveBeenCalled()
   expect(tables.teachers[0].id).toBe('pending-1')
 })
 test('resend fallback transfers all associations through the atomic operation', async () => {
   generateLink.mockResolvedValueOnce({ data: null, error: { message: 'no user' } })
     .mockResolvedValueOnce({ data: { user: { id: 'new-1' }, properties: { action_link: 'https://app.test/invite' } }, error: null })
   const result = await resendTeacherInvite('pending-1', 'rut@example.com', 'רות')
   expect(result.error).toBeUndefined()
   expect(mergeRpc).toHaveBeenCalledWith('merge_teacher_records', expect.objectContaining({ p_source_id: 'pending-1', p_target_id: 'new-1', p_actor_id: 'admin-1', p_pending_only: false }))
 })
