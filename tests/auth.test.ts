import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import {
  createTestSessionToken,
  parseTestSessionToken,
  testAuthEnabled,
  testSecretMatches,
  TEST_SESSION_TTL_MS,
} from '../src/lib/test-auth'
import { isOwner } from '../src/lib/session'
import { normalizeUsername, validateUsername } from '../src/lib/username'

const TEST_SECRET = 'unit-test-session-secret-0123456789'
const previous = {
  mode: process.env.E2E_TEST_MODE,
  secret: process.env.E2E_TEST_SECRET,
  vercel: process.env.VERCEL,
  turso: process.env.TURSO_DATABASE_URL,
}

beforeAll(() => {
  process.env.E2E_TEST_MODE = '1'
  process.env.E2E_TEST_SECRET = TEST_SECRET
  delete process.env.VERCEL
  delete process.env.TURSO_DATABASE_URL
})

afterAll(() => {
  if (previous.mode === undefined) delete process.env.E2E_TEST_MODE
  else process.env.E2E_TEST_MODE = previous.mode
  if (previous.secret === undefined) delete process.env.E2E_TEST_SECRET
  else process.env.E2E_TEST_SECRET = previous.secret
  if (previous.vercel === undefined) delete process.env.VERCEL
  else process.env.VERCEL = previous.vercel
  if (previous.turso === undefined) delete process.env.TURSO_DATABASE_URL
  else process.env.TURSO_DATABASE_URL = previous.turso
})

describe('disposable test sessions', () => {
  test('signs, parses, and version-stamps a test token', () => {
    const token = createTestSessionToken('user-1', 7)
    const parsed = parseTestSessionToken(token)
    expect(parsed?.uid).toBe('user-1')
    expect(parsed?.sv).toBe(7)
    expect(parsed?.exp).toBeGreaterThan(Date.now())
    expect(parsed!.exp - Date.now()).toBeLessThanOrEqual(TEST_SESSION_TTL_MS)
  })

  test('rejects tampered and malformed tokens', () => {
    const token = createTestSessionToken('user-1', 1)
    const [payload, signature] = token.split('.')
    expect(parseTestSessionToken(`${payload}.${signature.slice(0, -1)}x`)).toBeNull()
    expect(parseTestSessionToken('not-a-token')).toBeNull()
    expect(parseTestSessionToken(`${payload}.`)).toBeNull()
    expect(parseTestSessionToken(undefined)).toBeNull()
  })

  test('rejects an expired token even with a valid signature', () => {
    const payload = Buffer.from(
      JSON.stringify({ uid: 'u', sv: 1, exp: Date.now() - 1 }),
    ).toString('base64url')
    const signature = createHmac('sha256', TEST_SECRET).update(payload).digest('base64url')
    expect(parseTestSessionToken(`${payload}.${signature}`)).toBeNull()
  })

  test('requires the exact per-run secret and disables on cloud signals', () => {
    expect(testAuthEnabled()).toBe(true)
    expect(testSecretMatches(TEST_SECRET)).toBe(true)
    expect(testSecretMatches('wrong-secret')).toBe(false)
    expect(testSecretMatches(undefined)).toBe(false)

    const token = createTestSessionToken('user-1', 1)
    process.env.VERCEL = '1'
    expect(testAuthEnabled()).toBe(false)
    expect(parseTestSessionToken(token)).toBeNull()
    delete process.env.VERCEL

    process.env.TURSO_DATABASE_URL = 'libsql://example.turso.io'
    expect(testAuthEnabled()).toBe(false)
    delete process.env.TURSO_DATABASE_URL
  })
})

describe('SAP user names and owner gate', () => {
  test('normalizes and validates SAP-style user names', () => {
    expect(normalizeUsername('  akash ')).toBe('AKASH')
    expect(validateUsername('AKASH')).toBeNull()
    expect(validateUsername('A1_B')).toBeNull()
    expect(validateUsername('ab')).not.toBeNull()
    expect(validateUsername('1AKASH')).not.toBeNull()
    expect(validateUsername('AKASH-DEV')).not.toBeNull()
  })

  test('owner gate requires both the stored role and the configured identity', () => {
    const mutableEnv = process.env as Record<string, string | undefined>
    const previousUsername = process.env.OWNER_USERNAME
    const previousEmail = process.env.OWNER_EMAIL
    const previousNodeEnv = process.env.NODE_ENV
    const previousVercel = process.env.VERCEL
    try {
      delete process.env.OWNER_EMAIL
      delete process.env.VERCEL
      process.env.OWNER_USERNAME = 'AKASH'
      expect(isOwner({ username: 'AKASH', role: 'OWNER' })).toBe(true)
      expect(isOwner({ username: 'AKASH', role: 'USER' })).toBe(false)
      expect(isOwner({ username: 'OTHER', role: 'OWNER' })).toBe(false)

      mutableEnv.NODE_ENV = 'production'
      expect(isOwner({ username: 'AKASH', role: 'OWNER' })).toBe(false)
      mutableEnv.NODE_ENV = previousNodeEnv
      process.env.VERCEL = '1'
      expect(isOwner({ username: 'AKASH', role: 'OWNER' })).toBe(false)
      delete process.env.VERCEL

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
      if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV
      else mutableEnv.NODE_ENV = previousNodeEnv
      if (previousVercel === undefined) delete process.env.VERCEL
      else process.env.VERCEL = previousVercel
    }
  })
})
