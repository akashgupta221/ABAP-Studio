// ── Authentication provider configuration ─────────────────────────────
// Clerk is the only production identity provider. The retired built-in
// password path is intentionally absent.

/** The browser SDK can be rendered when a publishable key is present. */
export function clerkPublishableConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
}

/** Server-side Clerk API/session calls require both keys. */
export function clerkServerConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY)
}
