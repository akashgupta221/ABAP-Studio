export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { programListWhere } from '@/lib/access'
import { ensureSeeded } from '@/lib/ensure-seed'
import { MODERN_TEMPLATES, isModernKind } from '@/lib/modern'
import {
  clientKey,
  isOwner,
  rateLimit,
  requireUser,
  sameOrigin,
  serverError,
} from '@/lib/session'

const MAX_SOURCE_BYTES = 200_000

// GET /api/modern — list the Modern workspace objects visible to the caller.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response

  try {
    await ensureSeeded()
    const programs = await db.program.findMany({
      where: { AND: [programListWhere(auth.user, isOwner(auth.user)), { environment: 'MODERN' }] },
      orderBy: [{ isExample: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        title: true,
        description: true,
        type: true,
        paradigm: true,
        modernKind: true,
        isExample: true,
        tags: true,
        version: true,
        updatedAt: true,
        owner: { select: { username: true } },
      },
    })
    return NextResponse.json({ programs })
  } catch (error) {
    return serverError('modern/list', error)
  }
}

// POST /api/modern — create a private Modern workspace object.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  const limited = rateLimit(clientKey(req, `modern-create:${auth.user.id}`), 20, 60_000)
  if (limited) return limited

  try {
    await ensureSeeded()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name.trim().toUpperCase() : ''
    const kind = body.modernKind
    if (!/^[A-Za-z_/][A-Za-z0-9_/%$#]*$/.test(name)) {
      return NextResponse.json({ error: 'Invalid object name (use a Z-name)' }, { status: 400 })
    }
    if (name.length > 40) {
      return NextResponse.json({ error: 'Object name is too long (maximum 40 characters)' }, { status: 400 })
    }
    if (!isModernKind(kind)) {
      return NextResponse.json({ error: 'modernKind must be ABAP | CDS | RAP | AMDP' }, { status: 400 })
    }
    const existing = await db.program.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ error: `Object ${name} already exists` }, { status: 409 })
    }
    const title =
      typeof body.title === 'string' && body.title.trim()
        ? body.title.trim()
        : `My Modern ${kind} object`
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const source =
      typeof body.source === 'string' && body.source.trim()
        ? body.source
        : MODERN_TEMPLATES[kind]
    if (title.length > 300 || description.length > 2_000) {
      return NextResponse.json({ error: 'Object metadata is too long' }, { status: 400 })
    }
    if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: 'Source is too large' }, { status: 413 })
    }

    const program = await db.program.create({
      data: {
        name,
        title,
        description,
        type: kind === 'AMDP' ? 'CLASS' : 'REPORT',
        paradigm: kind === 'AMDP' ? 'OOP' : 'BOTH',
        environment: 'MODERN',
        modernKind: kind,
        source,
        tags: `modern,${kind.toLowerCase()}`,
        isExample: false,
        ownerId: auth.user.id,
      },
    })
    return NextResponse.json({ program }, { status: 201 })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'That object name already exists' }, { status: 409 })
    }
    return serverError('modern/create', error)
  }
}
