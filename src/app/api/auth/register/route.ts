export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

// POST /api/auth/register — public password registration is permanently gone.
// New identities are created by Clerk after the email is verified.
export async function POST() {
  return NextResponse.json(
    { error: 'Password registration is retired — create a verified Clerk account' },
    { status: 410 },
  )
}
