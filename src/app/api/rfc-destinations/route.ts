export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { badRequest, requireOwner, requireUser, serverError } from '@/lib/session'

// GET /api/rfc-destinations — SM59: list destinations; ?name= returns one
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()
    const name = req.nextUrl.searchParams.get('name')
    if (name) {
      const dest = await db.rfcDestination.findUnique({ where: { name: name.trim().toUpperCase() } })
      if (!dest) return NextResponse.json({ error: `RFC destination ${name} not found` }, { status: 404 })
      return NextResponse.json({
        destination: { name: dest.name, description: dest.description, target: dest.target },
        // connection test: the training system is always "reachable" for registered destinations
        test: { status: 'OK', message: 'Connection OK (simulated — logical destination inside the training system)' },
      })
    }
    const dests = await db.rfcDestination.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({
      destinations: dests.map((d) => ({ name: d.name, description: d.description, target: d.target })),
    })
  } catch (error) {
    return serverError('rfc/list', error)
  }
}

// POST /api/rfc-destinations — SM59: create/update a destination (owner only)
export async function POST(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return badRequest('Request body must be JSON')
    const name = String((body as any).name ?? '').trim().toUpperCase()
    if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(name)) return badRequest('Destination name must be 2–20 letters, digits or underscore')
    const data = {
      description: String((body as any).description ?? '').slice(0, 120),
      target: String((body as any).target ?? '').slice(0, 120),
    }
    await db.rfcDestination.upsert({ where: { name }, update: data, create: { name, ...data } })
    return NextResponse.json({ ok: true, name }, { status: 201 })
  } catch (error) {
    return serverError('rfc/save', error)
  }
}

// DELETE /api/rfc-destinations?name=PRODSYS — SM59: delete (owner only)
export async function DELETE(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {
    const name = (req.nextUrl.searchParams.get('name') ?? '').trim().toUpperCase()
    if (!name) return badRequest('name query parameter is required')
    await db.rfcDestination.deleteMany({ where: { name } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('rfc/delete', error)
  }
}
