// ── Pure Clerk identity mapping rules ─────────────────────────────────
// Kept free of server/database imports so the rules can be unit-tested and
// reused by the signed webhook route.

export interface ClerkEmailLike {
  id: string
  emailAddress: string
  verification: { status?: string | null } | null
}

export interface ClerkUserLike {
  id: string
  primaryEmailAddressId: string | null
  emailAddresses: ClerkEmailLike[]
  firstName?: string | null
  lastName?: string | null
  username?: string | null
}

/** Clerk webhook JSON uses snake_case, unlike the Backend API classes. */
export interface ClerkWebhookUserLike {
  id: string
  primary_email_address_id: string | null
  email_addresses: Array<{
    id: string
    email_address: string
    verification: { status?: string | null } | null
  }>
  first_name?: string | null
  last_name?: string | null
  username?: string | null
}

export interface ClerkIdentity {
  id: string
  email: string
  displayName: string
}

/** Return the primary verified email, or another verified address, lowercased. */
export function verifiedEmailFromClerk(user: ClerkUserLike): string | null {
  const primary = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)
  const verified =
    (primary?.verification?.status === 'verified' ? primary : null) ??
    user.emailAddresses.find((address) => address.verification?.status === 'verified')
  if (!verified) return null
  const email = verified.emailAddress.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

/** A deterministic SAP-style base name derived from the verified email. */
export function baseUsernameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  let base = local.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 20)
  if (!/^[A-Z]/.test(base)) base = `U${base}`.slice(0, 20)
  if (base.length < 3) base = `${base}USER`.slice(0, 20)
  return base || 'USER'
}

/** Append a numeric collision suffix while keeping the SAP 20-char limit. */
export function usernameCandidate(base: string, attempt: number): string {
  if (attempt <= 0) return base.slice(0, 20)
  const suffix = String(attempt)
  return `${base.slice(0, Math.max(0, 20 - suffix.length))}${suffix}`
}

export function displayNameFromClerk(user: ClerkUserLike, fallback: string): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return name || user.username?.trim() || fallback
}

export function clerkIdentityFromUser(user: ClerkUserLike): ClerkIdentity | null {
  const email = verifiedEmailFromClerk(user)
  if (!email) return null
  return {
    id: user.id,
    email,
    displayName: displayNameFromClerk(user, email.split('@')[0] || 'ABAP User'),
  }
}

export function webhookUserToClerkUser(user: ClerkWebhookUserLike): ClerkUserLike {
  return {
    id: user.id,
    primaryEmailAddressId: user.primary_email_address_id,
    emailAddresses: user.email_addresses.map((address) => ({
      id: address.id,
      emailAddress: address.email_address,
      verification: address.verification,
    })),
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
  }
}

export function clerkIdentityFromWebhookUser(user: ClerkWebhookUserLike): ClerkIdentity | null {
  return clerkIdentityFromUser(webhookUserToClerkUser(user))
}
