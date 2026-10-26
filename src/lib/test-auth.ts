// ── Disposable test-session broker ─────────────────────────────────────
// This is NOT a production login path. It exists so API and Playwright tests
// can authenticate against a throwaway database without Clerk network calls or
// a password-based fallback. It is disabled by default and fails closed on any
// deployment signal that could be production (Vercel or a Turso URL).
//
// No AUTH_SECRET is read here. The test secret is generated per test run.

import { createHmac, timingSafeEqual } from 'node:crypto'

export const TEST_SESSION_COOKIE = 'abap_test_session'
export const TEST_SESSION_TTL_MS = 60 * 60 * 1000

export interface TestSession {
  uid: string
  sv: number
  exp: number
}

/** True only for an explicitly configured, non-cloud disposable test run. */
export function testAuthEnabled(): boolean {
  const secret = process.env.E2E_TEST_SECRET ?? ''
  return (
    process.env.E2E_TEST_MODE === '1' &&
    secret.length >= 16 &&
    !process.env.VERCEL &&
    !process.env.TURSO_DATABASE_URL
  )
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function testSecretMatches(provided: string | null | undefined): boolean {
  const expected = process.env.E2E_TEST_SECRET ?? ''
  return testAuthEnabled() && !!provided && safeEqual(provided, expected)
}

function secret(): string {
  const value = process.env.E2E_TEST_SECRET ?? ''
  if (!testAuthEnabled()) throw new Error('Test authentication is not enabled')
  return value
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createTestSessionToken(userId: string, sessionVersion: number): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      sv: sessionVersion,
      exp: Date.now() + TEST_SESSION_TTL_MS,
    }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function parseTestSessionToken(token: string | undefined): TestSession | null {
  if (!token || !testAuthEnabled()) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = sign(payload)
  if (!safeEqual(signature, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      uid?: unknown
      sv?: unknown
      exp?: unknown
    }
    if (typeof data.uid !== 'string' || !data.uid) return null
    if (!Number.isInteger(data.sv)) return null
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null
    return { uid: data.uid, sv: data.sv as number, exp: data.exp }
  } catch {
    return null
  }
}
