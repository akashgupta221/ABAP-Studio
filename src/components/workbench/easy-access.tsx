'use client'

// ── SAP Easy Access (classic SAP GUI for HTML layout) ──────────────────
import { useEffect, useState } from 'react'
import {
  BookOpen, Braces, ChevronsDownUp, ChevronsUpDown, Database, FolderClosed, FolderOpen,
  FolderTree, FunctionSquare, ListTree, Play, Star, Table2, UserCog, Users,
} from 'lucide-react'
import { useWorkbench, api } from './use-workbench'
import type { RecentExecution, Topic } from './types'

// SAP menu indentation steps (px)
const INDENT = [12, 28, 44, 60]
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

type FolderId = 'favorites' | 'recent' | 'menu' | 'tools' | 'workbench' | 'training'

// ── application toolbar button (icon + label, SAP GUI for HTML style) ──
function EaToolBtn({
  icon, label, title, onClick,
}: {
  icon: React.ReactNode
  label: string
  title?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      className="flex h-[22px] shrink-0 items-center gap-1 rounded-[2px] border border-transparent px-1.5 text-[11.5px] text-[#1c2b3a] hover:border-[#a9c2d8] hover:bg-[#cfe0f0] active:bg-[#bcd4ea] active:border-[#8fb0d0]"
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
}

// ── folder row (▼/▶ triangle + folder icon + label) ────────────────────
function FolderRow({
  level, label, open, onToggle,
}: {
  level: number
  label: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button type="button" className={ROW_CLS} style={indent(level)} onClick={onToggle} aria-expanded={open}>
      <span className="w-[9px] shrink-0 text-center text-[8px] leading-none text-[#3d3d3d]" aria-hidden>
        {open ? '▼' : '▶'}
      </span>
      {open
        ? <FolderOpen className="h-[15px] w-[15px] shrink-0" style={{ color: C_FOLDER }} />
        : <FolderClosed className="h-[15px] w-[15px] shrink-0" style={{ color: C_FOLDER }} />}
      <span className="truncate text-[12.5px] text-[#1c2b3a]">{label}</span>
    </button>
  )
}

// ── leaf row (t-code / object / topic) ─────────────────────────────────
function LeafRow({
  level, icon, label, hint, meta, metaSuffix, onClick,
}: {
  level: number
  icon: React.ReactNode
  label: string
  hint?: string
  meta?: string
  metaSuffix?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button type="button" className={ROW_CLS} style={indent(level)} onClick={onClick} title={hint}>
      <span className="w-[9px] shrink-0" aria-hidden />
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">{icon}</span>
      <span className="truncate text-[12.5px] text-[#0b4fa8] group-hover:underline">{label}</span>
      {meta && <span className="ml-auto shrink-0 pl-3 text-[10.5px] text-[#98a4b2]">{meta}</span>}
      {metaSuffix}
    </button>
  )
}

export function EasyAccess() {
  const favorites = useWorkbench((s) => s.favorites)
  const refreshFavorites = useWorkbench((s) => s.refreshFavorites)
  const openProgramByName = useWorkbench((s) => s.openProgramByName)
  const openSe38Initial = useWorkbench((s) => s.openSe38Initial)
  const navigate = useWorkbench((s) => s.navigate)
  const openBrowserFor = useWorkbench((s) => s.openBrowserFor)
  const openSyllabusTopic = useWorkbench((s) => s.openSyllabusTopic)
  const setNavigatorOpen = useWorkbench((s) => s.setNavigatorOpen)
  const addMessage = useWorkbench((s) => s.addMessage)

  const [topics, setTopics] = useState<Topic[] | null>(null)
  const [recents, setRecents] = useState<RecentExecution[] | null>(null)
  const [openFolders, setOpenFolders] = useState<Record<FolderId, boolean>>({
    favorites: true,
    recent: false,
    menu: true,
    tools: true,
    workbench: true,
    training: true,
  })

  useEffect(() => {
    void refreshFavorites()
    api<{ topics: Topic[] }>('/api/topics')
      .then((r) => setTopics(r.topics))
      .catch(() => setTopics([]))
    api<{ recents: RecentExecution[] }>('/api/recents')
      .then((r) => setRecents(r.recents))
      .catch(() => setRecents([]))
  }, [refreshFavorites])

  const toggle = (id: FolderId) => setOpenFolders((o) => ({ ...o, [id]: !o[id] }))
  const setAll = (v: boolean) =>
    setOpenFolders({ favorites: v, recent: v, menu: v, tools: v, workbench: v, training: v })

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f4f8fc]">
      {/* ── banner ── */}
      <div className="flex h-[34px] shrink-0 items-center border-b border-[#a9c2d8] bg-[linear-gradient(180deg,#f4f9fd_0%,#d9e8f6_55%,#c6dcf0_100%)] px-3">
        <span className="text-[16px] font-bold italic leading-none text-[#1c4a7e] [text-shadow:1px_1px_0_rgba(255,255,255,0.9)]">
          SAP Easy Access
        </span>
      </div>

      {/* ── application toolbar ── */}
      <div className="flex h-[27px] shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[#b6c9dc] bg-[#e2ecf6] px-1.5">
        <EaToolBtn
          icon={<ChevronsUpDown className="h-3.5 w-3.5 text-[#2e5b8a]" />}
          label="Expand"
          title="Expand all folders"
          onClick={() => setAll(true)}
        />
        <EaToolBtn
          icon={<ChevronsDownUp className="h-3.5 w-3.5 text-[#2e5b8a]" />}
          label="Collapse"
          title="Collapse all folders"
          onClick={() => setAll(false)}
        />
        <span className="sap-toolbar-sep" aria-hidden />
        <EaToolBtn
          icon={<FolderTree className="h-3.5 w-3.5 text-[#b8860b]" />}
          label="Other menu"
          title="Open the repository navigator (SE80)"
          onClick={() => {
            setNavigatorOpen(true)
            addMessage('I', 'Object Navigator (SE80)')
          }}
        />
        <EaToolBtn
          icon={<Star className="h-3.5 w-3.5 text-[#c9a227]" />}
          label="Favorites"
          title="Add a program to your favorites from the editor title bar"
          onClick={() => addMessage('I', 'Favorites: open a program and use the star in the editor')}
        />
        <span className="sap-toolbar-sep" aria-hidden />
        <EaToolBtn
          icon={<UserCog className="h-3.5 w-3.5 text-[#5b6d80]" />}
          label="Create role"
          title="Role maintenance (S_USER_GRP)"
          onClick={() => addMessage('E', 'You are not authorized to perform role maintenance (S_USER_GRP)')}
        />
        <EaToolBtn
          icon={<Users className="h-3.5 w-3.5 text-[#5b6d80]" />}
          label="Assign users"
          title="User maintenance (S_USER_AGR)"
          onClick={() => addMessage('E', 'You are not authorized to assign users to roles (S_USER_AGR)')}
        />
        <EaToolBtn
          icon={<BookOpen className="h-3.5 w-3.5 text-[#0e7b7b]" />}
          label="Documentation"
          title="Open the ABAP training syllabus"
          onClick={() => openSyllabusTopic(-1)}
        />
      </div>

      {/* ── menu tree ── */}
      <div className="wb-scroll min-h-0 flex-1 overflow-auto pb-4 pt-1">
        {/* Favorites */}
        <FolderRow level={0} label="Favorites" open={openFolders.favorites} onToggle={() => toggle('favorites')} />
        {openFolders.favorites && (
          <div>
            {favorites.length === 0 && (
              <p className="py-[2px] text-[11.5px] italic text-[#8395a8]" style={indent(1)}>
                No favorites yet — star a program in the editor
              </p>
            )}
            {favorites.map((fv) => (
              <LeafRow
                key={fv.id}
                level={1}
                icon={<Star className="h-3.5 w-3.5" style={{ color: '#c9a227' }} />}
                label={fv.label || fv.objectName}
                onClick={() => {
                  if (fv.objectType === 'TABLE') openBrowserFor(fv.objectName)
                  else void openProgramByName(fv.objectName)
                }}
              />
            ))}
          </div>
        )}

        {/* Recently Used */}
        <FolderRow level={0} label="Recently Used" open={openFolders.recent} onToggle={() => toggle('recent')} />
        {openFolders.recent && (
          <div>
            {recents === null && (
              <div className="space-y-0.5 py-0.5" style={indent(1)}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-[13px] w-64 animate-pulse bg-[#e6eef7]" />
                ))}
              </div>
            )}
            {recents !== null && recents.length === 0 && (
              <p className="py-[2px] text-[11.5px] italic text-[#8395a8]" style={indent(1)}>
                No executions yet — press F8 in the editor.
              </p>
            )}
            {recents?.map((r) => (
              <LeafRow
                key={r.id}
                level={1}
                icon={<Play className="h-3.5 w-3.5" style={{ color: C_PROGRAM }} />}
                label={r.programName}
                hint={r.message || r.programName}
                meta={`${r.durationMs} ms — ${fmtDate(r.createdAt)}`}
                metaSuffix={
                  r.status !== 'SUCCESS' ? (
                    <span className="shrink-0 pl-2 text-[11px] font-medium text-[#b00020]">{r.status}</span>
                  ) : undefined
                }
                onClick={() => void openProgramByName(r.programName)}
              />
            ))}
          </div>
        )}

        {/* SAP Menu */}
        <FolderRow level={0} label="SAP Menu" open={openFolders.menu} onToggle={() => toggle('menu')} />
        {openFolders.menu && (
          <div>
            <FolderRow level={1} label="Tools" open={openFolders.tools} onToggle={() => toggle('tools')} />
            {openFolders.tools && (
              <div>
                <FolderRow
                  level={2}
                  label="ABAP Workbench"
                  open={openFolders.workbench}
                  onToggle={() => toggle('workbench')}
                />
                {openFolders.workbench && (
                  <div>
                    <LeafRow
                      level={3}
                      icon={<Play className="h-3.5 w-3.5" style={{ color: C_PROGRAM }} />}
                      label="ABAP Editor (SE38)"
                      hint="ABAP Editor: initial screen"
                      onClick={() => openSe38Initial()}
                    />
                    <LeafRow
                      level={3}
                      icon={<ListTree className="h-3.5 w-3.5" style={{ color: C_PROGRAM }} />}
                      label="Object Navigator (SE80)"
                      hint="Open the Repository Browser"
                      onClick={() => {
                        setNavigatorOpen(true)
                        navigate('home')
                      }}
                    />
                    <LeafRow
                      level={3}
                      icon={<Database className="h-3.5 w-3.5" style={{ color: C_TABLE }} />}
                      label="Dictionary (SE11)"
                      hint="Tables and field catalogs"
                      onClick={() => navigate('dictionary')}
                    />
                    <LeafRow
                      level={3}
                      icon={<Table2 className="h-3.5 w-3.5" style={{ color: C_TABLE }} />}
                      label="Data Browser (SE16)"
                      hint="Browse table contents"
                      onClick={() => navigate('browser')}
                    />
                    <LeafRow
                      level={3}
                      icon={<FunctionSquare className="h-3.5 w-3.5" style={{ color: C_FM }} />}
                      label="Function Builder (SE37)"
                      hint="Function modules"
                      onClick={() => navigate('functions')}
                    />
                    <LeafRow
                      level={3}
                      icon={<Braces className="h-3.5 w-3.5" style={{ color: C_CLASS }} />}
                      label="Class Builder (SE24)"
                      hint="ABAP Objects classes"
                      onClick={() => navigate('classes')}
                    />
                  </div>
                )}
              </div>
            )}

            <FolderRow level={1} label="Training" open={openFolders.training} onToggle={() => toggle('training')} />
            {openFolders.training && (
              <div>
                <LeafRow
                  level={2}
                  icon={<BookOpen className="h-3.5 w-3.5" style={{ color: C_TABLE }} />}
                  label="ABAP Syllabus"
                  hint="Open the syllabus view"
                  meta={topics ? `${topics.length} topics` : undefined}
                  onClick={() => openSyllabusTopic(-1)}
                />
                {topics === null && (
                  <div className="space-y-0.5 py-0.5" style={indent(3)}>
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-[13px] w-64 animate-pulse bg-[#e6eef7]" />
                    ))}
                  </div>
                )}
                {topics?.map((t) => (
                  <LeafRow
                    key={t.id}
                    level={2}
                    icon={<BookOpen className="h-3.5 w-3.5" style={{ color: C_TABLE }} />}
                    label={t.title}
                    hint={t.summary}
                    meta={`${t.paradigm} · ${t.exampleCount} example${t.exampleCount === 1 ? '' : 's'}`}
                    onClick={() => openSyllabusTopic(t.id)}
                  />
                ))}
                {topics !== null && topics.length === 0 && (
                  <p className="py-[2px] text-[11.5px] italic text-[#8395a8]" style={indent(2)}>
                    The training content is being seeded — topics will appear here shortly.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
