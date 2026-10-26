export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

// POST /api/auth/login — the built-in password logon is permanently retired.
// Clerk (Email OTP + Google) is the only interactive sign-in path.
export async function POST() {
  return NextResponse.json(
    { error: 'Password logon is retired — use the secure Clerk sign-in' },
    { status: 403 },
  )
}
