export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  SANDBOX_DESCRIPTION,
  SANDBOX_SOURCE,
  SANDBOX_TAGS,
  SANDBOX_TITLE,
  sandboxName,
} from '@/lib/sandbox'
import { requireUser, sameOrigin, serverError } from '@/lib/session'

// POST /api/sandbox — return this user's private Z_MY_PRACTICE, creating it on
// first use. Names are globally unique, so the physical name carries the user
// name; the workbench presents it as the single "My Practice Program".
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    // The owner may already have a legacy Z_MY_PRACTICE row; preserve it.
    const ownerSandbox = await db.program.findFirst({
      where: { name: 'Z_MY_PRACTICE', ownerId: auth.user.id },
    })
    if (ownerSandbox) return NextResponse.json({ program: ownerSandbox })

    const name = sandboxName(auth.user.username)
    const existing = await db.program.findUnique({ where: { name } })
    if (existing) {
      if (existing.ownerId !== auth.user.id) {
        return NextResponse.json(
          { error: 'Practice sandbox name is already in use — contact the administrator' },
          { status: 409 },
        )
      }
      return NextResponse.json({ program: existing })
    }

    const program = await db.program.create({
      data: {
        name,
        title: SANDBOX_TITLE,
        description: SANDBOX_DESCRIPTION,
        type: 'REPORT',
        paradigm: 'BOTH',
        source: SANDBOX_SOURCE,
        tags: SANDBOX_TAGS,
        ownerId: auth.user.id,
      },
    })
    return NextResponse.json({ program }, { status: 201 })
  } catch (error) {
    return serverError('sandbox/ensure', error)
  }
}
