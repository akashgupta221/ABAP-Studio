// Client-only Clerk sign-out bridge.
//
// Server-side `sessions.revokeSession()` invalidates the session record, but the
// browser's Clerk JWT remains valid until it expires. Calling Clerk's client
// `signOut()` clears the Clerk cookies immediately so a logoff cannot leave the
// user looking signed in. This is best-effort: if Clerk is not configured (the
// legacy-only development path), there is nothing to clear. The server has
// already revoked the session before this runs.
export async function signOutClerkClient(): Promise<boolean> {
  if (typeof window === 'undefined') return true

  const clerk = (window as Window & {
    Clerk?: { signOut?: () => Promise<void> }
  }).Clerk

  if (!clerk?.signOut) return true

  try {
    await clerk.signOut()
    return true
  } catch {
    return false
  }
}
