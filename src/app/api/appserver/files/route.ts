export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { badRequest, requireOwner, requireUser, serverError } from '@/lib/session'

const MAX_CONTENT = 100_000 // per-file cap (training system, not a real file server)

function validPath(path: string): boolean {
  return /^\/[A-Za-z0-9_./\-]{1,200}$/.test(path) && !path.includes('..') && /[A-Za-z0-9]$/.test(path)
}

// GET /api/appserver/files — AL11: list directory; ?path= returns one file's content
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()

    const path = req.nextUrl.searchParams.get('path')
    if (path) {
      if (!validPath(path)) return badRequest('Invalid application server path')
      const file = await db.appServerFile.findUnique({ where: { path } })
      if (!file) return NextResponse.json({ error: `File ${path} not found` }, { status: 404 })
      return NextResponse.json({ path: file.path, content: file.content, size: file.content.length, updatedAt: file.updatedAt })
    }
    const files = await db.appServerFile.findMany({ orderBy: { path: 'asc' } })
    return NextResponse.json({
      files: files.map((f) => ({ path: f.path, size: f.content.length, updatedAt: f.updatedAt })),
    })
  } catch (error) {
    return serverError('appserver/list', error)
  }
}

// POST /api/appserver/files — CG3Z (owner upload) / AL11 create: {path, content}
export async function POST(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {

      await ensureSeeded()

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return badRequest('Request body must be JSON')
    const path = String((body as any).path ?? '').trim()
    if (!validPath(path)) return badRequest('Path must be an absolute app-server path like /tmp/training/demo.txt')
    const content = String((body as any).content ?? '')
    if (content.length > MAX_CONTENT) return badRequest(`File content exceeds the ${MAX_CONTENT}-byte training limit`)
    const saved = await db.appServerFile.upsert({
      where: { path },
      update: { content },
      create: { path, content },
    })
    return NextResponse.json({ ok: true, path: saved.path, size: saved.content.length }, { status: 201 })
  } catch (error) {
    return serverError('appserver/save', error)
  }
}

// DELETE /api/appserver/files?path=/tmp/x — AL11 delete (owner only)
export async function DELETE(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {

      await ensureSeeded()
    const path = req.nextUrl.searchParams.get('path') ?? ''
    if (!validPath(path)) return badRequest('Invalid application server path')
    await db.appServerFile.deleteMany({ where: { path } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('appserver/delete', error)
  }
}
