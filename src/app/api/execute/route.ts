import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runAbap } from '@/lib/abap'
import { loadEngineContext } from '@/lib/engine-context'

// POST /api/execute — run an ABAP program
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, source, parameters, persistLog = true } = body as {
      name?: string
      source?: string
      parameters?: Record<string, string | string[]>
      persistLog?: boolean
    }
    if (!source) {
      return NextResponse.json({ error: 'source is required' }, { status: 400 })
    }
    const repid = (name || 'ZPROGRAM').toUpperCase()

    const { dbSnap, fms, includes } = await loadEngineContext()

    const result = runAbap({
      source,
      repid,
      db: dbSnap,
      includes,
      functionModules: fms,
      parameters,
    })

    // persist execution log
    if (persistLog) {
      try {
        const prog = await db.program.findUnique({ where: { name: repid } })
        await db.executionLog.create({
          data: {
            programId: prog?.id,
            programName: repid,
            status: result.status === 'REQUIRES_INPUT' ? 'SUCCESS' : result.status,
            durationMs: result.durationMs,
            message: result.error?.message?.slice(0, 500) ?? '',
            errorLine: result.error?.line ?? null,
            listLines: result.list.length,
            hadAlv: !!result.alv,
          },
        })
        if (prog) {
          await db.program.update({
            where: { id: prog.id },
            data: { executions: { increment: 1 } },
          })
        }
      } catch {
        // logging must not break execution
      }
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
