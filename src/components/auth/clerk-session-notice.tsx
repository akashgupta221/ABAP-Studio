'use client'

import { useAuth, useClerk } from '@clerk/nextjs'

// This wrapper keeps Clerk hooks out of the tree when Clerk is not configured
// (local/CI builds without keys still render the legacy fallback).
export function ClerkSessionNotice() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null
  return <ClerkSessionNoticeInner />
}

function ClerkSessionNoticeInner() {
  const { isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()

  if (!isLoaded || !isSignedIn) return null

  return (
    <div className="mf-auth-notice flex flex-wrap items-center gap-2">
      <span>A secure Clerk session is already active. Sign out to use a different account.</span>
      <button
        type="button"
        className="mf-btn ml-auto"
        onClick={() => {
          void signOut()
            .catch(() => {})
            .finally(() => window.location.assign('/'))
        }}
      >
        Sign out of Clerk
      </button>
    </div>
  )
}
