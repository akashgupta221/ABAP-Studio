export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { checkSyntax } from '@/lib/abap'
import { clientKey, rateLimit, requireUser, serverError } from '@/lib/session'

const MAX_SOURCE_BYTES = 200_000

// POST /api/check — SAP-style syntax check (Ctrl+F2)
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response

  const limited = rateLimit(clientKey(req, `check:${auth.user.id}`), 120, 60_000)
  if (limited) return limited

  try {
    const { source } = (await req.json().catch(() => ({}))) as { source?: unknown }
    if (typeof source !== 'string') {
      return NextResponse.json({ error: 'source is required' }, { status: 400 })
    }
    if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: 'Program source is too large' }, { status: 413 })
    }
    const issues = checkSyntax(source)
    return NextResponse.json({ issues })
  } catch (error) {
    return serverError('check', error)
  }
}
