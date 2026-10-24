import { describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import {
  createSessionToken,
  hashPassword,
  normalizeUsername,
  parseSessionToken,
  validateUsername,
  verifyPassword,
} from '../src/lib/auth'
import { isOwner } from '../src/lib/session'

describe('built-in authentication', () => {
  test('hashes and verifies a password without storing plaintext', async () => {
    const stored = await hashPassword('Correct-Horse-9')
    expect(stored).not.toContain('Correct-Horse-9')
    expect(await verifyPassword('Correct-Horse-9', stored)).toBe(true)
    expect(await verifyPassword('wrong-password', stored)).toBe(false)
  })

  test('rejects malformed password hashes', async () => {
    expect(await verifyPassword('anything', '')).toBe(false)
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false)
  })

  test('signs, parses, and version-stamps a session token', () => {
    const token = createSessionToken('user-1', 'AKASH', 7)
    expect(parseSessionToken(token)).toEqual({ uid: 'user-1', user: 'AKASH', sv: 7 })
  })

  test('rejects tampered and malformed tokens', () => {
    const token = createSessionToken('user-1', 'AKASH', 1)
    const [payload, sig] = token.split('.')
    expect(parseSessionToken(`${payload}.${sig.slice(0, -1)}x`)).toBeNull()
    expect(parseSessionToken('not-a-token')).toBeNull()
    expect(parseSessionToken(`${payload}.`)).toBeNull()
  })

  test('requires a session version (old-format tokens are invalid)', () => {
    const payload = Buffer.from(
      JSON.stringify({ uid: 'u', u: 'AKASH', exp: Date.now() + 60_000 }),
    ).toString('base64url')
    const sig = createHmac('sha256', process.env.AUTH_SECRET || 'abapforge-development-secret')
      .update(payload)
      .digest('base64url')
    expect(parseSessionToken(`${payload}.${sig}`)).toBeNull()
  })

  test('normalizes and validates SAP-style user names', () => {
    expect(normalizeUsername('  akash ')).toBe('AKASH')
    expect(validateUsername('AKASH')).toBeNull()
    expect(validateUsername('A1_B')).toBeNull()
    expect(validateUsername('ab')).not.toBeNull()
    expect(validateUsername('1AKASH')).not.toBeNull()
    expect(validateUsername('AKASH-DEV')).not.toBeNull()
  })

  test('owner gate requires both the stored role and the configured identity', () => {
    const previousUsername = process.env.OWNER_USERNAME
    const previousEmail = process.env.OWNER_EMAIL
    try {
      delete process.env.OWNER_EMAIL
      process.env.OWNER_USERNAME = 'AKASH'
      expect(isOwner({ username: 'AKASH', role: 'OWNER' })).toBe(true)
      expect(isOwner({ username: 'AKASH', role: 'USER' })).toBe(false)
      expect(isOwner({ username: 'OTHER', role: 'OWNER' })).toBe(false)

      delete process.env.OWNER_USERNAME
      expect(isOwner({ username: 'AKASH', role: 'OWNER' })).toBe(false)

      process.env.OWNER_EMAIL = 'owner@example.com'
      expect(
        isOwner({ username: 'ANYNAME', role: 'OWNER', email: 'OWNER@example.com' }),
      ).toBe(true)
      expect(
        isOwner({ username: 'AKASH', role: 'OWNER', email: 'other@example.com' }),
      ).toBe(false)
      expect(isOwner({ username: 'AKASH', role: 'USER', email: 'owner@example.com' })).toBe(false)
      expect(isOwner({ username: 'AKASH', role: 'OWNER' })).toBe(false)
    } finally {
      if (previousUsername === undefined) delete process.env.OWNER_USERNAME
      else process.env.OWNER_USERNAME = previousUsername
      if (previousEmail === undefined) delete process.env.OWNER_EMAIL
      else process.env.OWNER_EMAIL = previousEmail
    }
  })
})
