// ── SAP-style user-name rules ─────────────────────────────────────────
// Kept separate from authentication so the retired built-in password code
// cannot leak back into the Clerk-only deployment.

export function normalizeUsername(raw: string): string {
  return raw.trim().toUpperCase()
}

export function validateUsername(username: string): string | null {
  if (!/^[A-Z][A-Z0-9_]{2,19}$/.test(username)) {
    return 'User name must be 3–20 characters (letters, digits, _) and start with a letter'
  }
  return null
}
