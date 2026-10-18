'use client'

// ── SE80-style Object Navigator (sidebar tree) ────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Braces, ChevronDown, ChevronRight, FileCode2, FolderClosed, FolderOpen,
  FunctionSquare, GraduationCap, Search, Table2, X,
} from 'lucide-react'
import { useWorkbench, api } from './use-workbench'
import type { DdicTable, FunctionModule, ProgramListItem } from './types'

// SE80 tree indentation steps (px)
const INDENT = [8, 22, 36, 50]
const indent = (level: number) => ({ paddingLeft: INDENT[Math.min(level, INDENT.length - 1)] })

// classic SE80 icon colors
const C_FOLDER = '#e8b53a'
const C_PROGRAM = '#2b6cb8'
const C_TABLE = '#0e7b7b'
const C_CLASS = '#7a3ea8'
const C_FM = '#b35c00'

const FolderGlyph = ({ open }: { open: boolean }) =>
  open
    ? <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color: C_FOLDER }} />
    : <FolderClosed className="h-3.5 w-3.5 shrink-0" style={{ color: C_FOLDER }} />

const ProgramIcon = () => <FileCode2 className="h-3.5 w-3.5 shrink-0" style={{ color: C_PROGRAM }} />
const ClassIcon = () => <Braces className="h-3.5 w-3.5 shrink-0" style={{ color: C_CLASS }} />
const TableIcon = () => <Table2 className="h-3.5 w-3.5 shrink-0" style={{ color: C_TABLE }} />
const FmIcon = () => <FunctionSquare className="h-3.5 w-3.5 shrink-0" style={{ color: C_FM }} />

// navigator entry points (SE80 header dropdown)
const MODES = [
  { id: 'repo', label: 'Repository Browser' },
  { id: 'fav', label: 'Favorites' },
  { id: 'ris', label: 'Repository Information System' },
] as const
type NavMode = (typeof MODES)[number]['id']

function TreeSection({
  label, defaultOpen = false, badge, level = 0, children,
}: {
  label: string
  defaultOpen?: boolean
  badge?: number | string
  level?: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="select-none">
      <button
        type="button"
        className="sap-tree-row w-full"
        style={indent(level)}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#5b6d80]" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#5b6d80]" />}
        <FolderGlyph open={open} />
        <span className="truncate text-[12px] font-semibold">{label}</span>
        {badge !== undefined && (
          <span className="shrink-0 text-[11px] font-normal text-[#8a96a3]">({badge})</span>
        )}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

function ObjectRow({
  level, active, icon, label, trailing, title, onClick,
}: {
  level: number
  active?: boolean
  icon: React.ReactNode
  label: string
  trailing?: React.ReactNode
  title?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="sap-tree-row w-full"
      style={indent(level)}
      data-active={active ? 'true' : undefined}
      onClick={onClick}
      title={title}
    >
      {icon}
      <span className="truncate text-[12px]">{label}</span>
      {trailing !== undefined && (
        <span className="ml-auto shrink-0 pl-2 text-[10.5px] text-[#8a96a3]">{trailing}</span>
      )}
    </button>
  )
}

function EmptyRow({ level, text }: { level: number; text: string }) {
  return (
    <p className="py-0.5 text-[11.5px] italic text-[#8a96a3]" style={indent(level)}>
      {text}
    </p>
  )
}

export function NavigatorTree() {
  const repoVersion = useWorkbench((s) => s.repoVersion)
  const favorites = useWorkbench((s) => s.favorites)
  const openProgramByName = useWorkbench((s) => s.openProgramByName)
  const openBrowserFor = useWorkbench((s) => s.openBrowserFor)
  const setSelectedFunction = useWorkbench((s) => s.setSelectedFunction)
  const openSyllabusTopic = useWorkbench((s) => s.openSyllabusTopic)
  const activeTabKey = useWorkbench((s) => s.activeTabKey)
  const view = useWorkbench((s) => s.view)
  const selectedFunction = useWorkbench((s) => s.selectedFunction)

  const [filter, setFilter] = useState('')
  const [programs, setPrograms] = useState<ProgramListItem[] | null>(null)
  const [tables, setTables] = useState<DdicTable[] | null>(null)
  const [fms, setFms] = useState<FunctionModule[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setMode] = useState<NavMode>('repo')

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

  const filteredTables = useMemo(
    () => (tables ?? []).filter((t) => !f || t.name.includes(f) || t.description.toUpperCase().includes(f)),
    [tables, f],
  )
  const filteredFms = useMemo(
    () => (fms ?? []).filter((m) => !f || m.name.includes(f)),
    [fms, f],
  )

  const favPrograms = favorites.filter((fv) => ['REPORT', 'CLASS', 'INCLUDE', 'FUNCTION_GROUP'].includes(fv.objectType))

  const typeIcon = (type: string) =>
    type === 'CLASS' ? <ClassIcon />
    : type === 'FUNCTION_GROUP' ? <FmIcon />
    : <ProgramIcon />

  const modeLabel = MODES.find((m) => m.id === mode)?.label ?? 'Repository Browser'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header — "Repository Browser" with SE80 dropdown */}
      <div className="relative shrink-0 border-b border-[#c3d0e0] bg-[#e9eff7]">
        <button
          type="button"
          className="flex w-full items-center gap-1.5 px-2 py-[3px] text-left hover:bg-[#dde7f3]"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="truncate text-[12px] font-bold text-[#1c3a5f]">{modeLabel}</span>
          <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-[#3f5468]" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div className="absolute left-0 right-0 top-full z-50 border border-[#9db2cc] bg-white py-0.5 shadow-md" role="menu">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-1.5 px-2 py-[3px] text-left text-[12px] hover:bg-[#dbe8f8]"
                  onClick={() => {
                    setMode(m.id)
                    setMenuOpen(false)
                  }}
                >
                  <span className="w-3 shrink-0 text-[#0b4fa8]">{mode === m.id ? '✓' : ''}</span>
                  <span className="truncate text-[#1c2b3a]">{m.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* filter */}
      <div className="shrink-0 border-b border-[#d3dde8] px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Search className="h-3 w-3 shrink-0 text-[#7f9db9]" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter objects…"
            className="sap-field w-full"
            style={{ fontSize: 12 }}
            aria-label="Filter repository objects"
          />
          {filter && (
            <button type="button" onClick={() => setFilter('')} aria-label="Clear filter" className="shrink-0">
              <X className="h-3 w-3 text-[#7f9db9] hover:text-[#c4302f]" />
            </button>
          )}
        </div>
      </div>

      {/* tree */}
      <nav className="wb-scroll min-h-0 flex-1 overflow-auto py-1" aria-label="Repository browser">
        {loading && programs === null && (
          <div className="space-y-0.5 px-2 py-0.5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-[14px] animate-pulse bg-[#e2e9f2]" />
            ))}
          </div>
        )}

        {/* favorites */}
        <TreeSection
          key={`fav-${mode}`}
          label="Favorites"
          defaultOpen={mode === 'fav'}
          badge={favorites.length || undefined}
        >
          {favorites.length === 0 && (
            <EmptyRow level={1} text="Use the star icon in the editor to add favorites" />
          )}
          {favPrograms.map((fv) => (
            <ObjectRow
              key={fv.id}
              level={1}
              active={activeTabKey === `prog:${fv.objectName}`}
              icon={typeIcon(fv.objectType)}
              label={fv.label || fv.objectName}
              title={`${fv.objectType} ${fv.objectName}`}
              onClick={() => void openProgramByName(fv.objectName)}
            />
          ))}
          {favorites
            .filter((fv) => fv.objectType === 'TABLE')
            .map((fv) => (
              <ObjectRow
                key={fv.id}
                level={1}
                active={view === 'browser'}
                icon={<TableIcon />}
                label={fv.label || fv.objectName}
                onClick={() => openBrowserFor(fv.objectName)}
              />
            ))}
        </TreeSection>

        {/* package */}
        <TreeSection
          label="Package $TMP"
          defaultOpen
          badge={filteredPrograms.length}
        >
          <TreeSection label="Programs" level={1} badge={byType('REPORT').length}>
            {byType('REPORT').length === 0 && <EmptyRow level={2} text="No programs" />}
            {byType('REPORT').map((p) => (
              <ObjectRow
                key={p.id}
                level={2}
                active={activeTabKey === `prog:${p.name}`}
                icon={<ProgramIcon />}
                label={p.name}
                title={`${p.title || p.name}${p.topicTitle ? ` · ${p.topicTitle}` : ''}`}
                onClick={() => void openProgramByName(p.name)}
              />
            ))}
          </TreeSection>
          <TreeSection label="Classes" level={1} badge={byType('CLASS').length}>
            {byType('CLASS').map((p) => (
              <ObjectRow
                key={p.id}
                level={2}
                active={activeTabKey === `prog:${p.name}`}
                icon={<ClassIcon />}
                label={p.name}
                title={`${p.title || p.name}${p.topicTitle ? ` · ${p.topicTitle}` : ''}`}
                onClick={() => void openProgramByName(p.name)}
              />
            ))}
          </TreeSection>
          <TreeSection label="Includes" level={1} badge={byType('INCLUDE').length}>
            {byType('INCLUDE').map((p) => (
              <ObjectRow
                key={p.id}
                level={2}
                active={activeTabKey === `prog:${p.name}`}
                icon={<ProgramIcon />}
                label={p.name}
                title={p.title || p.name}
                onClick={() => void openProgramByName(p.name)}
              />
            ))}
          </TreeSection>
          <TreeSection label="Function Groups" level={1} badge={byType('FUNCTION_GROUP').length}>
            {byType('FUNCTION_GROUP').map((p) => (
              <ObjectRow
                key={p.id}
                level={2}
                active={activeTabKey === `prog:${p.name}`}
                icon={<FmIcon />}
                label={p.name}
                title={p.title || p.name}
                onClick={() => void openProgramByName(p.name)}
              />
            ))}
          </TreeSection>
        </TreeSection>

        {/* dictionary */}
        <TreeSection
          key={`dict-${mode}`}
          label="Dictionary"
          defaultOpen={mode === 'ris'}
          badge={tables?.length ?? undefined}
        >
          {filteredTables.map((t) => (
            <ObjectRow
              key={t.name}
              level={1}
              active={view === 'dictionary'}
              icon={<TableIcon />}
              label={t.name}
              trailing={t.rowCount}
              title={`${t.description} — ${t.fieldCount} fields`}
              onClick={() => openBrowserFor(t.name)}
            />
          ))}
          {tables !== null && tables.length === 0 && <EmptyRow level={1} text="No tables yet" />}
        </TreeSection>

        {/* function modules */}
        <TreeSection label="Function Modules" badge={fms?.length ?? undefined}>
          {filteredFms.map((m) => (
            <ObjectRow
              key={m.id}
              level={1}
              active={view === 'functions' && selectedFunction === m.name}
              icon={<FmIcon />}
              label={m.name}
              title={m.title || m.name}
              onClick={() => setSelectedFunction(m.name)}
            />
          ))}
        </TreeSection>

        {/* training */}
        <TreeSection label="Training">
          <ObjectRow
            level={1}
            active={view === 'syllabus'}
            icon={<GraduationCap className="h-3.5 w-3.5 shrink-0" style={{ color: C_TABLE }} />}
            label="Syllabus & Learning Path"
            title="Syllabus & learning path"
            onClick={() => openSyllabusTopic(-1)}
          />
        </TreeSection>
      </nav>
    </div>
  )
}
