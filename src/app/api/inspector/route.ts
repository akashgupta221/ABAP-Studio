export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { badRequest, requireUser, serverError } from '@/lib/session'
import { checkSyntax } from '@/lib/abap'
import { inspectSource } from '@/lib/inspector'

// GET /api/inspector?name=ZPROG — SCI/SLIN: static inspection of a repository program
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()
    const name = (req.nextUrl.searchParams.get('name') ?? '').trim().toUpperCase()
    if (!name) return badRequest('name query parameter is required')
    const prog = await db.program.findUnique({ where: { name } })
    if (!prog) return NextResponse.json({ error: `Program ${name} not found` }, { status: 404 })
    const source = prog.source ?? ''
    const report = inspectSource(source)
    const syntax = checkSyntax(source)
      .filter((i) => i.kind === 'E' || i.kind === 'W')
      .map((i) => ({ kind: i.kind, line: i.line, check: 'SYNTAX', message: i.message }))
    return NextResponse.json({
      program: name,
      issues: [...syntax, ...report.issues],
      metrics: report.metrics,
    })
  } catch (error) {
    return serverError('inspector/run', error)
  }
}
