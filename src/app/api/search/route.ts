import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/search?q=&types=PROGRAM,CLASS,TABLE,FM,TOPIC — SAP-like global search
// Searches across: program names, titles, descriptions, source code, tags,
// table names & field texts, function modules, syllabus topics
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const q = (sp.get('q') || '').trim()
    const types = (sp.get('types') || 'PROGRAM,CLASS,INCLUDE,FUNCTION_GROUP,TABLE,FM,TOPIC').split(',').map((t) => t.trim().toUpperCase())
    if (!q) return NextResponse.json({ groups: [], total: 0 })

    const lower = q.toLowerCase()
    const upper = q.toUpperCase()

    type Hit = { objectType: string; name: string; title: string; detail: string; score: number; extra?: Record<string, any> }
    const hits: Hit[] = []

    // ── programs / classes / includes / function groups ──
    if (types.some((t) => ['PROGRAM', 'CLASS', 'INCLUDE', 'FUNCTION_GROUP'].includes(t))) {
      const programs = await db.program.findMany({
        include: { topic: true },
      })
      const programTypes = types.filter((t) => ['PROGRAM', 'REPORT', 'CLASS', 'INCLUDE', 'FUNCTION_GROUP'].includes(t))
      const wantsPrograms = types.includes('PROGRAM')
      for (const p of programs) {
        const typeMatches = types.includes(p.type) || (wantsPrograms && p.type === 'REPORT')
        if (!typeMatches) continue
        let score = 0
        let where = ''
        if (p.name === upper) { score += 100; where = 'Exact name match' }
        else if (p.name.includes(upper)) { score += 60; where = 'Name contains' }
        if (p.title && p.title.toLowerCase().includes(lower)) { score += 40; where = where || 'Title match' }
        if (p.description && p.description.toLowerCase().includes(lower)) { score += 25; where = where || 'Description match' }
        if (p.tags && p.tags.toLowerCase().includes(lower)) { score += 20; where = where || 'Tags match' }
        if (p.source && p.source.toUpperCase().includes(upper)) {
          score += 10
          where = where || 'Source code match'
        }
        if (score > 0) {
          hits.push({
            objectType: p.type,
            name: p.name,
            title: p.title || p.description?.slice(0, 60) || '',
            detail: where + (p.topic ? ` · ${p.topic.title}` : ''),
            score,
            extra: { id: p.id, type: p.type, paradigm: p.paradigm, isExample: p.isExample, topicId: p.topicId },
          })
        }
      }
    }

    // ── DDIC tables ──
    if (types.includes('TABLE')) {
      const tables = await db.dbTable.findMany({ include: { topic: true } })
      for (const t of tables) {
        let score = 0
        let where = ''
        if (t.name === upper) { score += 100; where = 'Exact table name' }
        else if (t.name.includes(upper)) { score += 60; where = 'Table name contains' }
        if (t.description && t.description.toLowerCase().includes(lower)) { score += 35; where = where || 'Table description' }
        const fields = JSON.parse(t.fields || '[]') as any[]
        const fieldHit = fields.find((f) => String(f.name).toUpperCase().includes(upper) || (f.text || '').toLowerCase().includes(lower))
        if (fieldHit) { score += 30; where = where || `Field: ${fieldHit.name}` }
        if (score > 0) {
          hits.push({
            objectType: 'TABLE',
            name: t.name,
            title: t.description || '',
            detail: where,
            score,
            extra: { fields: fields.length, topicId: t.topicId },
          })
        }
      }
    }

    // ── function modules ──
    if (types.includes('FM')) {
      const fms = await db.functionModule.findMany()
      for (const fm of fms) {
        let score = 0
        let where = ''
        if (fm.name === upper) { score += 100; where = 'Exact function name' }
        else if (fm.name.includes(upper)) { score += 60; where = 'Function name contains' }
        if (fm.title && fm.title.toLowerCase().includes(lower)) { score += 35; where = where || 'Title match' }
        if (fm.source && fm.source.toUpperCase().includes(upper)) { score += 10; where = where || 'Source match' }
        if (score > 0) {
          hits.push({ objectType: 'FM', name: fm.name, title: fm.title || '', detail: where, score, extra: { group: fm.groupName } })
        }
      }
    }

    // ── syllabus topics ──
    if (types.includes('TOPIC')) {
      const topics = await db.topic.findMany({ orderBy: { srNo: 'asc' } })
      for (const t of topics) {
        let score = 0
        let where = ''
        if (t.title.toLowerCase().includes(lower)) { score += 70; where = 'Topic title match' }
        if (t.summary && t.summary.toLowerCase().includes(lower)) { score += 35; where = where || 'Topic summary match' }
        if (t.details && t.details.toLowerCase().includes(lower)) { score += 15; where = where || 'Topic content match' }
        if (score > 0) {
          hits.push({ objectType: 'TOPIC', name: `Topic ${t.srNo}`, title: t.title, detail: where, score, extra: { topicId: t.id, srNo: t.srNo } })
        }
      }
    }

    hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

    // group by object type with SAP-like ordering
    const groupOrder = ['REPORT', 'CLASS', 'INCLUDE', 'FUNCTION_GROUP', 'TABLE', 'FM', 'TOPIC']
    const groups = new Map<string, typeof hits>()
    for (const h of hits.slice(0, 200)) {
      const list = groups.get(h.objectType) ?? []
      list.push(h)
      groups.set(h.objectType, list)
    }
    const ordered = [...groups.entries()].sort((a, b) => {
      const ia = groupOrder.indexOf(a[0])
      const ib = groupOrder.indexOf(b[0])
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })

    return NextResponse.json({
      groups: ordered.map(([type, list]) => ({ type, count: list.length, hits: list.slice(0, 50) })),
      total: hits.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
