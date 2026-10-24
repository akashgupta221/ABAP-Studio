// ── Clerk → SAP user master linking ───────────────────────────────────
// Clerk proves identity; this module maps the verified Clerk account onto the
// existing User row so roles, suspension, programs, favorites and audit history
// remain database-authoritative.
import { clerkClient } from '@clerk/nextjs/server'
import { db, ensureSchema } from '@/lib/db'
import { clerkServerConfigured } from '@/lib/auth-mode'
import {
  baseUsernameFromEmail,
  clerkIdentityFromUser,
  type ClerkIdentity,
  type ClerkUserLike,
  usernameCandidate,
} from '@/lib/clerk-identity'

const AUTH_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  role: true,
  suspended: true,
  sessionVersion: true,
  lastLoginAt: true,
} as const

type SelectedUser = {
  id: string
  username: string
  email: string | null
  role: string
  suspended: boolean
  sessionVersion: number
  lastLoginAt: Date | null
}

function authUser(user: SelectedUser) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    suspended: user.suspended,
    sessionVersion: user.sessionVersion,
  }
}

async function refreshLastLogin(user: SelectedUser): Promise<SelectedUser> {
  const stale =
    !user.lastLoginAt || Date.now() - user.lastLoginAt.getTime() > 15 * 60 * 1000
  if (!stale) return user
  try {
    const updated = await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: AUTH_USER_SELECT,
    })
    return updated
  } catch {
    // A metrics timestamp must never break authentication.
    return user
  }
}

async function uniqueUsername(email: string): Promise<string> {
  const base = baseUsernameFromEmail(email)
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = usernameCandidate(base, attempt)
    const existing = await db.user.findUnique({ where: { username: candidate }, select: { id: true } })
    if (!existing) return candidate
  }
  throw new Error('Unable to allocate a unique SAP user name')
}

async function findByVerifiedEmail(email: string) {
  const direct = await db.user.findUnique({
    where: { email },
    select: { ...AUTH_USER_SELECT, clerkId: true },
  })
  if (direct) return direct

  // Older rows may have mixed-case email values. Only the verified Clerk
  // address may claim one, and ambiguous matches fail closed.
  const matches = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "User" WHERE lower("email") = ${email} LIMIT 2
  `
  if (matches.length > 1) {
    throw new Error('Multiple SAP accounts share this verified email address')
  }
  if (matches.length === 0) return null
  return db.user.findUnique({
    where: { id: matches[0].id },
    select: { ...AUTH_USER_SELECT, clerkId: true },
  })
}

/**
 * Link a Clerk identity to its existing User row by verified email, or create
 * a new ordinary USER. A Clerk identity can never choose its own role.
 */
export async function syncClerkIdentity(identity: ClerkIdentity) {
  await ensureSchema()

  const linked = await db.user.findUnique({
    where: { clerkId: identity.id },
    select: AUTH_USER_SELECT,
  })
  if (linked) {
    if (linked.email !== identity.email) {
      try {
        const updated = await db.user.update({
          where: { id: linked.id },
          data: { email: identity.email },
          select: AUTH_USER_SELECT,
        })
        return authUser(await refreshLastLogin(updated))
      } catch {
        // A verified email collision must not silently take over another row.
        console.error('[clerk] verified email change could not be applied for user', linked.id)
      }
    }
    return authUser(await refreshLastLogin(linked))
  }

  const byEmail = await findByVerifiedEmail(identity.email)

  if (byEmail) {
    if (byEmail.clerkId && byEmail.clerkId !== identity.id) {
      throw new Error('This email address is already linked to a different Clerk account')
    }
    const updated = await db.user.update({
      where: { id: byEmail.id },
      data: {
        clerkId: identity.id,
        email: identity.email,
        // Invalidate any legacy browser session for this account as soon as
        // the verified Clerk identity is linked.
        sessionVersion: { increment: 1 },
        lastLoginAt: new Date(),
      },
      select: AUTH_USER_SELECT,
    })
    return authUser(updated)
  }

  const username = await uniqueUsername(identity.email)
  try {
    const created = await db.user.create({
      data: {
        username,
        passwordHash: 'clerk-only',
        clerkId: identity.id,
        email: identity.email,
        displayName: identity.displayName,
        role: 'USER',
        lastLoginAt: new Date(),
      },
      select: AUTH_USER_SELECT,
    })
    return authUser(created)
  } catch (error) {
    // Concurrent first sign-in/webhook requests can race on the unique keys.
    const existing = await db.user.findUnique({
      where: { clerkId: identity.id },
      select: AUTH_USER_SELECT,
    })
    if (existing) return authUser(existing)
    const sameEmail = await db.user.findUnique({
      where: { email: identity.email },
      select: { ...AUTH_USER_SELECT, clerkId: true },
    })
    if (sameEmail) {
      if (sameEmail.clerkId && sameEmail.clerkId !== identity.id) {
        throw new Error('This email address is already linked to a different Clerk account')
      }
      if (!sameEmail.clerkId) {
        const updated = await db.user.update({
          where: { id: sameEmail.id },
          data: {
            clerkId: identity.id,
            sessionVersion: { increment: 1 },
            lastLoginAt: new Date(),
          },
          select: AUTH_USER_SELECT,
        })
        return authUser(updated)
      }
      return authUser(sameEmail)
    }
    throw error
  }
}

/** Resolve a Clerk session to the database user, linking on first sign-in. */
export async function resolveClerkUser(clerkUserId: string) {
  if (!clerkServerConfigured()) return null

  await ensureSchema()
  const linked = await db.user.findUnique({
    where: { clerkId: clerkUserId },
    select: AUTH_USER_SELECT,
  })
  if (linked) return authUser(await refreshLastLogin(linked))

  const client = await clerkClient()
  const clerkUser = await client.users.getUser(clerkUserId)
  const identity = clerkIdentityFromUser(clerkUser as unknown as ClerkUserLike)
  if (!identity) return null
  return syncClerkIdentity(identity)
}

function isClerkNotFound(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status?: number }).status === 404,
  )
}

/** Revoke every active Clerk session for a linked user. */
export async function revokeClerkUserSessions(clerkId: string): Promise<number> {
  if (!clerkId || !clerkServerConfigured()) return 0
  const client = await clerkClient()
  let sessions: Awaited<ReturnType<typeof client.sessions.getSessionList>>
  try {
    sessions = await client.sessions.getSessionList({
      userId: clerkId,
      status: 'active',
      limit: 100,
    })
  } catch (error) {
    if (isClerkNotFound(error)) return 0
    throw error
  }
  await Promise.all(
    sessions.data.map(async (session) => {
      try {
        await client.sessions.revokeSession(session.id)
      } catch (error) {
        if (!isClerkNotFound(error)) throw error
      }
    }),
  )
  return sessions.data.length
}

export async function banClerkUser(clerkId: string): Promise<void> {
  if (!clerkId || !clerkServerConfigured()) return
  const client = await clerkClient()
  try {
    await client.users.banUser(clerkId)
  } catch (error) {
    if (!isClerkNotFound(error)) throw error
  }
}

export async function unbanClerkUser(clerkId: string): Promise<void> {
  if (!clerkId || !clerkServerConfigured()) return
  const client = await clerkClient()
  try {
    await client.users.unbanUser(clerkId)
  } catch (error) {
    if (!isClerkNotFound(error)) throw error
  }
}

export async function deleteClerkUser(clerkId: string): Promise<void> {
  if (!clerkId || !clerkServerConfigured()) return
  const client = await clerkClient()
  try {
    await client.users.deleteUser(clerkId)
  } catch (error) {
    if (!isClerkNotFound(error)) throw error
  }
}

export async function removeDeletedClerkIdentity(clerkId: string): Promise<void> {
  if (!clerkId) return
  await ensureSchema()
  await db.user.updateMany({
    where: { clerkId },
    data: {
      clerkId: null,
      suspended: true,
      sessionVersion: { increment: 1 },
    },
  })
}
