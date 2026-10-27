'use client'

// ── Global search view (SAP result list look) ─────────────────────────
import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen, Braces, FileCode2, FolderTree, FunctionSquare, Layers, Search, Table2, X,
} from 'lucide-react'
import { useWorkbench, api } from './use-workbench'
import type { SearchGroup, SearchHit } from './types'

const TYPE_CHIPS: { key: string; label: string; api: string | null }[] = [
  { key: 'ALL', label: 'All', api: null },
  { key: 'REPORT', label: 'Programs', api: 'REPORT' },
  { key: 'CLASS', label: 'Classes', api: 'CLASS' },
  { key: 'INCLUDE', label: 'Includes', api: 'INCLUDE' },
  { key: 'FUNCTION_GROUP', label: 'Function Groups', api: 'FUNCTION_GROUP' },
  { key: 'TABLE', label: 'Tables', api: 'TABLE' },
  { key: 'FM', label: 'Function Modules', api: 'FM' },
  { key: 'TOPIC', label: 'Topics', api: 'TOPIC' },
]

export function typeIcon(type: string, className = 'h-3.5 w-3.5') {
  switch (type) {
    case 'CLASS':
      return <Braces className={`${className} text-[#0a6e6e]`} />
    case 'INCLUDE':
      return <FileCode2 className={`${className} text-[#8a6d1a]`} />
    case 'FUNCTION_GROUP':
    case 'FM':
      return <FunctionSquare className={`${className} text-[#5d3a8e]`} />
    case 'TABLE':
      return <Table2 className={`${className} text-[#8a6d1a]`} />
    case 'TOPIC':
      return <BookOpen className={`${className} text-[#0a6e6e]`} />
    default:
      return <FileCode2 className={`${className} text-[#0a6ed1]`} />
  }
}

export function typeLabel(type: string): string {
  switch (type) {
    case 'REPORT':
      return 'Program'
    case 'CLASS':
      return 'Class'
    case 'INCLUDE':
      return 'Include'
    case 'FUNCTION_GROUP':
      return 'Function Group'
    case 'TABLE':
      return 'Table'
    case 'FM':
      return 'Function Module'
    case 'TOPIC':
      return 'Topic'
    default:
      return type
  }
}

export function SearchView() {
  const searchQuery = useWorkbench((s) => s.searchQuery)
  const setSearchQuery = useWorkbench((s) => s.setSearchQuery)
  const openProgramById = useWorkbench((s) => s.openProgramById)
  const openBrowserFor = useWorkbench((s) => s.openBrowserFor)
  const setSelectedFunction = useWorkbench((s) => s.setSelectedFunction)
  const openSyllabusTopic = useWorkbench((s) => s.openSyllabusTopic)

  const [q, setQ] = useState(searchQuery)
  const [chip, setChip] = useState('ALL')
  const [groups, setGroups] = useState<SearchGroup[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setQ(searchQuery)
  }, [searchQuery])

  const doSearch = useCallback(
    async (term: string, typeKey: string) => {
      const trimmed = term.trim()
      if (!trimmed) {
        setGroups([])
        setTotal(0)
        return
      }
      setLoading(true)
      try {
        const chipDef = TYPE_CHIPS.find((c) => c.key === typeKey)
        const types = chipDef?.api ? chipDef.api : undefined
        const url = `/api/search?q=${encodeURIComponent(trimmed)}${types ? `&types=${types}` : ''}`
        const r = await api<{ groups: SearchGroup[]; total: number }>(url)
        setGroups(r.groups)
        setTotal(r.total)
      } catch {
        setGroups([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // auto-search when query (from command field / palette) changes
  useEffect(() => {
    if (searchQuery) void doSearch(searchQuery, chip)
  }, [searchQuery])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(q)
    void doSearch(q, chip)
  }

  const openHit = (hit: SearchHit) => {
    switch (hit.objectType) {
      case 'REPORT':
      case 'CLASS':
      case 'INCLUDE':
      case 'FUNCTION_GROUP': {
        const id = hit.extra?.id as string | undefined
        if (id) void openProgramById(id)
        else void useWorkbench.getState().openProgramByName(hit.name)
        return
      }
      case 'TABLE':
        openBrowserFor(hit.name)
        return
      case 'FM':
        setSelectedFunction(hit.name)
        return
      case 'TOPIC': {
        const tid = (hit.extra?.topicId as number | undefined) ?? (hit.extra?.srNo as number | undefined)
        if (tid) openSyllabusTopic(tid)
        return
      }
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#ebf1f7]">
      {/* search header */}
      <div className="border-b border-[#c6d7e6] bg-white px-4 py-3">
        <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-none border border-[#a8c0d6] bg-white px-2.5 py-1.5 shadow-inner">
            <Search className="h-4 w-4 shrink-0 text-[#55677a]" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search programs, classes, tables, function modules, topics…"
              className="h-[26px] w-full bg-transparent text-[13px] outline-none placeholder:text-[#9aa8b8]"
              aria-label="Search query"
            />
            {q && (
              <button type="button" onClick={() => { setQ(''); setSearchQuery(''); setGroups([]) }} aria-label="Clear">
                <X className="h-3.5 w-3.5 text-[#55677a] hover:text-[#c4302f]" />
              </button>
            )}
          </div>
          <button type="submit" className="sap-btn sap-btn-primary">
            <Search className="h-3.5 w-3.5" />
            Search
          </button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TYPE_CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setChip(c.key)
                if (q.trim()) void doSearch(q, c.key)
              }}
              className={`rounded-none border px-2.5 py-0.5 text-[11.5px] font-medium transition-colors ${
                chip === c.key
                  ? 'border-[#7aa7d9] bg-[#cfe3f8] font-semibold text-[#0a2f57]'
                  : 'border-[#c6d7e6] bg-white text-[#44586c] hover:border-[#8fb0d4] hover:text-[#0a6ed1]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* results */}
      <div className="wb-scroll min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-[900px]">
          {!q.trim() && (
            <div className="flex flex-col items-center gap-2 rounded-none border border-dashed border-[#c6d7e6] bg-white px-6 py-12 text-center">
              <Layers className="h-8 w-8 text-[#b4c4d6]" />
              <p className="text-[13px] font-medium text-[#44586c]">
                Enter a search term to find repository objects
              </p>
              <p className="text-[12px] text-[#55677a]">
                Searches names, titles, descriptions, tags, source code, table fields and syllabus
                content.
              </p>
            </div>
          )}

          {q.trim() && loading && (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-none bg-[#e6eef7]" />
              ))}
            </div>
          )}

          {q.trim() && !loading && groups !== null && groups.length === 0 && (
            <div className="rounded-none border border-dashed border-[#c6d7e6] bg-white px-6 py-10 text-center">
              <FolderTree className="mx-auto h-8 w-8 text-[#b4c4d6]" />
              <p className="mt-2 text-[13px] font-medium text-[#44586c]">
                No objects found for &quot;{q}&quot;
              </p>
              <p className="text-[12px] text-[#55677a]">
                Try a different term, or clear the type filter. If the repository is empty, content
                may still be seeding.
              </p>
            </div>
          )}

          {groups?.map((g) => (
            <section key={g.type} className="mb-4" aria-label={`${typeLabel(g.type)} results`}>
              <div className="mb-1.5 flex items-center gap-2">
                {typeIcon(g.type, 'h-4 w-4')}
                <h2 className="text-[12.5px] font-bold uppercase tracking-wide text-[#44586c]">
                  {typeLabel(g.type)}s
                </h2>
                <span className="rounded-sm border border-[#c6d7e6] bg-white px-1.5 py-0.5 text-[10.5px] font-semibold text-[#55677a]">
                  {g.count}
                </span>
              </div>
              <div className="overflow-hidden rounded-none border border-[#c6d7e6] bg-white">
                <ul className="divide-y divide-[#eef2f7]">
                  {g.hits.map((hit, i) => (
                    <li key={`${hit.objectType}-${hit.name}-${i}`}>
                      <button
                        type="button"
                        onClick={() => openHit(hit)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#e8f1fa]"
                      >
                        {typeIcon(hit.objectType)}
                        <span className="shrink-0 font-mono text-[12.5px] font-bold text-[#17324a]">
                          {hit.name}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#44586c]">
                          {hit.title}
                        </span>
                        <span className="hidden max-w-[240px] shrink-0 truncate text-[11px] text-[#55677a] md:block">
                          {hit.detail}
                        </span>
                        <span className="shrink-0 text-[10.5px] font-medium text-[#93a9c2]">
                          score {hit.score}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}

          {groups !== null && groups.length > 0 && (
            <p className="text-center text-[11.5px] text-[#55677a]">
              {total} object{total === 1 ? '' : 's'} found
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
