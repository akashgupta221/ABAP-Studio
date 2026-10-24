export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, sameOrigin, serverError } from '@/lib/session'

// GET /api/favorites — this user's Easy Access favorites
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    const favorites = await db.userFavorite.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ favorites })
  } catch (error) {
    return serverError('favorites/list', error)
  }
}

// POST /api/favorites — add a favorite for this user
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    const { objectType, objectName, label } = (await req.json().catch(() => ({}))) as {
      objectType?: string
      objectName?: string
      label?: string
    }
    if (!objectType || !objectName) {
      return NextResponse.json({ error: 'objectType and objectName required' }, { status: 400 })
    }
    const type = objectType.toUpperCase().slice(0, 30)
    const name = objectName.toUpperCase().slice(0, 120)
    const favorite = await db.userFavorite.upsert({
      where: {
        userId_objectType_objectName: {
          userId: auth.user.id,
          objectType: type,
          objectName: name,
        },
      },
      update: { label: (label ?? '').slice(0, 200) },
      create: {
        userId: auth.user.id,
        objectType: type,
        objectName: name,
        label: (label ?? '').slice(0, 200),
      },
    })
    return NextResponse.json({ favorite }, { status: 201 })
  } catch (error) {
    return serverError('favorites/create', error)
  }
}

// DELETE /api/favorites?objectType=&objectName=
export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    const sp = req.nextUrl.searchParams
    const objectType = sp.get('objectType')
    const objectName = sp.get('objectName')
    if (!objectType || !objectName) {
      return NextResponse.json({ error: 'objectType and objectName required' }, { status: 400 })
    }
    await db.userFavorite.deleteMany({
      where: {
        userId: auth.user.id,
        objectType: objectType.toUpperCase(),
        objectName: objectName.toUpperCase(),
      },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('favorites/delete', error)
  }
}
