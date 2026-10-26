'use client'

// ── SAP Easy Access — classic SAP GUI for HTML layout ──────────────────
// Menu structure follows the real SAP Easy Access screenshots:
//   Favorites / SAP Menu
//     Financial Services Network Connector, Global Bike Transactions, Office,
//     Cross-Application Components, Logistics, Accounting, Human Resources,
//     Patient Accounting, Information Systems,
//     Tools → ABAP Workbench → Overview / Development / Programming
//             Environment / Enhancement Framework / Switch Framework,
//             Business Object Builder
//     WebClient UI Framework
//   Development → ABAP Dictionary, Data Modeler, User Interface, ABAP Editor,
//                 Function Builder, Class Builder, Shared Objects Area
//                 Administration, Shared Objects Monitor
// Real transactions used by the training workbench:
//   SE80 Object Navigator, SE16 Data Browser, SE38 ABAP Editor,
//   SE11 ABAP Dictionary, SE37 Function Builder, SE24 Class Builder.
import { Fragment, useEffect, useState } from 'react'
import {
  BookOpen, ChevronDown, FolderClosed, FolderOpen, Sparkles,
  LogOut, MoreHorizontal, Pencil, Play, Printer, Search, Settings, Star,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useWorkbench, api } from './use-workbench'
import { groupTopicsByCategory, TOPIC_CATEGORIES } from './types'
import type { RecentExecution, Topic } from './types'

// menu indentation steps (px) — 5 nesting levels
const INDENT = [14, 34, 54, 74, 94]
const indent = (level: number) => ({ paddingLeft: INDENT[Math.min(level, INDENT.length - 1)] })

const C_FOLDER = '#e8b53a'
const C_PROGRAM = '#2b6cb8'
const C_TRANSACTION = '#44586c'
const C_PRACTICE = '#2e7d32'
const C_TABLE = '#0e7b7b'

// Standard SAP top-level folders in the order shown by the system (MER).
const STANDARD_FOLDERS_BEFORE_TOOLS = [
  'Financial Services Network Connector',
  'Global Bike Transactions',
  'Office',
  'Cross-Application Components',
  'Logistics',
  'Accounting',
  'Human Resources',
  'Patient Accounting',
  'Information Systems',
]
const STANDARD_FOLDERS_AFTER_TOOLS = ['WebClient UI Framework']
const STANDARD_FOLDERS = [...STANDARD_FOLDERS_BEFORE_TOOLS, 'Tools', ...STANDARD_FOLDERS_AFTER_TOOLS]

const EMPTY_NOTE = 'No entries in this training system.'
const UI_NOTE = 'Screen Painter and Menu Painter are not part of this training system.'
const PROGRAMMING_NOTE =
  'Use Tools ▸ ABAP Workbench ▸ Development for the ABAP Editor, ABAP Dictionary, Class Builder and Function Builder.'

function fmtDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

const ROW_CLS =
  'group flex min-h-[26px] w-full items-center gap-2 pr-3 text-left hover:bg-[#dbe8f8]'

// ── application toolbar button (text / icon, SAP GUI for HTML style) ───
function EaToolBtn({
  icon, label, title, onClick,
}: {
  icon?: React.ReactNode
  label?: string
  title?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      className="flex h-[28px] shrink-0 items-center gap-1.5 rounded-[2px] border border-transparent px-2 text-[12.5px] text-[#12283c] hover:border-[#a9c2d8] hover:bg-[#cfe0f0] active:border-[#8fb0d0] active:bg-[#bcd4ea]"
    >
      {icon}
      {label && <span className="whitespace-nowrap">{label}</span>}
    </button>
  )
}

// ── folder node (▼/▶ triangle + folder icon + label) ───────────────────
function TreeFolder({
  level, label, open, onToggle, children,
}: {
  level: number
  label: string
  open: boolean
  onToggle: () => void
  children?: React.ReactNode
}) {
  return (
    <div>
      <button type="button" className={ROW_CLS} style={indent(level)} onClick={onToggle} aria-expanded={open}>
        <span className="w-[10px] shrink-0 text-center text-[9px] leading-none text-[#3d3d3d]" aria-hidden>
          {open ? '▼' : '▶'}
        </span>
        {open
          ? <FolderOpen className="h-[17px] w-[17px] shrink-0" style={{ color: C_FOLDER }} />
          : <FolderClosed className="h-[17px] w-[17px] shrink-0" style={{ color: C_FOLDER }} />}
        <span className="truncate text-[13.5px] text-[#12283c]">{label}</span>
      </button>
      {open && children}
    </div>
  )
}

// ── leaf node (t-code / example program) ───────────────────────────────
function Leaf({
  level, icon, label, meta, badge, hint, onClick, objType, objName,
}: {
  level: number
  icon: React.ReactNode
  label: string
  meta?: string
  badge?: React.ReactNode
  hint?: string
  onClick: () => void
  /** repository object this leaf represents (used by the favorites toolbar buttons) */
  objType?: string
  objName?: string
}) {
  return (
    <button
      type="button"
      className={ROW_CLS}
      style={indent(level)}
      onClick={onClick}
      title={hint}
      data-obj-type={objType}
      data-obj-name={objName}
      data-obj-label={label}
    >
      <span className="w-[10px] shrink-0" aria-hidden />
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="truncate text-[13.5px] text-[#0b4fa8] group-hover:underline">{label}</span>
      {meta && (
        <span className="ml-auto max-w-[45%] shrink-0 truncate pl-3 text-[11.5px] text-[#55677a]">{meta}</span>
      )}
      {badge}
    </button>
  )
}

const gear = <Settings className="h-4 w-4" style={{ color: C_TRANSACTION }} />

export function EasyAccess() {
  const favorites = useWorkbench((s) => s.favorites)
  const refreshFavorites = useWorkbench((s) => s.refreshFavorites)
  const openProgramByName = useWorkbench((s) => s.openProgramByName)
  const openSandbox = useWorkbench((s) => s.openSandbox)
  const openSe38Initial = useWorkbench((s) => s.openSe38Initial)
  const navigate = useWorkbench((s) => s.navigate)
  const openBrowserFor = useWorkbench((s) => s.openBrowserFor)
  const openSyllabusTopic = useWorkbench((s) => s.openSyllabusTopic)
  const openModern = () => {
    useWorkbench.setState({ lastTcode: 'MODERN' })
    navigate('modern')
  }

  const [topics, setTopics] = useState<Topic[] | null>(null)
  const [recents, setRecents] = useState<RecentExecution[] | null>(null)
  const [sel, setSel] = useState<{ type: string; name: string; label: string } | null>(null)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({
    favorites: true,
    recent: false,
    sapmenu: true,
    tools: true,
    workbench: true,
    overview: true,
    development: true,
    programming: false,
    enhancement: false,
    switch: false,
    'user-interface': false,
    training: true,
    'cat-CORE': true,
    'cat-REPORTING': true,
    'cat-MODERN': true,
  })

  useEffect(() => {
    void refreshFavorites()
    api<{ topics: Topic[] }>('/api/topics')
      .then((r) => setTopics(r.topics))
      .catch(() => setTopics([]))
    api<{ recents: RecentExecution[] }>('/api/recents')
      .then((r) => {
        setRecents(r.recents)
        if (r.recents.length > 0) setOpenMap((o) => ({ ...o, recent: true }))
      })
      .catch(() => setRecents([]))
  }, [refreshFavorites])

  const open = (id: string) => !!openMap[id]
  const toggle = (id: string) => setOpenMap((o) => ({ ...o, [id]: !o[id] }))
  const setAll = (v: boolean) => {
    const ids = [
      'favorites', 'recent', 'sapmenu', 'tools', 'workbench', 'overview', 'development',
      'programming', 'enhancement', 'switch', 'user-interface', 'training',
      ...STANDARD_FOLDERS,
      ...TOPIC_CATEGORIES.map((c) => `cat-${c.id}`),
      ...(topics ?? []).map((t) => `topic-${t.id}`),
    ]
    setOpenMap(Object.fromEntries(ids.map((id) => [id, v])))
  }

  // click on a program leaf → remembered for the favorites buttons
  const captureSelection = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-obj-name]') as HTMLElement | null
    if (!el?.dataset.objName) return
    setSel({
      type: el.dataset.objType ?? 'REPORT',
      name: el.dataset.objName,
      label: el.dataset.objLabel ?? el.dataset.objName,
    })
  }

  const addFavorite = () => {
    const s = useWorkbench.getState()
    if (!sel) {
      s.addMessage('I', 'Add to favorites: click a program in the menu first')
      return
    }
    if (s.isFavorite(sel.type, sel.name)) {
      s.addMessage('W', `${sel.name} is already in your favorites`)
      return
    }
    void s.toggleFavorite(sel.type, sel.name, sel.label)
  }

  const removeFavorite = () => {
    const s = useWorkbench.getState()
    if (!sel) {
      s.addMessage('I', 'Remove from favorites: click a program in the menu first')
      return
    }
    if (!s.isFavorite(sel.type, sel.name)) {
      s.addMessage('W', `${sel.name} is not in your favorites`)
      return
    }
    void s.toggleFavorite(sel.type, sel.name, sel.label)
  }

  const editFavorites = () =>
    useWorkbench
      .getState()
      .addMessage('I', 'Favorites maintenance: use Add to Favorite or Remove from Favorites in the More menu')

  const businessWorkplace = () =>
    useWorkbench
      .getState()
      .addMessage('I', 'SAP Business Workplace: the Business Workplace is not part of this training system')

  const createRole = () =>
    useWorkbench.getState().addMessage('I', 'Create role (PFCG): role maintenance is not part of this training system')

  const assignUsers = () =>
    useWorkbench.getState().addMessage('I', 'Assign users (PFCG): user administration is not part of this training system')

  const dataModeler = () =>
    useWorkbench.getState().addMessage('I', 'Data Modeler (SD11): data modeling tools are not part of this training system')

  const sharedObjectsArea = () =>
    useWorkbench.getState().addMessage('I', 'Shared Objects Area Administration (SHMA): not part of this training system')

  const sharedObjectsMonitor = () =>
    useWorkbench.getState().addMessage('I', 'Shared Objects Monitor (SHMM): not part of this training system')

  const businessObjectBuilder = () =>
    useWorkbench.getState().addMessage('I', 'Business Object Builder (SWO1): not part of this training system')

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f4f8fc]">
      {/* ── banner ── */}
      <div className="flex h-[40px] shrink-0 items-center border-b border-[#a9c2d8] bg-[linear-gradient(180deg,#f4f9fd_0%,#d9e8f6_55%,#c6dcf0_100%)] px-3.5">
        <span className="text-[19px] font-bold italic leading-none text-[#1c4a7e] [text-shadow:1px_1px_0_rgba(255,255,255,0.9)]">
          SAP Easy Access
        </span>
        <span className="ml-auto flex items-center gap-3 font-mono text-[11.5px] text-[#44586c]">
          MER (105)
          <button
            type="button"
            className="text-[#33475c] hover:text-[#0b4fa8]"
            title="Print"
            aria-label="Print"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      {/* ── application toolbar (real SAP Easy Access button set) ── */}
      <div className="flex h-[34px] shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[#b6c9dc] bg-[#e2ecf6] px-2">
        <EaToolBtn label="SAP menu" title="SAP menu — expand or collapse the standard menu" onClick={() => toggle('sapmenu')} />
        <EaToolBtn label="SAP Business Workplace" title="SAP Business Workplace" onClick={businessWorkplace} />
        <EaToolBtn label="Add to Favorite" title="Add the selected program to your favorites" onClick={addFavorite} />

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-[28px] shrink-0 items-center gap-1 rounded-[2px] border border-transparent px-2 text-[12.5px] text-[#12283c] hover:border-[#a9c2d8] hover:bg-[#cfe0f0]"
              title="More functions"
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-[#2e5b8a]" />
              More
              <ChevronDown className="h-3 w-3 text-[#5b6d80]" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={2}
            className="w-[280px] rounded-none border border-[#8fa7bf] bg-white p-0.5 text-[12.5px] shadow-[0_4px_16px_rgba(10,30,60,0.35)]"
          >
            {[
              { label: 'Remove from Favorites', run: removeFavorite },
              { label: 'Edit Favorites', run: editFavorites },
              { label: 'Expand All', run: () => setAll(true) },
              { label: 'Collapse All', run: () => setAll(false) },
              { label: 'Create Role (PFCG)', run: createRole },
              { label: 'Assign Users', run: assignUsers },
              { label: 'Documentation — syllabus', run: () => openSyllabusTopic(-1) },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className="flex w-full items-center rounded-none px-2 py-[4px] text-left hover:bg-[#bcd6f2]"
                onClick={item.run}
              >
                {item.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <span className="ml-auto flex items-center gap-1 pl-2">
          <EaToolBtn icon={<Search className="h-4 w-4 text-[#2e5b8a]" />} title="Search — find a repository object (Ctrl+K)" onClick={() => useWorkbench.getState().setCommandPaletteOpen(true)} />
          <EaToolBtn icon={<Printer className="h-4 w-4 text-[#2e5b8a]" />} title="Print" onClick={() => window.print()} />
          <EaToolBtn icon={<LogOut className="h-4 w-4 text-[#2e5b8a]" />} title="Exit — log off" onClick={() => useWorkbench.getState().setLogoffConfirm(true)} />
        </span>
      </div>

      {/* ── menu tree ── */}
      <div className="wb-scroll min-h-0 flex-1 overflow-auto pb-6 pt-1.5" onClickCapture={captureSelection}>
        {/* Favorites */}
        <TreeFolder level={0} label="Favorites" open={open('favorites')} onToggle={() => toggle('favorites')}>
          {favorites.length === 0 ? (
            <p className="py-1 text-[12.5px] italic text-[#55677a]" style={indent(1)}>
              No favorites yet — star a program in the editor.
            </p>
          ) : (
            favorites.map((fv) => (
              <Leaf
                key={fv.id}
                level={1}
                icon={<Star className="h-4 w-4" style={{ color: '#c9a227' }} />}
                label={fv.label || fv.objectName}
                objType={fv.objectType}
                objName={fv.objectName}
                onClick={() => {
                  if (fv.objectType === 'TABLE') openBrowserFor(fv.objectName)
                  else void openProgramByName(fv.objectName)
                }}
              />
            ))
          )}
        </TreeFolder>

        {/* Recently Used */}
        <TreeFolder level={0} label="Recently Used" open={open('recent')} onToggle={() => toggle('recent')}>
          {recents === null ? (
            <div className="space-y-1 py-1" style={indent(1)}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-[14px] w-64 animate-pulse bg-[#e6eef7]" />
              ))}
            </div>
          ) : recents.length === 0 ? (
            <p className="py-1 text-[12.5px] italic text-[#55677a]" style={indent(1)}>
              No executions yet — press F8 in the editor.
            </p>
          ) : (
            recents.map((r) => (
              <Leaf
                key={r.id}
                level={1}
                icon={<Play className="h-4 w-4" style={{ color: C_PROGRAM }} />}
                label={r.programName}
                objType="REPORT"
                objName={r.programName}
                hint={r.message || r.programName}
                meta={`${r.durationMs} ms · ${fmtDate(r.createdAt)}`}
                badge={
                  r.status !== 'SUCCESS' ? (
                    <span className="shrink-0 pl-2 text-[11.5px] font-medium text-[#b00020]">{r.status}</span>
                  ) : undefined
                }
                onClick={() => void openProgramByName(r.programName)}
              />
            ))
          )}
        </TreeFolder>

        {/* SAP Menu — standard structure (screenshot order) */}
        <TreeFolder level={0} label="SAP Menu" open={open('sapmenu')} onToggle={() => toggle('sapmenu')}>
          {STANDARD_FOLDERS_BEFORE_TOOLS.map((label) => (
            <TreeFolder key={label} level={1} label={label} open={open(label)} onToggle={() => toggle(label)}>
              <p className="py-1 text-[12.5px] italic text-[#55677a]" style={indent(2)}>
                {EMPTY_NOTE}
              </p>
            </TreeFolder>
          ))}

          <TreeFolder level={1} label="Tools" open={open('tools')} onToggle={() => toggle('tools')}>
            <TreeFolder
              level={2}
              label="ABAP Workbench"
              open={open('workbench')}
              onToggle={() => toggle('workbench')}
            >
              <TreeFolder level={3} label="Overview" open={open('overview')} onToggle={() => toggle('overview')}>
                <Leaf
                  level={4}
                  icon={gear}
                  label="Object Navigator"
                  meta="SE80"
                  hint="Search repository objects — programs, tables, classes, function modules"
                  onClick={() => navigate('search')}
                />
                <Leaf
                  level={4}
                  icon={gear}
                  label="Data Browser"
                  meta="SE16"
                  hint="Display and analyze database table contents"
                  onClick={() => navigate('browser')}
                />
              </TreeFolder>

              <TreeFolder
                level={3}
                label="Development"
                open={open('development')}
                onToggle={() => toggle('development')}
              >
                <Leaf
                  level={4}
                  icon={gear}
                  label="ABAP Dictionary"
                  meta="SE11"
                  hint="Tables, data elements, domains, structures"
                  onClick={() => navigate('dictionary')}
                />
                <Leaf
                  level={4}
                  icon={gear}
                  label="Data Modeler"
                  meta="SD11"
                  hint="Data modeling tools (not part of this training system)"
                  onClick={dataModeler}
                />
                <TreeFolder
                  level={4}
                  label="User Interface"
                  open={open('user-interface')}
                  onToggle={() => toggle('user-interface')}
                >
                  <p className="py-1 text-[12.5px] italic text-[#55677a]" style={indent(5)}>
                    {UI_NOTE}
                  </p>
                </TreeFolder>
                <Leaf
                  level={4}
                  icon={gear}
                  label="ABAP Editor"
                  meta="SE38"
                  hint="Create, change and execute ABAP programs"
                  onClick={() => openSe38Initial()}
                />
                <Leaf
                  level={4}
                  icon={gear}
                  label="Function Builder"
                  meta="SE37"
                  hint="Function modules and function groups"
                  onClick={() => navigate('functions')}
                />
                <Leaf
                  level={4}
                  icon={gear}
                  label="Class Builder"
                  meta="SE24"
                  hint="ABAP Objects classes and interfaces"
                  onClick={() => navigate('classes')}
                />
                <Leaf
                  level={4}
                  icon={gear}
                  label="Shared Objects Area Administration"
                  meta="SHMA"
                  hint="Shared objects administration (not part of this training system)"
                  onClick={sharedObjectsArea}
                />
                <Leaf
                  level={4}
                  icon={gear}
                  label="Shared Objects Monitor"
                  meta="SHMM"
                  hint="Shared objects monitor (not part of this training system)"
                  onClick={sharedObjectsMonitor}
                />
              </TreeFolder>

              <TreeFolder
                level={3}
                label="Programming Environment"
                open={open('programming')}
                onToggle={() => toggle('programming')}
              >
                <p className="py-1 text-[12.5px] italic text-[#55677a]" style={indent(4)}>
                  {PROGRAMMING_NOTE}
                </p>
              </TreeFolder>

              <TreeFolder
                level={3}
                label="Enhancement Framework"
                open={open('enhancement')}
                onToggle={() => toggle('enhancement')}
              >
                <p className="py-1 text-[12.5px] italic text-[#55677a]" style={indent(4)}>
                  {EMPTY_NOTE}
                </p>
              </TreeFolder>

              <TreeFolder
                level={3}
                label="Switch Framework"
                open={open('switch')}
                onToggle={() => toggle('switch')}
              >
                <p className="py-1 text-[12.5px] italic text-[#55677a]" style={indent(4)}>
                  {EMPTY_NOTE}
                </p>
              </TreeFolder>
            </TreeFolder>

            <Leaf
              level={2}
              icon={gear}
              label="Business Object Builder"
              meta="SWO1"
              hint="Business Object Builder (not part of this training system)"
              onClick={businessObjectBuilder}
            />
          </TreeFolder>

          {STANDARD_FOLDERS_AFTER_TOOLS.map((label) => (
            <TreeFolder key={label} level={1} label={label} open={open(label)} onToggle={() => toggle(label)}>
              <p className="py-1 text-[12.5px] italic text-[#55677a]" style={indent(2)}>
                {EMPTY_NOTE}
              </p>
            </TreeFolder>
          ))}
        </TreeFolder>

        {/* ABAP Training — custom area menu (topics → example programs) */}
        <TreeFolder level={0} label="ABAP Training" open={open('training')} onToggle={() => toggle('training')}>
          <Leaf
            level={1}
            icon={<Pencil className="h-4 w-4" style={{ color: C_PRACTICE }} />}
            label="My Practice Program"
            objType="REPORT"
            objName="Z_MY_PRACTICE"
            meta="Z_MY_PRACTICE"
            hint="Your own private practice program — examples stay read-only; write, run and save your code here"
            onClick={() => void openSandbox()}
          />
          <Leaf
            level={1}
            icon={<Sparkles className="h-4 w-4" style={{ color: C_TABLE }} />}
            label="Modern ABAP Workspace"
            meta="7.40 · CDS · RAP · AMDP"
            hint="Executable 7.40 examples, validated CDS/RAP definitions and simulated AMDP — with explicit unsupported boundaries"
            onClick={openModern}
          />
          <Leaf
            level={1}
            icon={<BookOpen className="h-4 w-4" style={{ color: C_TABLE }} />}
            label="Syllabus Overview"
            meta={topics ? `${topics.length} topics` : undefined}
            hint="Open the complete training syllabus"
            onClick={() => openSyllabusTopic(-1)}
          />
          {topics === null && (
            <div className="space-y-1 py-1" style={indent(1)}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-[14px] w-72 animate-pulse bg-[#e6eef7]" />
              ))}
            </div>
          )}
          {topics && groupTopicsByCategory(topics).map((g) => (
            <TreeFolder
              key={g.id}
              level={1}
              label={g.label}
              open={open(`cat-${g.id}`)}
              onToggle={() => toggle(`cat-${g.id}`)}
            >
              {g.topics.map((t) => (
                <Fragment key={t.id}>
                  <TreeFolder
                    level={2}
                    label={`${t.srNo} · ${t.title}`}
                    open={open(`topic-${t.id}`)}
                    onToggle={() => toggle(`topic-${t.id}`)}
                  >
                    {t.examples.length === 0 ? (
                      <p className="py-1 text-[12.5px] italic text-[#55677a]" style={indent(3)}>
                        No example programs in this topic yet.
                      </p>
                    ) : (
                      t.examples.map((ex) => (
                        <Leaf
                          key={ex.id}
                          level={3}
                          icon={<Play className="h-4 w-4" style={{ color: C_PROGRAM }} />}
                          label={ex.name}
                          objType="REPORT"
                          objName={ex.name}
                          hint={ex.title}
                          meta={ex.title}
                          onClick={() => void openProgramByName(ex.name)}
                        />
                      ))
                    )}
                  </TreeFolder>
                </Fragment>
              ))}
            </TreeFolder>
          ))}
          {topics !== null && topics.length === 0 && (
            <p className="py-1 text-[12.5px] italic text-[#55677a]" style={indent(1)}>
              The training content is being seeded — topics will appear here shortly.
            </p>
          )}
        </TreeFolder>
      </div>
    </div>
  )
}
