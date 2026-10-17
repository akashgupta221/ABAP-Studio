import { NextRequest, NextResponse } from 'next/server'
import { checkSyntax } from '@/lib/abap'

// POST /api/check — SAP-style syntax check (Ctrl+F2)
export async function POST(req: NextRequest) {
  try {
    const { source } = await req.json()
    if (typeof source !== 'string') {
      return NextResponse.json({ error: 'source is required' }, { status: 400 })
    }
    const issues = checkSyntax(source)
    return NextResponse.json({ issues })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
