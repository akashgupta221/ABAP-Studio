// ── Built-in user master (SAP-style logon) ─────────────────────────────
// Passwords: scrypt with a per-user salt. Sessions: HMAC-signed token in an
// HTTP-only cookie — same browser promise as the real SAP logon pad.
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

export const SESSION_COOKIE = 'sap_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function secret(): string {
  // Set AUTH_SECRET in the hosting environment (Vercel) — see DEPLOY.md.
  // Production fails closed rather than signing sessions with a public default.
  const value = process.env.AUTH_SECRET
  if (value) return value
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be set in production')
  }
  return 'abapforge-development-secret'
}

// ── passwords ──────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, 32)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const hash = await scrypt(password, Buffer.from(saltHex, 'hex'), 32)
  const expected = Buffer.from(hashHex, 'hex')
  return hash.length === expected.length && timingSafeEqual(hash, expected)
}

// ── session tokens ─────────────────────────────────────────────────────
// `sv` is the user's session version. Every authenticated request compares it
// with the database value, so logout, suspension, and administrative revocation
// invalidate tokens server-side instead of relying on the browser to forget them.
export interface SessionUser {
  uid: string
  user: string
  sv: number
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createSessionToken(uid: string, username: string, sessionVersion: number): string {
  const payload = Buffer.from(
    JSON.stringify({ uid, u: username, sv: sessionVersion, exp: Date.now() + SESSION_TTL_MS }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function parseSessionToken(token: string): SessionUser | null {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      uid?: string
      u?: string
      sv?: number
      exp?: number
    }
    if (!data.uid || !data.u || !data.exp || data.exp < Date.now()) return null
    if (!Number.isInteger(data.sv)) return null
    return { uid: data.uid, user: data.u, sv: data.sv as number }
  } catch {
    return null
  }
}

// ── username rules (SAP: uppercase, start with a letter) ───────────────
export function normalizeUsername(raw: string): string {
  return raw.trim().toUpperCase()
}

export function validateUsername(username: string): string | null {
  if (!/^[A-Z][A-Z0-9_]{2,19}$/.test(username)) {
    return 'User name must be 3–20 characters (letters, digits, _) and start with a letter'
  }
  return null
}
