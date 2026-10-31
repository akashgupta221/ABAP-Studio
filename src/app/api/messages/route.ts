export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { badRequest, requireOwner, requireUser, serverError } from '@/lib/session'

// GET /api/messages — SE91: list message classes
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()

    const classes = await db.messageClass.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({
      classes: classes.map((c) => ({
        name: c.name,
        description: c.description,
        messages: JSON.parse(c.messages || '[]') as { number: string; text: string }[],
      })),
    })
  } catch (error) {
    return serverError('messages/list', error)
  }
}

// POST /api/messages — SE91: create or update a message class (owner only)
export async function POST(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {

      await ensureSeeded()

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return badRequest('Request body must be JSON')
    const name = String((body as any).name ?? '').trim().toUpperCase()
    if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(name)) return badRequest('Message class name must be 2–20 letters, digits or underscore')
    const rawMessages = Array.isArray((body as any).messages) ? (body as any).messages : []
    const messages: { number: string; text: string }[] = []
    const seen = new Set<string>()
    for (const m of rawMessages.slice(0, 500)) {
      const number = String(m?.number ?? '').replace(/\D/g, '').padStart(3, '0').slice(-3)
      if (number === '000' || seen.has(number)) continue
      seen.add(number)
      messages.push({ number, text: String(m?.text ?? '').slice(0, 200) })
    }
    const data = {
      description: String((body as any).description ?? '').slice(0, 120),
      messages: JSON.stringify(messages),
    }
    const saved = await db.messageClass.upsert({
      where: { name },
      update: data,
      create: { name, ...data },
    })
    return NextResponse.json({ ok: true, name: saved.name, count: messages.length }, { status: 201 })
  } catch (error) {
    return serverError('messages/save', error)
  }
}

// DELETE /api/messages?name=ZMSG — SE91: delete a message class (owner only)
export async function DELETE(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {

      await ensureSeeded()
    const name = (req.nextUrl.searchParams.get('name') ?? '').trim().toUpperCase()
    if (!name) return badRequest('name query parameter is required')
    await db.messageClass.deleteMany({ where: { name } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('messages/delete', error)
  }
}
