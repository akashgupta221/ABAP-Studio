'use client'

// ── SAP Easy Access (home view) ────────────────────────────────────────
import { useEffect, useState } from 'react'
import {
  BookOpen, Braces, ChevronDown, ChevronRight, Database, FolderClosed, FolderOpen,
  FunctionSquare, ListTree, Play, Search, Star, Table2,
} from 'lucide-react'
import { useWorkbench, api } from './use-workbench'
import type { RecentExecution, Topic } from './types'

// SAP menu indentation steps (px)
const INDENT = [8, 24, 40, 56]
const indent = (level: number) => ({ paddingLeft: INDENT[Math.min(level, INDENT.length - 1)] })

const C_FOLDER = '#e8b53a'
const C_PROGRAM = '#2b6cb8'
const C_TABLE = '#0e7b7b'
const C_CLASS = '#7a3ea8'
const C_FM = '#b35c00'

// 18.10.2026 (SAP list date format)
function fmtDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

const ROW_CLS =
  'group flex min-h-[19px] w-full items-center gap-1.5 pr-2 text-left hover:bg-[#dbe8f8]'

function SectionHead({ label }: { label: string }) {
  return (
    <h2 className="border-b border-[#d8dee6] pb-[2px] text-[10.5px] font-bold uppercase tracking-wide text-[#6b7a8c]">
      {label}
    </h2>
  )
}

function MenuFolder({
  level, label, defaultOpen = true, children,
}: {
  level: number
  label: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        className={ROW_CLS}
        style={indent(level)}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#5b6d80]" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#5b6d80]" />}
        {open
          ? <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color: C_FOLDER }} />
          : <FolderClosed className="h-3.5 w-3.5 shrink-0" style={{ color: C_FOLDER }} />}
        <span className="truncate text-[12.5px] font-semibold text-[#1c2b3a]">{label}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

function MenuRow({
  level, icon, label, hint, meta, onClick,
}: {
  level: number
  icon: React.ReactNode
  label: string
  hint?: string
  meta?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={ROW_CLS}
      style={indent(level)}
      onClick={onClick}
      title={hint}
    >
      {icon}
      <span className="truncate text-[12.5px] text-[#22364b] group-hover:text-[#0b4fa8]">{label}</span>
      {meta && <span className="ml-auto shrink-0 pl-3 text-[10.5px] text-[#98a4b2]">{meta}</span>}
    </button>
  )
}

export function EasyAccess() {
  const favorites = useWorkbench((s) => s.favorites)
  const refreshFavorites = useWorkbench((s) => s.refreshFavorites)
  const openProgramByName = useWorkbench((s) => s.openProgramByName)
  const navigate = useWorkbench((s) => s.navigate)
  const openBrowserFor = useWorkbench((s) => s.openBrowserFor)
  const openSyllabusTopic = useWorkbench((s) => s.openSyllabusTopic)
  const openNewDialog = useWorkbench((s) => s.openNewDialog)
  const setSearchQuery = useWorkbench((s) => s.setSearchQuery)
  const setNavigatorOpen = useWorkbench((s) => s.setNavigatorOpen)

  const [topics, setTopics] = useState<Topic[] | null>(null)
  const [recents, setRecents] = useState<RecentExecution[] | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    void refreshFavorites()
    api<{ topics: Topic[] }>('/api/topics')
      .then((r) => setTopics(r.topics))
      .catch(() => setTopics([]))
    api<{ recents: RecentExecution[] }>('/api/recents')
      .then((r) => setRecents(r.recents))
      .catch(() => setRecents([]))
  }, [refreshFavorites])

  const doSearch = () => {
    const q = search.trim()
    if (q) {
      setSearchQuery(q)
      navigate('search')
    }
  }

  return (
    <div className="wb-scroll h-full overflow-auto bg-white">
      <div className="mx-auto max-w-[860px] px-4 pb-6 pt-3">
        {/* top line */}
        <div className="flex items-baseline gap-2">
          <h1 className="text-[13px] font-bold text-[#1c2b3a]">SAP Easy Access</h1>
          <span className="text-[11px] text-[#7b8a9c]">Object Navigator</span>
        </div>

        {/* object search */}
        <div className="mt-2 flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#7f9db9]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="Search all objects…"
            className="sap-field w-full max-w-[340px]"
            aria-label="Search all objects"
          />
        </div>

        <div className="mt-3 space-y-4">
          {/* favorites */}
          <section aria-label="Favorites">
            <SectionHead label="Favorites" />
            {favorites.length === 0 && (
              <p className="py-1 text-[11.5px] italic text-[#9aa8b8]">
                No favorites yet — star a program in the editor
              </p>
            )}
            <div>
              {favorites.map((fv) => (
                <button
                  key={fv.id}
                  type="button"
                  className={ROW_CLS}
                  onClick={() => {
                    if (fv.objectType === 'TABLE') openBrowserFor(fv.objectName)
                    else void openProgramByName(fv.objectName)
                  }}
                >
                  <Star className="h-3.5 w-3.5 shrink-0" style={{ color: '#c9a227' }} />
                  <span className="truncate text-[12.5px] text-[#0b4fa8] group-hover:underline">
                    {fv.label || fv.objectName}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* recent executions */}
          <section aria-label="Recent executions">
            <SectionHead label="Recent Executions" />
            {recents === null && (
              <div className="space-y-1 py-1">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-[13px] animate-pulse bg-[#eef2f7]" />
                ))}
              </div>
            )}
            {recents !== null && recents.length === 0 && (
              <p className="py-1 text-[11.5px] italic text-[#9aa8b8]">
                No executions yet — press F8 in the editor or on any example.
              </p>
            )}
            <ul>
              {recents?.map((r) => (
                <li key={r.id} className="border-b border-[#eef1f5] last:border-0">
                  <button
                    type="button"
                    className={ROW_CLS}
                    onClick={() => void openProgramByName(r.programName)}
                    title={r.message || r.programName}
                  >
                    <span className="shrink-0 text-[12.5px] text-[#0b4fa8] group-hover:underline">
                      {r.programName}
                    </span>
                    <span className="shrink-0 text-[12.5px] text-[#8a94a0]">
                      — {r.durationMs} ms — {fmtDate(r.createdAt)}
                    </span>
                    {r.status !== 'SUCCESS' && (
                      <span className="shrink-0 text-[11px] font-medium text-[#b00020]">{r.status}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* SAP menu */}
          <section aria-label="SAP menu">
            <SectionHead label="SAP Menu" />
            <div className="pt-0.5">
              <MenuFolder level={0} label="Development">
                <MenuFolder level={1} label="ABAP Workbench">
                  <MenuRow
                    level={2}
                    icon={<Play className="h-3.5 w-3.5 shrink-0" style={{ color: C_PROGRAM }} />}
                    label="ABAP Editor (SE38)"
                    hint="Create and execute ABAP reports"
                    onClick={() => openNewDialog({ prefillType: 'REPORT' })}
                  />
                  <MenuRow
                    level={2}
                    icon={<ListTree className="h-3.5 w-3.5 shrink-0" style={{ color: C_PROGRAM }} />}
                    label="Object Navigator (SE80)"
                    hint="Open the Repository Browser"
                    onClick={() => {
                      setNavigatorOpen(true)
                      navigate('home')
                    }}
                  />
                  <MenuRow
                    level={2}
                    icon={<Database className="h-3.5 w-3.5 shrink-0" style={{ color: C_TABLE }} />}
                    label="Dictionary (SE11)"
                    hint="Tables and field catalogs"
                    onClick={() => navigate('dictionary')}
                  />
                  <MenuRow
                    level={2}
                    icon={<Table2 className="h-3.5 w-3.5 shrink-0" style={{ color: C_TABLE }} />}
                    label="Data Browser (SE16)"
                    hint="Browse table contents"
                    onClick={() => navigate('browser')}
                  />
                  <MenuRow
                    level={2}
                    icon={<FunctionSquare className="h-3.5 w-3.5 shrink-0" style={{ color: C_FM }} />}
                    label="Function Builder (SE37)"
                    hint="Function modules"
                    onClick={() => navigate('functions')}
                  />
                  <MenuRow
                    level={2}
                    icon={<Braces className="h-3.5 w-3.5 shrink-0" style={{ color: C_CLASS }} />}
                    label="Class Builder (SE24)"
                    hint="ABAP Objects classes"
                    onClick={() => navigate('classes')}
                  />
                </MenuFolder>
              </MenuFolder>

              <MenuFolder level={0} label="Training">
                <MenuRow
                  level={1}
                  icon={<BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: C_TABLE }} />}
                  label="ABAP Syllabus"
                  hint="Open the syllabus view"
                  meta={topics ? `${topics.length} topics` : undefined}
                  onClick={() => openSyllabusTopic(-1)}
                />
                {topics === null && (
                  <div className="space-y-0.5 py-0.5" style={indent(2)}>
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-[13px] animate-pulse bg-[#eef2f7]" />
                    ))}
                  </div>
                )}
                {topics?.map((t) => (
                  <MenuRow
                    key={t.id}
                    level={2}
                    icon={<BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: C_TABLE }} />}
                    label={t.title}
                    hint={t.summary}
                    meta={`${t.paradigm} · ${t.exampleCount} example${t.exampleCount === 1 ? '' : 's'}`}
                    onClick={() => openSyllabusTopic(t.id)}
                  />
                ))}
                {topics !== null && topics.length === 0 && (
                  <p className="py-1 text-[11.5px] italic text-[#9aa8b8]" style={indent(2)}>
                    The training content is being seeded — topics will appear here shortly.
                  </p>
                )}
              </MenuFolder>
            </div>
          </section>

          {/* quick start hint */}
          <p className="border-t border-[#eef1f5] pt-2 text-[11.5px] text-[#7b8a9c]">
            Quick start: type <span className="font-mono text-[11px]">SE38</span> in the command field ·
            press <span className="font-mono text-[11px]">F8</span> to execute · try{' '}
            <button
              type="button"
              className="font-mono text-[11px] font-semibold text-[#0b4fa8] hover:underline"
              onClick={() => void openProgramByName('Z_HELLO_WORLD')}
            >
              Z_HELLO_WORLD
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
