// ── Server-side session and authorization helpers ──────────────────────
// A valid signature is not enough: every request also checks that the user
// still exists, is not suspended, and has not had their session version bumped.
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'
import { clerkServerConfigured } from '@/lib/auth-config'
import { resolveClerkUser } from '@/lib/clerk-user'
import {
  parseTestSessionToken,
  testAuthEnabled,
  TEST_SESSION_COOKIE,
} from '@/lib/test-auth'

export interface AuthUser {
  id: string
  username: string
  email: string | null
  role: string
  suspended: boolean
  sessionVersion: number
}

export type AuthResult =
  | { user: AuthUser; response?: never }
  | { user?: never; response: NextResponse }

async function cookieValue(req: NextRequest | undefined, name: string): Promise<string | undefined> {
  const direct = req?.cookies.get(name)?.value
  if (direct) return direct
  try {
    return (await cookies()).get(name)?.value
  } catch {
    // Outside a request context there is no cookie to inspect.
    return undefined
  }
}

/**
 * Resolve the signed-in user. Clerk is the only production identity provider.
 * A disposable test session may be used only when the test broker is explicitly
 * enabled against a local database. A Clerk session that cannot be mapped fails
 * closed rather than falling through to another identity.
 */
export async function getSessionUser(req?: NextRequest): Promise<AuthUser | null> {
  // Any authenticated request may be the first after a deploy. The additive
  // schema upgrade is cached per process, so this is cheap after the first hit.
  await ensureSchema()
  if (testAuthEnabled()) {
    const token = await cookieValue(req, TEST_SESSION_COOKIE)
    if (token) {
      const session = parseTestSessionToken(token)
      if (!session) return null
      const user = await db.user.findUnique({
        where: { id: session.uid },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          suspended: true,
          sessionVersion: true,
        },
      })
      if (!user || user.suspended || user.sessionVersion !== session.sv) return null
      return user
    }
  }

  if (clerkServerConfigured()) {
    let clerkUserId: string | null = null
    try {
      const session = await auth()
      clerkUserId = session.userId ?? null
    } catch (error) {
      console.error('[clerk] session lookup failed:', error instanceof Error ? error.message : error)
    }

    if (clerkUserId) {
      try {
        const user = await resolveClerkUser(clerkUserId)
        return user && !user.suspended ? user : null
      } catch (error) {
        console.error('[clerk] user linking failed:', error instanceof Error ? error.message : error)
        return null
      }
    }
  }

  return null
}

/** Require any signed-in user. Usage: `const auth = await requireUser(req); if (!auth.user) return auth.response`. */
export async function requireUser(req?: NextRequest): Promise<AuthResult> {
  const user = await getSessionUser(req)
  if (!user) {
    return {
      response: NextResponse.json({ error: 'Authentication required — log on to the system' }, { status: 401 }),
    }
  }
  return { user }
}

function ownerUsername(): string {
  return (process.env.OWNER_USERNAME ?? '').trim().toUpperCase()
}

function ownerEmail(): string {
  return (process.env.OWNER_EMAIL ?? '').trim().toLowerCase()
}

/**
 * The single owner is identified by a server-managed role **and** a matching
 * `OWNER_EMAIL`. Production fails closed when the email is missing: the
 * username fallback exists only for non-production local/unit-test use.
 * Client-supplied roles or Clerk metadata can never grant administration.
 */
export function isOwner(
  user: Pick<AuthUser, 'username' | 'role'> & { email?: string | null },
): boolean {
  if (user.role !== 'OWNER') return false
  const configuredEmail = ownerEmail()
  if (configuredEmail) {
    return Boolean(user.email && user.email.trim().toLowerCase() === configuredEmail)
  }
  // Never fall back to a username on a production deployment.
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') return false
  const configuredUsername = ownerUsername()
  if (!configuredUsername) return false
  return user.username.trim().toUpperCase() === configuredUsername
}

/** Require the designated owner. Denies ordinary users even with valid sessions. */
export async function requireOwner(req: NextRequest): Promise<AuthResult> {
  const auth = await requireUser(req)
  if (!auth.user) return auth
  if (!isOwner(auth.user)) {
    return { response: NextResponse.json({ error: 'Administrator authorization required' }, { status: 403 }) }
  }
  return auth
}

export function forbidden(message = 'You do not have permission to perform this action'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function notFound(message = 'Object not found'): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 })
}

/** Safe error response: log server-side, never leak database/internal messages. */
export function serverError(scope: string, error: unknown): NextResponse {
  console.error(`[${scope}]`, error)
  return NextResponse.json({ error: 'The request could not be completed' }, { status: 500 })
}

/**
 * Lightweight CSRF defence for cookie-authenticated mutations. SameSite=Lax
 * already blocks cross-site POSTs; this additionally rejects a mismatched
 * browser Origin when one is supplied.
 */
export function sameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin')
  if (!origin) return null
  try {
    const requestHost = req.headers.get('host') ?? req.nextUrl.host
    return new URL(origin).host === requestHost
      ? null
      : NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
}

// ── lightweight in-process rate limiting ───────────────────────────────
// Serverless instances are isolated, so this is best-effort abuse protection,
// not a global quota. Execution limits in the interpreter remain authoritative.
const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const now = Date.now()
  // Avoid unbounded growth from many distinct IPs/keys.
  if (buckets.size > 5_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey)
    }
  }
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  current.count += 1
  if (current.count <= limit) return null
  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  return NextResponse.json(
    { error: `Too many requests — try again in ${retryAfter}s` },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}

export function clientKey(req: NextRequest, suffix = ''): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || req.headers.get('x-real-ip') || 'local'
  return `${ip}:${suffix}`
}
