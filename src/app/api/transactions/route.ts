export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { badRequest, requireOwner, requireUser, serverError } from '@/lib/session'

// reserved SAP transaction codes this system already implements — customer
// transactions must not shadow them
const RESERVED = new Set([
  'SE01', 'SE02', 'SE03', 'SE06', 'SE07', 'SE09', 'SE10', 'SE11', 'SE12', 'SE13', 'SE14', 'SE15', 'SE16', 'SE16N',
  'SE17', 'SE18', 'SE19', 'SE21', 'SE24', 'SE30', 'SE32', 'SE35', 'SE36', 'SE37', 'SE38', 'SE39', 'SE41', 'SE43',
  'SE51', 'SE54', 'SE63', 'SE71', 'SE72', 'SE73', 'SE78', 'SE80', 'SE84', 'SE91', 'SE93', 'SA38', 'SA39', 'SM30',
  'SM31', 'SM34', 'SM35', 'SM59', 'SNRO', 'ST22', 'SLG1', 'SP01', 'SPAD', 'NACE', 'CMOD', 'SMOD', 'FIBF', 'SPAU',
  'SPDD', 'SHDB', 'LSMW', 'AL11', 'CG3Y', 'CG3Z', 'FILE', 'SM59', 'BD64', 'WE02', 'WE05', 'WE19', 'WE20', 'WE21',
  'WE30', 'WE31', 'WE81', 'WE82', 'BD87', 'BAPI', 'SO10', 'SMARTFORMS', 'SMARTSTYLES', 'ABAPDOCU', 'ABAPHELP',
  'SEARCH', 'MODERN', 'ADMIN',
])

// GET /api/transactions — SE93: list registered transaction codes
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()
    const codes = await db.transactionCode.findMany({ orderBy: { code: 'asc' } })
    return NextResponse.json({
      transactions: codes.map((t) => ({ code: t.code, program: t.program, description: t.description })),
    })
  } catch (error) {
    return serverError('transactions/list', error)
  }
}

// POST /api/transactions — SE93: register a transaction that starts a report (owner only)
export async function POST(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return badRequest('Request body must be JSON')
    const code = String((body as any).code ?? '').trim().toUpperCase()
    const program = String((body as any).program ?? '').trim().toUpperCase()
    if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(code)) return badRequest('Transaction code must be 2–20 letters, digits or underscore')
    if (RESERVED.has(code)) return badRequest(`${code} is a reserved SAP transaction code`)
    if (!/^Z[Y]?[A-Z0-9_]*$|^Z[A-Z0-9_]*$/.test(program)) {
      if (!program.startsWith('Z')) return badRequest('Only customer reports (Z*) can be assigned to a transaction')
    }
    const prog = await db.program.findUnique({ where: { name: program } })
    if (!prog) return badRequest(`Report ${program} does not exist in the repository`)
    const description = String((body as any).description ?? '').slice(0, 120)
    const saved = await db.transactionCode.upsert({
      where: { code },
      update: { program, description },
      create: { code, program, description },
    })
    return NextResponse.json({ ok: true, code: saved.code, program: saved.program }, { status: 201 })
  } catch (error) {
    return serverError('transactions/save', error)
  }
}

// DELETE /api/transactions?code=ZRUN — SE93: unregister (owner only)
export async function DELETE(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {
    const code = (req.nextUrl.searchParams.get('code') ?? '').trim().toUpperCase()
    if (!code) return badRequest('code query parameter is required')
    await db.transactionCode.deleteMany({ where: { code } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('transactions/delete', error)
  }
}
