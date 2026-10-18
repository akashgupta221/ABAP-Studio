export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/favorites — Easy Access favorites
export async function GET() {
  try {
    const favorites = await db.favorite.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ favorites })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/favorites — add favorite
export async function POST(req: NextRequest) {
  try {
    const { objectType, objectName, label } = await req.json()
    if (!objectType || !objectName) {
      return NextResponse.json({ error: 'objectType and objectName required' }, { status: 400 })
    }
    const favorite = await db.favorite.upsert({
      where: {
        objectType_objectName: {
          objectType: objectType.toUpperCase(),
          objectName: objectName.toUpperCase(),
        },
      },
      update: { label: label ?? '' },
      create: {
        objectType: objectType.toUpperCase(),
        objectName: objectName.toUpperCase(),
        label: label ?? '',
      },
    })
    return NextResponse.json({ favorite }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/favorites?objectType=&objectName=
export async function DELETE(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const objectType = sp.get('objectType')
    const objectName = sp.get('objectName')
    if (!objectType || !objectName) {
      return NextResponse.json({ error: 'objectType and objectName required' }, { status: 400 })
    }
    await db.favorite.deleteMany({
      where: { objectType: objectType.toUpperCase(), objectName: objectName.toUpperCase() },
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
