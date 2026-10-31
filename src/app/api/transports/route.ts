export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { badRequest, requireOwner, requireUser, serverError } from '@/lib/session'

// GET /api/transports — SE09/SE10 + STMS: requests with entries; ?queue=released for STMS
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()

    const queue = req.nextUrl.searchParams.get('queue')
    if (queue === 'released') {
      const released = await db.transportRequest.findMany({ where: { status: 'RELEASED' }, orderBy: { id: 'asc' } })
      return NextResponse.json({
        queue: released.map((r) => ({ reqId: r.reqId, description: r.description, type: r.type, releasedAt: r.releasedAt, entries: JSON.parse(r.entries || '[]') })),
      })
    }
    const requests = await db.transportRequest.findMany({ orderBy: { id: 'desc' } })
    return NextResponse.json({
      requests: requests.map((r) => ({
        reqId: r.reqId,
        description: r.description,
        type: r.type,
        status: r.status,
        entries: JSON.parse(r.entries || '[]'),
        createdAt: r.createdAt,
        releasedAt: r.releasedAt,
        importedAt: r.importedAt,
      })),
    })
  } catch (error) {
    return serverError('transports/list', error)
  }
}

// POST /api/transports — SE09/SE10 create request / add object / release; STMS import (owner only)
export async function POST(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {

      await ensureSeeded()

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return badRequest('Request body must be JSON')
    const action = String((body as any).action ?? '')

    if (action === 'create') {
      const type = String((body as any).type ?? 'WORKBENCH').toUpperCase() === 'CUSTOMIZING' ? 'CUSTOMIZING' : 'WORKBENCH'
      const description = String((body as any).description ?? '').slice(0, 120)
      const prefix = type === 'WORKBENCH' ? 'E' : 'D'
      const last = await db.transportRequest.findFirst({ orderBy: { id: 'desc' } })
      const seq = (last?.id ?? 0) + 1
      const reqId = `${prefix}CQ${process.env.SYSTEM_ID ?? 'MER'}K9${String(900000 + seq)}`
      const created = await db.transportRequest.create({
        data: { reqId, description, type, status: 'OPEN', entries: '[]', createdBy: auth.user.username },
      })
      return NextResponse.json({ ok: true, reqId: created.reqId }, { status: 201 })
    }

    if (action === 'add') {
      const reqId = String((body as any).reqId ?? '').trim().toUpperCase()
      const objectType = String((body as any).objectType ?? '').trim().toUpperCase()
      const objectName = String((body as any).objectName ?? '').trim().toUpperCase()
      if (!['PROG', 'TABL', 'MESS', 'TRAN', 'CLAS', 'FUGR'].includes(objectType)) return badRequest('objectType must be PROG, TABL, MESS, TRAN, CLAS or FUGR')
      if (!/^[A-Z0-9_/]{1,40}$/.test(objectName)) return badRequest('Invalid object name')
      const request = await db.transportRequest.findUnique({ where: { reqId } })
      if (!request) return NextResponse.json({ error: `Request ${reqId} not found` }, { status: 404 })
      if (request.status !== 'OPEN') return badRequest(`Request ${reqId} is ${request.status}`)
      const entries = JSON.parse(request.entries || '[]') as { objectType: string; objectName: string }[]
      if (entries.some((e) => e.objectType === objectType && e.objectName === objectName)) {
        return badRequest(`${objectType} ${objectName} is already in ${reqId}`)
      }
      entries.push({ objectType, objectName })
      await db.transportRequest.update({ where: { reqId }, data: { entries: JSON.stringify(entries) } })
      return NextResponse.json({ ok: true, count: entries.length })
    }

    if (action === 'release') {
      const reqId = String((body as any).reqId ?? '').trim().toUpperCase()
      const request = await db.transportRequest.findUnique({ where: { reqId } })
      if (!request) return NextResponse.json({ error: `Request ${reqId} not found` }, { status: 404 })
      if (request.status !== 'OPEN') return badRequest(`Request ${reqId} is already ${request.status}`)
      const entries = JSON.parse(request.entries || '[]') as unknown[]
      if (entries.length === 0) return badRequest('An empty request cannot be released — add at least one object')
      await db.transportRequest.update({ where: { reqId }, data: { status: 'RELEASED', releasedAt: new Date() } })
      return NextResponse.json({ ok: true, reqId })
    }

    if (action === 'import') {
      const reqId = String((body as any).reqId ?? '').trim().toUpperCase()
      const request = await db.transportRequest.findUnique({ where: { reqId } })
      if (!request) return NextResponse.json({ error: `Request ${reqId} not found` }, { status: 404 })
      if (request.status !== 'RELEASED') return badRequest(`Request ${reqId} must be RELEASED before it can be imported (now ${request.status})`)
      await db.transportRequest.update({ where: { reqId }, data: { status: 'IMPORTED', importedAt: new Date() } })
      return NextResponse.json({ ok: true, reqId, note: 'Import simulated — objects are already live in this single-client system' })
    }

    return badRequest('action must be create, add, release or import')
  } catch (error) {
    return serverError('transports/action', error)
  }
}

// DELETE /api/transports?reqId=... — SE09 delete an OPEN request (owner only)
export async function DELETE(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {

      await ensureSeeded()
    const reqId = (req.nextUrl.searchParams.get('reqId') ?? '').trim().toUpperCase()
    if (!reqId) return badRequest('reqId query parameter is required')
    const request = await db.transportRequest.findUnique({ where: { reqId } })
    if (!request) return NextResponse.json({ error: `Request ${reqId} not found` }, { status: 404 })
    if (request.status !== 'OPEN') return badRequest(`Only OPEN requests can be deleted (now ${request.status})`)
    await db.transportRequest.delete({ where: { reqId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('transports/delete', error)
  }
}
