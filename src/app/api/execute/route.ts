export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runAbap } from '@/lib/abap'
import { loadEngineContext } from '@/lib/engine-context'
import { canViewProgram } from '@/lib/access'
import {
  clientKey,
  isOwner,
  rateLimit,
  requireUser,
  sameOrigin,
  serverError,
} from '@/lib/session'

const MAX_SOURCE_BYTES = 200_000

// POST /api/execute — run an ABAP program for the signed-in user
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  const limited = rateLimit(clientKey(req, `execute:${auth.user.id}`), 40, 60_000)
  if (limited) return limited

  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string
      source?: string
      parameters?: Record<string, string | string[]>
    }
    const source = body.source
    if (typeof source !== 'string' || !source.trim()) {
      return NextResponse.json({ error: 'source is required' }, { status: 400 })
    }
    if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: 'Program source is too large' }, { status: 413 })
    }
    if (body.parameters !== undefined && (typeof body.parameters !== 'object' || body.parameters === null)) {
      return NextResponse.json({ error: 'parameters must be an object' }, { status: 400 })
    }
    const repid = (body.name || 'ZPROGRAM').toUpperCase().replace(/[^A-Z0-9_/]/g, '').slice(0, 40) || 'ZPROGRAM'

    const { dbSnap, fms, includes } = await loadEngineContext({
      user: auth.user,
      owner: isOwner(auth.user),
    })

    const result = runAbap({
      source,
      repid,
      db: dbSnap,
      includes,
      functionModules: fms,
      parameters: body.parameters,
    })

    // Persist the execution against the caller. A program row is attached only
    // if this user may see it; another user's private name is never incremented.
    try {
      const prog = await db.program.findUnique({ where: { name: repid } })
      const attach = prog && canViewProgram(auth.user, prog, isOwner(auth.user)) ? prog : null
      await db.executionLog.create({
        data: {
          programId: attach?.id ?? null,
          programName: repid,
          userId: auth.user.id,
          status: result.status === 'REQUIRES_INPUT' ? 'SUCCESS' : result.status,
          durationMs: result.durationMs,
          message: result.error?.message?.slice(0, 500) ?? '',
          errorLine: result.error?.line ?? null,
          listLines: result.list.length,
          hadAlv: !!result.alv,
        },
      })
      if (attach) {
        await db.program.update({
          where: { id: attach.id },
          data: { executions: { increment: 1 } },
        })
      }
    } catch (logError) {
      // Logging must not break execution.
      console.error('[execute/log]', logError)
    }

    return NextResponse.json(result)
  } catch (error) {
    return serverError('execute', error)
  }
}
