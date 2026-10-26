export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runAbapDebug, type DebugControl, type DebugStopContext } from '@/lib/abap'
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

type DebugCmd = 'start' | 'stepInto' | 'stepOver' | 'continue'

// POST /api/debug — step through an ABAP program under debugger control.
//
// Unlike App 2's in-memory engine registry, this endpoint is fully stateless so
// it works on serverless deployments: every request re-runs the program from the
// start with a stop predicate and pauses at the requested statement. The client
// only tracks the last stop index; the deterministic engine reproduces the same
// execution each time. DB writes inside ABAP stay in the per-run snapshot, so
// re-execution never touches persisted rows.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  // stepping issues one request per statement — a larger budget than /api/execute
  const limited = rateLimit(clientKey(req, `debug:${auth.user.id}`), 240, 60_000)
  if (limited) return limited

  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string
      source?: string
      parameters?: Record<string, string | string[]>
      cmd?: string
      stopIndex?: number
      depth?: number
      breakpoints?: number[]
    }
    const source = body.source
    if (typeof source !== 'string' || !source.trim()) {
      return NextResponse.json({ error: 'source is required' }, { status: 400 })
    }
    if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: 'Program source is too large' }, { status: 413 })
    }
    const cmd = (body.cmd ?? 'start') as DebugCmd
    if (!['start', 'stepInto', 'stepOver', 'continue'].includes(cmd)) {
      return NextResponse.json({ error: `Unknown debug command ${cmd}` }, { status: 400 })
    }
    const breakpoints = Array.isArray(body.breakpoints)
      ? [...new Set(body.breakpoints.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b)
      : []
    const startIndex = Number.isInteger(body.stopIndex) && body.stopIndex! > 0 ? body.stopIndex! : 0
    const startDepth = Number.isInteger(body.depth) && body.depth! >= 0 ? body.depth! : 0
    if (cmd !== 'start' && startIndex === 0) {
      return NextResponse.json({ error: 'stopIndex is required for stepping' }, { status: 400 })
    }
    const repid = (body.name || 'ZPROGRAM').toUpperCase().replace(/[^A-Z0-9_/]/g, '').slice(0, 40) || 'ZPROGRAM'

    const { dbSnap, fms, includes } = await loadEngineContext({
      user: auth.user,
      owner: isOwner(auth.user),
    })

    const control: DebugControl = { shouldStop: (ctx) => shouldStop(cmd, ctx, startIndex, startDepth, breakpoints) }
    const { paused, result } = runAbapDebug(
      {
        source,
        repid,
        db: dbSnap,
        includes,
        functionModules: fms,
        parameters: body.parameters,
      },
      control,
    )

    if (paused) {
      return NextResponse.json({
        status: 'PAUSED',
        stop: {
          stopIndex: paused.stopIndex,
          line: paused.line,
          depth: paused.depth,
          kind: paused.kind,
          statement: paused.statement,
          variables: paused.variables,
        },
        list: paused.list ?? [],
        messages: paused.messages ?? [],
      })
    }

    // run completed (no stop requested or end reached)
    if (result && result.status === 'REQUIRES_INPUT') {
      return NextResponse.json({
        status: 'REQUIRES_INPUT',
        selectionScreen: result.selectionScreen ?? [],
      })
    }
    await logEndedRun({ id: auth.user.id, username: auth.user.username }, repid, result, isOwner(auth.user))
    return NextResponse.json({ ...result, ended: true })
  } catch (error) {
    return serverError('debug', error)
  }
}

function shouldStop(
  cmd: DebugCmd,
  ctx: DebugStopContext,
  startIndex: number,
  startDepth: number,
  breakpoints: number[],
): boolean {
  switch (cmd) {
    case 'start':
      return true // first executable statement
    case 'stepInto':
      return ctx.stopIndex > startIndex
    case 'stepOver':
      return ctx.stopIndex > startIndex && ctx.depth <= startDepth
    case 'continue':
      return ctx.stopIndex > startIndex && breakpoints.includes(ctx.line)
  }
}

async function logEndedRun(
  user: { id: string; username: string },
  repid: string,
  result: { status: string; durationMs: number; error?: { message?: string; abapType?: string; line?: number }; list: unknown[]; alv?: unknown } | null,
  owner: boolean,
): Promise<void> {
  if (!result) return
  try {
    // Attach the log to the program row only if this user may see it — the
    // same contract as /api/execute. A foreign private name is never incremented.
    const prog = await db.program.findUnique({ where: { name: repid } })
    const attach = prog && canViewProgram(user, { ownerId: prog.ownerId, isExample: prog.isExample }, owner) ? prog : null
    await db.executionLog.create({
      data: {
        programId: attach?.id ?? null,
        programName: repid,
        userId: user.id,
        status: result.status,
        durationMs: result.durationMs,
        message: result.error?.message?.slice(0, 500) ?? '',
        errorType: result.error?.abapType ?? null,
        errorLine: result.error?.line ?? null,
        listLines: result.list.length,
        hadAlv: !!result.alv,
      },
    })
  } catch (logError) {
    // Logging must not break debugging.
    console.error('[debug/log]', logError)
  }
}
