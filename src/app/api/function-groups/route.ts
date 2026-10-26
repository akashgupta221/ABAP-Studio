export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { ensureExampleFunctionGroups } from '@/lib/function-groups'
import { FUNCTION_GROUP_NAME_RE, changedOnNow } from '@/lib/function-module'
import { functionGroupListWhere, functionListWhere } from '@/lib/access'
import { isOwner, requireUser, sameOrigin, serverError } from '@/lib/session'

// GET /api/function-groups — visible function groups with module counts.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response

  try {
    await ensureSchema()
    await ensureSeeded()
    await ensureExampleFunctionGroups()
    const owner = isOwner(auth.user)
    const [groups, counts] = await Promise.all([
      db.functionGroup.findMany({
        where: functionGroupListWhere(auth.user, owner),
        include: { owner: { select: { username: true } } },
        orderBy: { name: 'asc' },
      }),
      db.functionModule.groupBy({
        by: ['groupName'],
        where: functionListWhere(auth.user, owner),
        _count: { groupName: true },
      }),
    ])
    const countMap = new Map(counts.map((row) => [row.groupName, row._count.groupName]))
    return NextResponse.json({
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        shortText: group.shortText,
        isExample: group.isExample,
        ownerId: group.ownerId,
        ownerUsername: group.owner?.username ?? null,
        createdBy: group.createdBy,
        changedOn: group.changedOn,
        moduleCount: countMap.get(group.name) ?? 0,
      })),
    })
  } catch (error) {
    return serverError('function-groups', error)
  }
}

// POST /api/function-groups — create a private function group.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    await ensureSchema()
    await ensureSeeded()
    await ensureExampleFunctionGroups()

    const body = (await req.json().catch(() => ({}))) as { name?: unknown; shortText?: unknown }
    const name = String(body.name ?? '').trim().toUpperCase()
    const shortText = String(body.shortText ?? '').trim().slice(0, 120)

    if (!name) {
      return NextResponse.json({ error: 'Make an entry in field FUNCTION GROUP' }, { status: 400 })
    }
    if (!FUNCTION_GROUP_NAME_RE.test(name)) {
      return NextResponse.json(
        { error: 'Function group name must start with Z or Y and contain only letters, digits and underscores (max 26).' },
        { status: 400 },
      )
    }
    const existing = await db.functionGroup.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ error: `Function group ${name} already exists` }, { status: 409 })
    }

    const group = await db.functionGroup.create({
      data: {
        name,
        shortText,
        isExample: false,
        ownerId: auth.user.id,
        createdBy: auth.user.username,
        changedOn: changedOnNow(),
      },
      include: { owner: { select: { username: true } } },
    })
    return NextResponse.json(
      {
        group: {
          id: group.id,
          name: group.name,
          shortText: group.shortText,
          isExample: group.isExample,
          ownerId: group.ownerId,
          ownerUsername: group.owner?.username ?? null,
          createdBy: group.createdBy,
          changedOn: group.changedOn,
          moduleCount: 0,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return serverError('function-groups/create', error)
  }
}
