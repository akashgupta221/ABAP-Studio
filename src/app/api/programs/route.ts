export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { programListWhere } from '@/lib/access'
import { isOwner, requireUser, sameOrigin, serverError, clientKey, rateLimit } from '@/lib/session'

const ALLOWED_TYPES = ['REPORT', 'CLASS', 'INCLUDE', 'FUNCTION_GROUP']
const ALLOWED_PARADIGMS = ['POP', 'OOP', 'BOTH']
const MAX_SOURCE_BYTES = 200_000

// GET /api/programs?type=&topic=&q= — list programs visible to the signed-in user
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response

  try {
    await ensureSeeded()
    const owner = isOwner(auth.user)
    const sp = req.nextUrl.searchParams
    const type = sp.get('type')
    const topicId = sp.get('topicId')
    const q = sp.get('q')
    const filters: Record<string, unknown>[] = [programListWhere(auth.user, owner)]
    // The classic workbench lists STANDARD objects only. Modern artefacts live
    // in the dedicated workspace and are fetched through /api/modern; there is
    // deliberately no query-string override here.
    filters.push({ environment: 'STANDARD' })
    if (type) filters.push({ type })
    if (topicId) filters.push({ topicId: parseInt(topicId) })
    if (q) {
      filters.push({
        OR: [
          { name: { contains: q } },
          { title: { contains: q } },
          { description: { contains: q } },
          { tags: { contains: q } },
        ],
      })
    }

    const programs = await db.program.findMany({
      where: { AND: filters },
      include: { topic: true, owner: { select: { username: true } } },
      orderBy: [{ isExample: 'desc' }, { name: 'asc' }],
    })
    return NextResponse.json({
      programs: programs.map((p) => ({
        id: p.id,
        name: p.name,
        title: p.title,
        description: p.description,
        type: p.type,
        paradigm: p.paradigm,
        environment: p.environment,
        modernKind: p.modernKind,
        isExample: p.isExample,
        tags: p.tags,
        executions: p.executions,
        topicId: p.topicId,
        topicTitle: p.topic?.title ?? null,
        ownerId: p.ownerId,
        ownerUsername: p.owner?.username ?? null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    })
  } catch (error) {
    return serverError('programs/list', error)
  }
}

// POST /api/programs — create a new repository object owned by the caller
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  const limited = rateLimit(clientKey(req, `create:${auth.user.id}`), 30, 60_000)
  if (limited) return limited

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const { name, type = 'REPORT', paradigm = 'BOTH', topicId } = body
    const title = typeof body.title === 'string' ? body.title : ''
    const description = typeof body.description === 'string' ? body.description : ''
    const source = typeof body.source === 'string' ? body.source : ''
    const tags = typeof body.tags === 'string' ? body.tags : ''
    if (typeof name !== 'string' || !/^[A-Za-z_/][A-Za-z0-9_/%$#]*$/.test(name)) {
      return NextResponse.json({ error: 'Invalid object name (use Z-name, letters/digits/underscore)' }, { status: 400 })
    }
    const upperName = name.toUpperCase()
    if (upperName.length > 40) {
      return NextResponse.json({ error: 'Object name is too long (maximum 40 characters)' }, { status: 400 })
    }
    if (upperName.startsWith('Z_MY_PRACTICE')) {
      return NextResponse.json(
        { error: 'Z_MY_PRACTICE is reserved for your private practice sandbox' },
        { status: 409 },
      )
    }
    const existing = await db.program.findUnique({ where: { name: upperName } })
    if (existing) {
      return NextResponse.json({ error: `Object ${upperName} already exists` }, { status: 409 })
    }
    if (typeof type !== 'string' || !ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: 'type must be REPORT | CLASS | INCLUDE | FUNCTION_GROUP' }, { status: 400 })
    }
    if (typeof paradigm !== 'string' || !ALLOWED_PARADIGMS.includes(paradigm)) {
      return NextResponse.json({ error: 'paradigm must be POP | OOP | BOTH' }, { status: 400 })
    }
    if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: 'Program source is too large' }, { status: 413 })
    }
    if (title.length > 300 || description.length > 2_000 || tags.length > 500) {
      return NextResponse.json({ error: 'Program metadata is too long' }, { status: 400 })
    }

    const program = await db.program.create({
      data: {
        name: upperName,
        title,
        description,
        type,
        paradigm,
        environment: 'STANDARD',
        modernKind: 'ABAP',
        topicId: typeof topicId === 'number' && Number.isInteger(topicId) ? topicId : null,
        source,
        tags,
        ownerId: auth.user.id,
      },
    })
    return NextResponse.json({ program }, { status: 201 })
  } catch (error) {
    return serverError('programs/create', error)
  }
}
