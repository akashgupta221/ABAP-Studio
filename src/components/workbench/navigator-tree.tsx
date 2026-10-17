'use client'

// ── SE80-style Object Navigator (sidebar tree) ────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Boxes, Braces, ChevronRight, Database, FileCode2, FolderClosed, FolderOpen,
  FunctionSquare, GraduationCap, ListTree, Search, Star, Table2, X,
} from 'lucide-react'
import { useWorkbench, api } from './use-workbench'
import type { DdicTable, FunctionModule, ProgramListItem } from './types'

function TreeSection({
  label, icon, defaultOpen = false, badge, children,
}: {
  label: string
  icon: React.ReactNode
  defaultOpen?: boolean
  badge?: number | string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="select-none">
      <button
        type="button"
        className="sap-tree-row w-full font-semibold"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-[#5b6d80] transition-transform ${open ? 'rotate-90' : ''}`} />
        {icon}
        <span className="truncate">{label}</span>
        {badge !== undefined && (
          <span className="ml-auto rounded-full bg-[#dbe4ef] px-1.5 text-[10px] font-semibold text-[#3f5468]">
            {badge}
          </span>
        )}
      </button>
      {open && <div className="ml-4 border-l border-[#d3dde8] pl-1">{children}</div>}
    </div>
  )
}

export function NavigatorTree() {
  const repoVersion = useWorkbench((s) => s.repoVersion)
  const favorites = useWorkbench((s) => s.favorites)
  const openProgramByName = useWorkbench((s) => s.openProgramByName)
  const openBrowserFor = useWorkbench((s) => s.openBrowserFor)
  const setSelectedFunction = useWorkbench((s) => s.setSelectedFunction)
  const navigate = useWorkbench((s) => s.navigate)
  const openSyllabusTopic = useWorkbench((s) => s.openSyllabusTopic)
  const activeTabKey = useWorkbench((s) => s.activeTabKey)
  const view = useWorkbench((s) => s.view)
  const selectedFunction = useWorkbench((s) => s.selectedFunction)

  const [filter, setFilter] = useState('')
  const [programs, setPrograms] = useState<ProgramListItem[] | null>(null)
  const [tables, setTables] = useState<DdicTable[] | null>(null)
  const [fms, setFms] = useState<FunctionModule[] | null>(null)
  const [loading, setLoading] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [p, t, f] = await Promise.all([
        api<{ programs: ProgramListItem[] }>('/api/programs'),
        api<{ tables: DdicTable[] }>('/api/tables'),
        api<{ functions: FunctionModule[] }>('/api/functions'),
      ])
      setPrograms(p.programs)
      setTables(t.tables)
      setFms(f.functions)
    } catch {
      setPrograms([])
      setTables([])
      setFms([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll, repoVersion])

  const f = filter.trim().toUpperCase()
  const filteredPrograms = useMemo(
    () => (programs ?? []).filter((p) => !f || p.name.includes(f) || p.title.toUpperCase().includes(f)),
    [programs, f],
  )
  const byType = (type: string) => filteredPrograms.filter((p) => p.type === type)

  const favPrograms = favorites.filter((fv) => ['REPORT', 'CLASS', 'INCLUDE', 'FUNCTION_GROUP'].includes(fv.objectType))

  const typeIcon = (type: string) =>
    type === 'CLASS' ? <Braces className="h-3.5 w-3.5 shrink-0 text-[#0a6e6e]" />
    : type === 'INCLUDE' ? <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[#8a6d1a]" />
    : type === 'FUNCTION_GROUP' ? <FunctionSquare className="h-3.5 w-3.5 shrink-0 text-[#5d3a8e]" />
    : <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[#0a6ed1]" />

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <div className="flex items-center gap-1.5 border-b border-[#c3d0e0] bg-[#e4ebf4] px-2 py-1.5">
        <ListTree className="h-3.5 w-3.5 text-[#0a3d73]" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#1c3a5f]">
          Repository Browser
        </span>
      </div>

      {/* filter */}
      <div className="border-b border-[#d3dde8] p-1.5">
        <div className="flex items-center gap-1 rounded-[3px] border border-[#7f9db9] bg-white px-1.5">
          <Search className="h-3 w-3 shrink-0 text-[#7f9db9]" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter objects…"
            className="h-[24px] w-full bg-transparent font-mono text-[11.5px] outline-none placeholder:font-sans placeholder:text-[#9aa8b8]"
            aria-label="Filter repository objects"
          />
          {filter && (
            <button type="button" onClick={() => setFilter('')} aria-label="Clear filter">
              <X className="h-3 w-3 text-[#7f9db9] hover:text-[#c4302f]" />
            </button>
          )}
        </div>
      </div>

      {/* tree */}
      <nav className="wb-scroll min-h-0 flex-1 overflow-auto py-1.5" aria-label="Repository browser">
        {loading && programs === null && (
          <div className="space-y-1 px-2 py-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded-sm bg-[#e2e9f2]" />
            ))}
          </div>
        )}

        {/* favorites */}
        <TreeSection
          label="Favorites"
          icon={<Star className="h-3.5 w-3.5 shrink-0 text-[#f0b429]" />}
          badge={favorites.length || undefined}
        >
          {favorites.length === 0 && (
            <p className="px-2 py-1 text-[11.5px] italic text-[#8593a5]">
              Use the star icon in the editor to add favorites
            </p>
          )}
          {favPrograms.map((fv) => (
            <button
              key={fv.id}
              type="button"
              className="sap-tree-row w-full"
              data-active={activeTabKey === `prog:${fv.objectName}`}
              onClick={() => void openProgramByName(fv.objectName)}
              title={`${fv.objectType} ${fv.objectName}`}
            >
              {typeIcon(fv.objectType)}
              <span className="truncate font-mono">{fv.label || fv.objectName}</span>
            </button>
          ))}
          {favorites
            .filter((fv) => fv.objectType === 'TABLE')
            .map((fv) => (
              <button
                key={fv.id}
                type="button"
                className="sap-tree-row w-full"
                data-active={view === 'browser'}
                onClick={() => openBrowserFor(fv.objectName)}
              >
                <Table2 className="h-3.5 w-3.5 shrink-0 text-[#8a6d1a]" />
                <span className="truncate font-mono">{fv.label || fv.objectName}</span>
              </button>
            ))}
        </TreeSection>

        {/* package */}
        <TreeSection
          label="Package $TMP"
          icon={<Boxes className="h-3.5 w-3.5 shrink-0 text-[#0a3d73]" />}
          defaultOpen
          badge={filteredPrograms.length}
        >
          <TreeSection label="Programs" icon={<FolderClosed className="h-3.5 w-3.5 shrink-0 text-[#b8860b]" />} badge={byType('REPORT').length}>
            {byType('REPORT').length === 0 && <p className="px-2 py-1 text-[11.5px] italic text-[#8593a5]">No programs</p>}
            {byType('REPORT').map((p) => (
              <button
                key={p.id}
                type="button"
                className="sap-tree-row w-full"
                data-active={activeTabKey === `prog:${p.name}`}
                onClick={() => void openProgramByName(p.name)}
                title={`${p.title || p.name}${p.topicTitle ? ` · ${p.topicTitle}` : ''}`}
              >
                <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[#0a6ed1]" />
                <span className="truncate font-mono">{p.name}</span>
              </button>
            ))}
          </TreeSection>
          <TreeSection label="Classes" icon={<FolderClosed className="h-3.5 w-3.5 shrink-0 text-[#b8860b]" />} badge={byType('CLASS').length}>
            {byType('CLASS').map((p) => (
              <button
                key={p.id}
                type="button"
                className="sap-tree-row w-full"
                data-active={activeTabKey === `prog:${p.name}`}
                onClick={() => void openProgramByName(p.name)}
                title={`${p.title || p.name}${p.topicTitle ? ` · ${p.topicTitle}` : ''}`}
              >
                <Braces className="h-3.5 w-3.5 shrink-0 text-[#0a6e6e]" />
                <span className="truncate font-mono">{p.name}</span>
              </button>
            ))}
          </TreeSection>
          <TreeSection label="Includes" icon={<FolderClosed className="h-3.5 w-3.5 shrink-0 text-[#b8860b]" />} badge={byType('INCLUDE').length}>
            {byType('INCLUDE').map((p) => (
              <button
                key={p.id}
                type="button"
                className="sap-tree-row w-full"
                data-active={activeTabKey === `prog:${p.name}`}
                onClick={() => void openProgramByName(p.name)}
                title={p.title || p.name}
              >
                <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[#8a6d1a]" />
                <span className="truncate font-mono">{p.name}</span>
              </button>
            ))}
          </TreeSection>
          <TreeSection label="Function Groups" icon={<FolderClosed className="h-3.5 w-3.5 shrink-0 text-[#b8860b]" />} badge={byType('FUNCTION_GROUP').length}>
            {byType('FUNCTION_GROUP').map((p) => (
              <button
                key={p.id}
                type="button"
                className="sap-tree-row w-full"
                data-active={activeTabKey === `prog:${p.name}`}
                onClick={() => void openProgramByName(p.name)}
                title={p.title || p.name}
              >
                <FunctionSquare className="h-3.5 w-3.5 shrink-0 text-[#5d3a8e]" />
                <span className="truncate font-mono">{p.name}</span>
              </button>
            ))}
          </TreeSection>
        </TreeSection>

        {/* dictionary */}
        <TreeSection label="Dictionary" icon={<Database className="h-3.5 w-3.5 shrink-0 text-[#8a6d1a]" />} badge={tables?.length ?? undefined}>
          {(tables ?? [])
            .filter((t) => !f || t.name.includes(f) || t.description.toUpperCase().includes(f))
            .map((t) => (
              <button
                key={t.name}
                type="button"
                className="sap-tree-row w-full"
                data-active={view === 'dictionary'}
                onClick={() => openBrowserFor(t.name)}
                title={`${t.description} — ${t.fieldCount} fields`}
              >
                <Table2 className="h-3.5 w-3.5 shrink-0 text-[#8a6d1a]" />
                <span className="truncate font-mono">{t.name}</span>
                <span className="ml-auto shrink-0 text-[10px] text-[#8593a5]">{t.rowCount}</span>
              </button>
            ))}
          {tables !== null && tables.length === 0 && (
            <p className="px-2 py-1 text-[11.5px] italic text-[#8593a5]">No tables yet</p>
          )}
        </TreeSection>

        {/* function modules */}
        <TreeSection label="Function Modules" icon={<FunctionSquare className="h-3.5 w-3.5 shrink-0 text-[#5d3a8e]" />} badge={fms?.length ?? undefined}>
          {(fms ?? [])
            .filter((m) => !f || m.name.includes(f))
            .map((m) => (
              <button
                key={m.id}
                type="button"
                className="sap-tree-row w-full"
                data-active={view === 'functions' && selectedFunction === m.name}
                onClick={() => setSelectedFunction(m.name)}
                title={m.title || m.name}
              >
                <FunctionSquare className="h-3.5 w-3.5 shrink-0 text-[#5d3a8e]" />
                <span className="truncate font-mono">{m.name}</span>
              </button>
            ))}
        </TreeSection>

        {/* training */}
        <TreeSection label="Training" icon={<GraduationCap className="h-3.5 w-3.5 shrink-0 text-[#0a6e6e]" />}>
          <button
            type="button"
            className="sap-tree-row w-full"
            data-active={view === 'syllabus'}
            onClick={() => openSyllabusTopic(-1)}
            title="Syllabus & learning path"
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#b8860b]" />
            <span>Syllabus & Learning Path</span>
          </button>
        </TreeSection>
      </nav>
    </div>
  )
}
