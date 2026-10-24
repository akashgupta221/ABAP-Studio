// ── Authentication cutover mode ────────────────────────────────────────
// Clerk is the primary identity provider. The built-in user master remains
// available only as a deliberately temporary fallback while existing accounts
// are linked by verified email.
export type LegacyAuthMode = 'off' | 'fallback' | 'full'

/** The browser SDK can be rendered when a publishable key is present. */
export function clerkPublishableConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
}

/** Server-side Clerk API/session calls require both keys. */
export function clerkServerConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY)
}

/**
 * `full` keeps legacy registration for disposable local tests.
 * `fallback` keeps legacy logon for unmapped accounts but blocks new password
 * accounts. `off` retires the legacy endpoints entirely.
 */
export function legacyAuthMode(): LegacyAuthMode {
  const configured = (process.env.LEGACY_AUTH_MODE ?? '').trim().toLowerCase()
  if (configured === 'off' || configured === 'fallback' || configured === 'full') {
    return configured
  }
  // Production never invents new password accounts, even if Clerk keys are
  // temporarily missing. Development keeps the disposable local fallback.
  return process.env.NODE_ENV === 'production' ? 'fallback' : 'full'
}

export function legacyLoginEnabled(): boolean {
  return legacyAuthMode() !== 'off'
}

export function legacyRegistrationEnabled(): boolean {
  return legacyAuthMode() === 'full'
}

export function legacyAuthVisibleInUi(): boolean {
  const configured = (process.env.NEXT_PUBLIC_LEGACY_AUTH_MODE ?? '').trim().toLowerCase()
  if (configured === 'off') return false
  if (configured === 'fallback' || configured === 'full') return true
  // Before the production cutover the legacy form is still visible. After the
  // Clerk publishable key is configured it remains a clearly marked fallback.
  return true
}
