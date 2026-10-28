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
//     ABAP Training (custom, inside SAP Menu after WebClient UI Framework)
// Real transactions used by the training workbench:
//   SE80 Object Navigator, SE16 Data Browser, SE38 ABAP Editor,
//   SE11 ABAP Dictionary, SE37 Function Builder, SE24 Class Builder.
//
// The screen action row lives in the shell; this component only subscribes to
// its `home` actions and renders the white navigation tree.
import { Fragment, useEffect, useRef, useState } from 'react'
import {
  BookOpen, Pencil, Play, Settings, Sparkles, Star,
} from 'lucide-react'
import { useWorkbench, api } from './use-workbench'
import { groupTopicsByCategory, TOPIC_CATEGORIES } from './types'
import type { Topic } from './types'

// menu indentation steps (px) — 5 nesting levels
const INDENT = [10, 26, 42, 58, 74]
const indent = (level: number) => ({ paddingLeft: INDENT[Math.min(level, INDENT.length - 1)] })

const C_PROGRAM = '#0A6DD1'
const C_TRANSACTION = '#4C6B8A'
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

const ROW_CLS =
  'group flex min-h-[24px] w-full items-center gap-[5px] border-b border-[#eef2f7] pr-2 text-left hover:bg-[#e8f1fa]'

// ── blue outline folder icons (WebGUI Easy Access style) ───────────────
function FolderGlyph({ open }: { open: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <path
        d="M1.8 4.2h4l1.5 1.7h6.9v7.3H1.8z"
        fill="#ffffff"
        stroke="#4C6B8A"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {open && (
        <path
          d="M4.6 6.9h9.6l-1.3 5.3H3.3z"
          fill="#f2f6fa"
          stroke="#4C6B8A"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

// ── folder node (▸/▾ expander + outline folder + label) ────────────────
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
      <button
        type="button"
        className={ROW_CLS}
        style={indent(level)}
        onClick={onToggle}
        aria-expanded={open}
        title={label}
      >
        <span className="w-[10px] shrink-0 text-center text-[9px] leading-none text-[#4C6B8A]" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
        <FolderGlyph open={open} />
        <span className="truncate text-[12.5px] text-[#284d74]">{label}</span>
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
  /** repository object this leaf represents (used by the favorites action) */
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
      <span className="truncate text-[12.5px] text-[#0A6DD1] group-hover:underline">{label}</span>
      {meta && (
        <span className="ml-auto max-w-[45%] shrink-0 truncate pl-3 text-[11px] text-[#55677a]">{meta}</span>
      )}
      {badge}
    </button>
  )
}

const gear = <Settings className="h-3.5 w-3.5" style={{ color: C_TRANSACTION }} />

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
  const [sel, setSel] = useState<{ type: string; name: string; label: string } | null>(null)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({
    favorites: true,
    sapmenu: true,
    tools: false,
    workbench: false,
    overview: false,
    development: false,
    programming: false,
    enhancement: false,
    switch: false,
    'user-interface': false,
    training: false,
    'cat-CORE': false,
    'cat-REPORTING': false,
    'cat-MODERN': false,
  })

  useEffect(() => {
    void refreshFavorites()
    api<{ topics: Topic[] }>('/api/topics')
      .then((r) => setTopics(r.topics))
      .catch(() => setTopics([]))
  }, [refreshFavorites])

  const open = (id: string) => !!openMap[id]
  const toggle = (id: string) => setOpenMap((o) => ({ ...o, [id]: !o[id] }))
  const setAll = (v: boolean) => {
    const ids = [
      'favorites', 'sapmenu', 'tools', 'workbench', 'overview', 'development',
      'programming', 'enhancement', 'switch', 'user-interface', 'training',
      ...STANDARD_FOLDERS,
      ...TOPIC_CATEGORIES.map((c) => `cat-${c.id}`),
      ...(topics ?? []).map((t) => `topic-${t.id}`),
    ]
    setOpenMap(Object.fromEntries(ids.map((id) => [id, v])))
  }

  // click on a program leaf → remembered for the favorites action
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
      .addMessage('I', 'Favorites maintenance: use Add to Favorites or Remove from Favorites in the More menu')

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

  // The shell renders the flat action row and dispatches these actions here,
  // where the tree state and current selection live.
  const actionsRef = useRef<Record<string, () => void>>({})
  useEffect(() => {
    actionsRef.current = {
      'toggle-sapmenu': () => toggle('sapmenu'),
      workplace: businessWorkplace,
      'add-favorite': addFavorite,
      'remove-favorite': removeFavorite,
      'edit-favorites': editFavorites,
      'expand-all': () => setAll(true),
      'collapse-all': () => setAll(false),
      'create-role': createRole,
      'assign-users': assignUsers,
      syllabus: () => openSyllabusTopic(-1),
    }
  })
  useEffect(() => {
    const onAction = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string; id?: string }>).detail
      if (detail?.target !== 'home' || !detail.id) return
      actionsRef.current[detail.id]?.()
    }
    window.addEventListener('sap-screen-action', onAction)
    return () => window.removeEventListener('sap-screen-action', onAction)
  }, [])

  return (
    <div className="flex h-full min-h-0 bg-[#ebf1f7] p-[6px]" data-testid="easy-access">
      <div
        className="flex min-h-0 w-full max-w-[640px] flex-col border border-[#b9cbdd] bg-white"
        aria-label="SAP Easy Access menu"
      >
        <div className="wb-scroll min-h-0 flex-1 overflow-auto pb-5" onClickCapture={captureSelection}>
          {/* Favorites */}
          <TreeFolder level={0} label="Favorites" open={open('favorites')} onToggle={() => toggle('favorites')}>
            {favorites.length === 0 ? (
              <p className="border-b border-[#eef2f7] py-[3px] text-[11.5px] italic text-[#55677a]" style={indent(1)}>
                No favorites yet — star a program in the editor.
              </p>
            ) : (
              favorites.map((fv) => (
                <Leaf
                  key={fv.id}
                  level={1}
                  icon={<Star className="h-3.5 w-3.5" style={{ color: '#c9a227' }} />}
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

          {/* SAP Menu — standard structure (screenshot order) */}
          <TreeFolder level={0} label="SAP Menu" open={open('sapmenu')} onToggle={() => toggle('sapmenu')}>
            {STANDARD_FOLDERS_BEFORE_TOOLS.map((label) => (
              <TreeFolder key={label} level={1} label={label} open={open(label)} onToggle={() => toggle(label)}>
                <p className="border-b border-[#eef2f7] py-[3px] text-[11.5px] italic text-[#55677a]" style={indent(2)}>
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
                    <p className="border-b border-[#eef2f7] py-[3px] text-[11.5px] italic text-[#55677a]" style={indent(5)}>
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
                  <p className="border-b border-[#eef2f7] py-[3px] text-[11.5px] italic text-[#55677a]" style={indent(4)}>
                    {PROGRAMMING_NOTE}
                  </p>
                </TreeFolder>

                <TreeFolder
                  level={3}
                  label="Enhancement Framework"
                  open={open('enhancement')}
                  onToggle={() => toggle('enhancement')}
                >
                  <p className="border-b border-[#eef2f7] py-[3px] text-[11.5px] italic text-[#55677a]" style={indent(4)}>
                    {EMPTY_NOTE}
                  </p>
                </TreeFolder>

                <TreeFolder
                  level={3}
                  label="Switch Framework"
                  open={open('switch')}
                  onToggle={() => toggle('switch')}
                >
                  <p className="border-b border-[#eef2f7] py-[3px] text-[11.5px] italic text-[#55677a]" style={indent(4)}>
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
                <p className="border-b border-[#eef2f7] py-[3px] text-[11.5px] italic text-[#55677a]" style={indent(2)}>
                  {EMPTY_NOTE}
                </p>
              </TreeFolder>
            ))}
            {/* ABAP Training — custom area menu (topics → example programs), inside SAP Menu */}
            <TreeFolder level={1} label="ABAP Training" open={open('training')} onToggle={() => toggle('training')}>
              <Leaf
                level={2}
                icon={<Pencil className="h-3.5 w-3.5" style={{ color: C_PRACTICE }} />}
                label="My Practice Program"
                objType="REPORT"
                objName="Z_MY_PRACTICE"
                meta="Z_MY_PRACTICE"
                hint="Your own private practice program — examples stay read-only; write, run and save your code here"
                onClick={() => void openSandbox()}
              />
              <Leaf
                level={2}
                icon={<Sparkles className="h-3.5 w-3.5" style={{ color: C_TABLE }} />}
                label="Modern ABAP Workspace"
                meta="7.40 · CDS · RAP · AMDP"
                hint="Executable 7.40 examples, validated CDS/RAP definitions and simulated AMDP — with explicit unsupported boundaries"
                onClick={openModern}
              />
              <Leaf
                level={2}
                icon={<BookOpen className="h-3.5 w-3.5" style={{ color: C_TABLE }} />}
                label="Syllabus Overview"
                meta={topics ? `${topics.length} topics` : undefined}
                hint="Open the complete training syllabus"
                onClick={() => openSyllabusTopic(-1)}
              />
              {topics === null && (
                <div className="space-y-1 py-1" style={indent(2)}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-[14px] w-72 animate-pulse bg-[#e6eef7]" />
                  ))}
                </div>
              )}
              {topics && groupTopicsByCategory(topics).map((g) => (
                <TreeFolder
                  key={g.id}
                  level={2}
                  label={g.label}
                  open={open(`cat-${g.id}`)}
                  onToggle={() => toggle(`cat-${g.id}`)}
                >
                  {g.topics.map((t) => (
                    <Fragment key={t.id}>
                      <TreeFolder
                        level={3}
                        label={`${t.srNo} · ${t.title}`}
                        open={open(`topic-${t.id}`)}
                        onToggle={() => toggle(`topic-${t.id}`)}
                      >
                        {t.examples.length === 0 ? (
                          <p className="border-b border-[#eef2f7] py-[3px] text-[11.5px] italic text-[#55677a]" style={indent(4)}>
                            No example programs in this topic yet.
                          </p>
                        ) : (
                          t.examples.map((ex) => (
                            <Leaf
                              key={ex.id}
                              level={4}
                              icon={<Play className="h-3.5 w-3.5" style={{ color: C_PROGRAM }} />}
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
                <p className="border-b border-[#eef2f7] py-[3px] text-[11.5px] italic text-[#55677a]" style={indent(2)}>
                  The training content is being seeded — topics will appear here shortly.
                </p>
              )}
            </TreeFolder>
          </TreeFolder>
        </div>
      </div>
    </div>
  )
}
