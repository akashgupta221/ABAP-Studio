export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { checkSyntax } from '@/lib/abap'
import { isModernKind, validateModernSource, type ModernIssue } from '@/lib/modern'
import { clientKey, rateLimit, requireUser, serverError } from '@/lib/session'

const MAX_SOURCE_BYTES = 200_000

// POST /api/modern/validate — validate a Modern definition.
// ABAP is checked by the executable engine's parser. CDS/RAP/AMDP are checked
// structurally by the simulator and never executed.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response

  const limited = rateLimit(clientKey(req, `modern-validate:${auth.user.id}`), 90, 60_000)
  if (limited) return limited

  try {
    const body = (await req.json().catch(() => ({}))) as { kind?: unknown; source?: unknown }
    if (!isModernKind(body.kind)) {
      return NextResponse.json({ error: 'kind must be ABAP | CDS | RAP | AMDP' }, { status: 400 })
    }
    if (typeof body.source !== 'string') {
      return NextResponse.json({ error: 'source is required' }, { status: 400 })
    }
    if (Buffer.byteLength(body.source, 'utf8') > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: 'Source is too large' }, { status: 413 })
    }
    if (!body.source.trim()) {
      return NextResponse.json({ validation: validateModernSource(body.kind, body.source) })
    }

    if (body.kind === 'ABAP') {
      const syntax = checkSyntax(body.source)
      const issues: ModernIssue[] = syntax.map((issue) => ({
        severity: issue.kind === 'E' ? 'E' : issue.kind === 'W' ? 'W' : 'I',
        line: issue.line,
        message: issue.message,
      }))
      const hasError = issues.some((issue) => issue.severity === 'E')
      return NextResponse.json({
        validation: {
          kind: 'ABAP',
          status: hasError ? 'INVALID' : 'EXECUTABLE',
          summary: hasError
            ? 'Syntax check failed — fix the errors before executing.'
            : 'Syntax check passed. This object is executable in the local ABAP engine.',
          issues,
        },
      })
    }

    return NextResponse.json({ validation: validateModernSource(body.kind, body.source) })
  } catch (error) {
    return serverError('modern/validate', error)
  }
}
