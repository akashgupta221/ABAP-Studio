export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { runAbap } from '@/lib/abap'
import { db, ensureSchema } from '@/lib/db'
import { loadDbSnapshot, loadFunctionModules, loadIncludes } from '@/lib/engine-context'
import { ensureSeeded } from '@/lib/ensure-seed'
import { ensureExampleFunctionGroups } from '@/lib/function-groups'
import {
  buildFmTestSource,
  listLinesToText,
  parseFmParams,
} from '@/lib/function-module'
import { canViewFunction } from '@/lib/access'
import {
  clientKey,
  isOwner,
  rateLimit,
  requireUser,
  sameOrigin,
  serverError,
} from '@/lib/session'

// POST /api/functions/test — execute an FM through the normal ABAP engine.
// The generated report calls the function module, then prints control lines
// that are parsed into structured outputs. This is a real execution against
// the caller's isolated engine snapshot, not a canned response.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  const limited = rateLimit(clientKey(req, `fm-test:${auth.user.id}`), 30, 60_000)
  if (limited) return limited

  try {
    await ensureSchema()
    await ensureSeeded()
    await ensureExampleFunctionGroups()

    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown
      inputs?: unknown
    }
    const name = String(body.name ?? '').trim().toUpperCase()
    if (!name) return NextResponse.json({ error: 'Function module name is required' }, { status: 400 })

    const fm = await db.functionModule.findUnique({ where: { name } })
    if (!fm || !canViewFunction(auth.user, fm, isOwner(auth.user))) {
      return NextResponse.json({ error: `Function module ${name} does not exist` }, { status: 404 })
    }

    const rawInputs = body.inputs && typeof body.inputs === 'object' ? body.inputs as Record<string, unknown> : {}
    const inputs: Record<string, string> = {}
    for (const [key, value] of Object.entries(rawInputs).slice(0, 60)) {
      inputs[key.toUpperCase()] = String(value ?? '').slice(0, 500)
    }

    const [dbSnap, fms, includes] = await Promise.all([
      loadDbSnapshot(),
      loadFunctionModules({ user: auth.user, owner: isOwner(auth.user) }, false),
      loadIncludes({ user: auth.user, owner: isOwner(auth.user) }),
    ])
    const knownStructures: Record<string, string[]> = {}
    for (const [tableName, table] of dbSnap.tables) {
      knownStructures[tableName] = table.fields.map((field) => field.name)
    }

    const generated = buildFmTestSource(fm, inputs, knownStructures)
    const result = runAbap({
      source: generated.source,
      repid: `ZFM_TEST_${name}`.slice(0, 40),
      db: dbSnap,
      includes,
      functionModules: fms,
    })
    const lines = listLinesToText(result.list)
    const outputs: Record<string, string> = {}
    let subrc: number | null = null
    const displayLines: string[] = []
    for (const line of lines) {
      if (line.startsWith('FM_SUBRC|')) {
        const value = Number(line.slice('FM_SUBRC|'.length))
        if (Number.isFinite(value)) subrc = value
        continue
      }
      if (line.startsWith('FM_OUT|')) {
        const parts = line.split('|')
        const paramName = parts[1] ?? ''
        if (paramName) outputs[paramName] = parts.slice(2).join('|')
        continue
      }
      if (line.trim()) displayLines.push(line)
    }

    // Keep the monitoring trail real, but never attach a private FM to a program.
    try {
      await db.executionLog.create({
        data: {
          programId: null,
          programName: `FM:${name}`.slice(0, 40),
          userId: auth.user.id,
          status: result.status === 'REQUIRES_INPUT' ? 'SUCCESS' : result.status,
          durationMs: result.durationMs,
          message: result.error?.message?.slice(0, 500) ?? '',
          errorLine: result.error?.line ?? null,
          listLines: result.list.length,
          hadAlv: !!result.alv,
        },
      })
    } catch (logError) {
      console.error('[functions/test/log]', logError)
    }

    return NextResponse.json({
      result,
      lines: displayLines,
      outputs,
      subrc,
      notes: generated.notes,
      params: parseFmParams(fm),
      active: fm.active,
    })
  } catch (error) {
    return serverError('functions/test', error)
  }
}
