export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { badRequest, requireOwner, requireUser, serverError } from '@/lib/session'

// GET /api/number-ranges — SNRO: list number range objects
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()

    const ranges = await db.numberRange.findMany({ orderBy: { object: 'asc' } })
    return NextResponse.json({
      ranges: ranges.map((r) => ({
        object: r.object,
        shortText: r.shortText,
        fromNumber: r.fromNumber,
        toNumber: r.toNumber,
        currentNumber: r.currentNumber,
        remaining: Math.max(0, r.toNumber - r.currentNumber),
      })),
    })
  } catch (error) {
    return serverError('number-ranges/list', error)
  }
}

// POST /api/number-ranges — SNRO: create or update an interval (owner only)
export async function POST(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {

      await ensureSeeded()

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return badRequest('Request body must be JSON')
    const object = String((body as any).object ?? '').trim().toUpperCase()
    if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(object)) return badRequest('Number range object must be 2–20 letters, digits or underscore')
    const fromNumber = Math.trunc(Number((body as any).fromNumber))
    const toNumber = Math.trunc(Number((body as any).toNumber))
    if (!Number.isFinite(fromNumber) || !Number.isFinite(toNumber) || fromNumber < 0 || toNumber < 0) {
      return badRequest('Interval bounds must be non-negative integers')
    }
    if (fromNumber >= toNumber) return badRequest('The interval start must be smaller than its end')
    const shortText = String((body as any).shortText ?? '').slice(0, 120)
    const existing = await db.numberRange.findUnique({ where: { object } })
    const saved = await db.numberRange.upsert({
      where: { object },
      update: {
        shortText,
        fromNumber,
        toNumber,
        ...(existing ? { currentNumber: Math.min(Math.max(existing.currentNumber, fromNumber - 1), toNumber) } : {}),
      },
      create: { object, shortText, fromNumber, toNumber, currentNumber: fromNumber - 1 < 0 ? 0 : fromNumber - 1 },
    })
    return NextResponse.json({ ok: true, object: saved.object, currentNumber: saved.currentNumber }, { status: 201 })
  } catch (error) {
    return serverError('number-ranges/save', error)
  }
}

// DELETE /api/number-ranges?object=ZTRAIN_ORDER — SNRO: delete (owner only)
export async function DELETE(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {

      await ensureSeeded()
    const object = (req.nextUrl.searchParams.get('object') ?? '').trim().toUpperCase()
    if (!object) return badRequest('object query parameter is required')
    await db.numberRange.deleteMany({ where: { object } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('number-ranges/delete', error)
  }
}
