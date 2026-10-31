export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { badRequest, forbidden, requireOwner, requireUser, serverError } from '@/lib/session'
import { canViewProgram, isLegacyProgram } from '@/lib/access'
import { loadEngineContext } from '@/lib/engine-context'
import { isOwner } from '@/lib/session'
import { loadAppServerFiles, loadDbSnapshot, loadFunctionModules, loadIncludes, loadMessageClasses, loadNumberRanges } from '@/lib/engine-context'
import { runAbap } from '@/lib/abap'

// GET /api/jobs — SM37: run due jobs, then list all jobs with their logs
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()

    const now = new Date()
    const due = await db.backgroundJob.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } } })
    for (const job of due.slice(0, 10)) {
      await runJob(job.id, job.createdBy)
    }
    const jobs = await db.backgroundJob.findMany({ orderBy: { id: 'desc' } })
    return NextResponse.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        report: j.report,
        status: j.status,
        scheduledAt: j.scheduledAt,
        startedAt: j.startedAt,
        finishedAt: j.finishedAt,
        resultStatus: j.resultStatus,
        resultError: j.resultError,
        lines: (JSON.parse(j.resultLog || '[]') as unknown[]).length,
      })),
    })
  } catch (error) {
    return serverError('jobs/list', error)
  }
}

// GET job result detail via /api/jobs?id=N
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    const body = await req.json().catch(() => null)
    if (body && typeof body === 'object' && body.id !== undefined) {
      const job = await db.backgroundJob.findUnique({ where: { id: Math.trunc(Number(body.id)) } })
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      return NextResponse.json({
        job: {
          id: job.id, name: job.name, report: job.report, status: job.status,
          scheduledAt: job.scheduledAt, startedAt: job.startedAt, finishedAt: job.finishedAt,
          resultStatus: job.resultStatus, resultError: job.resultError,
          log: JSON.parse(job.resultLog || '[]'),
        },
      })
    }
    return badRequest('id is required')
  } catch (error) {
    return serverError('jobs/detail', error)
  }
}

// PUT /api/jobs — SM36: schedule a background job (owner only)
export async function PUT(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {

      await ensureSeeded()

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return badRequest('Request body must be JSON')
    const name = String((body as any).name ?? '').trim().slice(0, 60)
    const report = String((body as any).report ?? '').trim().toUpperCase()
    if (!name) return badRequest('Job name is required')
    if (!/^[A-Za-z_/][A-Za-z0-9_/%$#]*$/.test(report)) return badRequest('Invalid report name')
    const prog = await db.program.findUnique({ where: { name: report } })
    if (!prog) return badRequest(`Report ${report} does not exist`)
    if (isLegacyProgram(prog)) return badRequest('Includes and unsupported object types cannot run as jobs')
    if (!canViewProgram(auth.user, prog, true)) return forbidden('You cannot run this report')
    const delaySeconds = Math.max(0, Math.min(86400, Math.trunc(Number((body as any).delaySeconds ?? 0)) || 0))
    const scheduledAt = new Date(Date.now() + delaySeconds * 1000)
    const created = await db.backgroundJob.create({
      data: {
        name, report,
        parameters: JSON.stringify(typeof (body as any).parameters === 'object' && (body as any).parameters ? (body as any).parameters : {}),
        status: 'SCHEDULED',
        scheduledAt,
        createdBy: auth.user.username,
      },
    })
    return NextResponse.json({ ok: true, id: created.id, scheduledAt: created.scheduledAt }, { status: 201 })
  } catch (error) {
    return serverError('jobs/create', error)
  }
}

// DELETE /api/jobs?id=N — SM37: cancel a scheduled job (owner only)
export async function DELETE(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {

      await ensureSeeded()
    const id = Math.trunc(Number(req.nextUrl.searchParams.get('id')))
    if (!Number.isInteger(id)) return badRequest('id query parameter is required')
    const job = await db.backgroundJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status !== 'SCHEDULED') return badRequest(`Job ${id} is ${job.status} and can no longer be canceled`)
    await db.backgroundJob.update({ where: { id }, data: { status: 'CANCELED' } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('jobs/cancel', error)
  }
}

// run a scheduled job now: engine execution, results stored on the job
async function runJob(jobId: number, createdBy: string) {
  const job = await db.backgroundJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== 'SCHEDULED') return
  const creator = await db.user.findFirst({ where: { username: job.createdBy } })
  const viewer = creator ? { user: creator, owner: isOwner(creator) } : { user: { id: '', username: job.createdBy }, owner: false }
  const startedAt = new Date()
  await db.backgroundJob.update({ where: { id: jobId }, data: { status: 'READY', startedAt } })
  try {
    const [{ dbSnap, fms, includes, messageClasses, numberRanges, files }, prog] = await Promise.all([
      loadEngineContext(viewer),
      db.program.findUnique({ where: { name: job.report } }),
    ])
    if (!prog) {
      await db.backgroundJob.update({ where: { id: jobId }, data: { status: 'FINISHED', finishedAt: new Date(), resultStatus: 'ERROR', resultError: `Report ${job.report} no longer exists` } })
      return
    }
    const result = runAbap({
      source: prog.source ?? '',
      repid: prog.name,
      db: dbSnap,
      includes,
      functionModules: fms,
      messageClasses,
      numberRanges,
      files,
      parameters: JSON.parse(job.parameters || '{}'),
    })
    await db.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'FINISHED',
        finishedAt: new Date(),
        resultStatus: result.status === 'REQUIRES_INPUT' ? 'SUCCESS' : result.status,
        resultLog: JSON.stringify((result.list ?? []).slice(0, 500).map((l: any) => (l.segments ?? []).map((s: any) => s.text ?? '').join(''))),
        resultError: result.error ? `${result.error.kind}: ${result.error.message}`.slice(0, 500) : '',
      },
    })
  } catch (error) {
    await db.backgroundJob.update({
      where: { id: jobId },
      data: { status: 'FINISHED', finishedAt: new Date(), resultStatus: 'ERROR', resultError: String((error as Error).message ?? error).slice(0, 500) },
    })
  }
}
