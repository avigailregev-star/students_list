import { describe, expect, test, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { verifyPasswordResetSession, validateNewPassword, passwordErrorMessage, RESET_LINK_ERROR } from './passwordReset'

function client() {
  const auth = {
    exchangeCodeForSession: vi.fn(async (_code: string) => ({ error: null })),
    verifyOtp: vi.fn(async (_data: unknown) => ({ error: null })),
    setSession: vi.fn(async (_data: unknown) => ({ error: null })),
    getUser: vi.fn(async () => ({ data: { user: { id: 'test' } as { id: string } | null }, error: null })),
  }
  return { auth, api: auth as unknown as SupabaseClient['auth'] }
}

describe('password recovery', () => {
  test('rejects an expired link even when another session exists', async () => {
    const { auth, api } = client()
    await expect(verifyPasswordResetSession(api, 'https://example.test/reset-password#error=access_denied&error_code=otp_expired')).rejects.toThrow(RESET_LINK_ERROR)
    expect(auth.getUser).not.toHaveBeenCalled()
  })
  test('exchanges the code and validates the user with Auth', async () => {
    const { auth, api } = client()
    await verifyPasswordResetSession(api, 'https://example.test/reset-password?code=code')
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('code')
    expect(auth.getUser).toHaveBeenCalledOnce()
  })
  test.each(['recovery', 'invite', 'signup'])('preserves the %s verification type', async type => {
    const { auth, api } = client()
    await verifyPasswordResetSession(api, `https://example.test/reset-password?token_hash=token&type=${type}`)
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'token', type })
  })
  test('rejects unsupported verification types', async () => {
    const { api } = client()
    await expect(verifyPasswordResetSession(api, 'https://example.test/reset-password?token_hash=token&type=email_change')).rejects.toThrow(RESET_LINK_ERROR)
  })
  test('requires both hash tokens', async () => {
    const { api } = client()
    await expect(verifyPasswordResetSession(api, 'https://example.test/reset-password#access_token=test')).rejects.toThrow(RESET_LINK_ERROR)
  })
  test('sets both tokens then verifies the user', async () => {
    const { auth, api } = client()
    await verifyPasswordResetSession(api, 'https://example.test/reset-password#access_token=a&refresh_token=r')
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' })
    expect(auth.getUser).toHaveBeenCalledOnce()
  })
  test('rejects missing authentication', async () => {
    const { auth, api } = client()
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(verifyPasswordResetSession(api, 'https://example.test/reset-password')).rejects.toThrow(RESET_LINK_ERROR)
  })
  test('validates length and matching confirmation', () => {
    expect(validateNewPassword('123', '123')).toBeTruthy()
    expect(validateNewPassword('123456', '654321')).toBeTruthy()
    expect(validateNewPassword('long-password', 'long-password')).toBeNull()
    expect(passwordErrorMessage('New password should be different from the old password')).toContain('שונה')
  })
})
