'use client'

// ── SAP GUI shell — NetWeaver ABAP Workbench look & feel ──────────────
import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Toaster } from '@/components/ui/sonner'
import { useWorkbench } from './use-workbench'
import { CommandField } from './command-field'
import { StatusBar } from './status-bar'
import { NavigatorTree } from './navigator-tree'
import { EasyAccess } from './easy-access'
import { EditorView } from './editor-view'
import { Se38Initial } from './se38-initial'
import { OutputView } from './output-view'
import { SyllabusView } from './syllabus-view'
import { SearchView } from './search-view'
import { DictionaryView } from './dictionary-view'
import { DataBrowserView } from './data-browser'
import { FunctionBuilderView } from './function-builder'
import { ClassBuilderView } from './class-builder'
import { SelectionScreen } from './selection-screen'
import { CommandPalette } from './command-palette'
import {
  AboutDialog, ConfirmCreateDialog, ConfirmDeleteDialog, LogoffConfirmDialog,
  NewObjectDialog, SystemStatusDialog, TcodeRegistryDialog,
} from './dialogs'
import { LogonPad } from './logon-pad'
import { getContextTitle } from './context-title'

// ── SAP toolbar icons (inline SVG approximations of GUI icons) ─────────

const I = {
  enter: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="#2ea52e" stroke="#1c7a1c" />
      <path d="M4.4 8.3l2.3 2.3 4.8-5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  save: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M2 2h9.5L14 4.5V14H2z" fill="#eef3f9" stroke="#3c5a7a" />
      <path d="M4.5 2h6v4h-6z" fill="#fff" stroke="#3c5a7a" />
      <path d="M4.5 9h7v5h-7z" fill="#c9d8ea" stroke="#3c5a7a" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M8 2.5l-3 3 3 3" fill="none" stroke="#0f7d0f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.2 5.5H11a2.6 2.6 0 012.6 2.6v1.4" fill="none" stroke="#0f7d0f" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  exit: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M3 13.5V3.5h6" fill="none" stroke="#0f7d0f" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7.5 10.5L11 7 7.5 3.5" fill="none" stroke="#0f7d0f" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 7h3" stroke="#0f7d0f" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  cancel: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  print: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <rect x="3" y="2" width="10" height="4.5" fill="#fff" stroke="#3c5a7a" />
      <rect x="2" y="6.5" width="12" height="5" fill="#dfe8f2" stroke="#3c5a7a" />
      <rect x="4" y="9.5" width="8" height="4.5" fill="#fff" stroke="#3c5a7a" />
    </svg>
  ),
  find: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <circle cx="7" cy="7" r="4.2" fill="none" stroke="#3c5a7a" strokeWidth="1.6" />
      <path d="M10.2 10.2L14 14" stroke="#3c5a7a" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  ),
  findNext: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <circle cx="6.4" cy="6.4" r="3.8" fill="none" stroke="#3c5a7a" strokeWidth="1.5" />
      <path d="M9.2 9.2L12.4 12.4" stroke="#3c5a7a" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 2.6l2 2-2 2" fill="none" stroke="#3c5a7a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  first: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M4 3v10" stroke="#3c5a7a" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 3.5L6.5 8l5.5 4.5z" fill="#3c5a7a" />
    </svg>
  ),
  prev: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M11 3.5L5.5 8l5.5 4.5z" fill="#3c5a7a" />
    </svg>
  ),
  next: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M5 3.5L10.5 8 5 12.5z" fill="#3c5a7a" />
    </svg>
  ),
  last: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M12 3v10" stroke="#3c5a7a" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 3.5L9.5 8 4 12.5z" fill="#3c5a7a" />
    </svg>
  ),
  session: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <rect x="2" y="3.5" width="9" height="7" fill="#fff" stroke="#3c5a7a" />
      <path d="M11 5.5h3v7h-3" fill="#dfe8f2" stroke="#3c5a7a" />
      <path d="M5.6 7.8h2.6M6.9 6.4v2.8" stroke="#1c7a1c" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  customize: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <circle cx="8" cy="8" r="2.1" fill="none" stroke="#3c5a7a" strokeWidth="1.5" />
      <path
        d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6L11 5M5 11l-1.4 1.4"
        stroke="#3c5a7a" strokeWidth="1.4" strokeLinecap="round"
      />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <rect x="3" y="2.5" width="10" height="11" fill="#fff" stroke="#3c5a7a" />
      <path d="M5 6.5h6M5 9h6" stroke="#a9b9ca" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4.2 4.4l1 1 1.7-1.9" fill="none" stroke="#2ea52e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  activate: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <circle cx="8" cy="8" r="6.3" fill="none" stroke="#3c5a7a" strokeWidth="1.4" />
      <path d="M8 4.6V11" stroke="#0f7d0f" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M5.4 6.6L8 4l2.6 2.6" fill="none" stroke="#0f7d0f" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  whereUsed: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M2.5 4h6M2.5 7h4.4M2.5 10h4.4" stroke="#3c5a7a" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10.6" cy="9.4" r="2.9" fill="none" stroke="#3c5a7a" strokeWidth="1.5" />
      <path d="M12.8 11.6L14.6 13.4" stroke="#3c5a7a" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  objectList: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M5 4h8.5M5 8h8.5M5 12h8.5" stroke="#3c5a7a" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="2.6" cy="4" r="1" fill="#3c5a7a" />
      <circle cx="2.6" cy="8" r="1" fill="#3c5a7a" />
      <circle cx="2.6" cy="12" r="1" fill="#3c5a7a" />
    </svg>
  ),
  toggleNav: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <rect x="2" y="3" width="12" height="10" fill="#fff" stroke="#3c5a7a" />
      <path d="M6 3v10" stroke="#3c5a7a" />
      <path d="M3.2 5h1.6M3.2 7.5h1.6M3.2 10h1.6" stroke="#3c5a7a" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  pretty: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M3 5h10M3 8h7M3 11h9" stroke="#3c5a7a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.6 2.4l1 1-4.4 4.4-1.4.4.4-1.4z" fill="#dfe8f2" stroke="#3c5a7a" strokeWidth="0.9" />
    </svg>
  ),
  execute: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <circle cx="8" cy="8" r="6.6" fill="#eef6ee" stroke="#1c7a1c" strokeWidth="1.2" />
      <path d="M6 5.2l4.6 2.8L6 10.8z" fill="#2ea52e" stroke="#1c7a1c" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  ),
}

function ToolBtn({
  icon, title, onClick, disabled, active,
}: {
  icon: React.ReactNode
  title: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      className={`sap-tool-btn ${active ? '!bg-[#d7e6f7] !border-[#8fb0d4]' : ''}`}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  )
}

// ── menu model ─────────────────────────────────────────────────────────

type MItem =
  | { sep: true }
  | { label: string; shortcut?: string; disabled?: boolean; run?: () => void }

interface MMenu {
  label: string
  items: MItem[]
}

function MenuList({ items }: { items: MItem[] }) {
  return (
    <>
      {items.map((it, i) =>
        'sep' in it ? (
          <DropdownMenuSeparator key={i} className="my-0.5 bg-[#d6dfe8]" />
        ) : (
          <DropdownMenuItem
            key={i}
            disabled={it.disabled}
            onSelect={() => it.run?.()}
            className="flex items-center justify-between gap-8 rounded-none px-2.5 py-[6px] text-[13px] text-[#12283c] focus:bg-[#bcd6f2] focus:text-[#0a2f57] data-[disabled]:opacity-40"
          >
            <span>{it.label}</span>
            {it.shortcut && <span className="font-mono text-[11px] text-[#6b7f95]">{it.shortcut}</span>}
          </DropdownMenuItem>
        ),
      )}
    </>
  )
}

// ── shell ──────────────────────────────────────────────────────────────

export function SapShell() {
  const view = useWorkbench((s) => s.view)
  const tabs = useWorkbench((s) => s.tabs)
  const activeTabKey = useWorkbench((s) => s.activeTabKey)
  const navigatorOpen = useWorkbench((s) => s.navigatorOpen)
  const setNavigatorOpen = useWorkbench((s) => s.setNavigatorOpen)
  const activateTab = useWorkbench((s) => s.activateTab)
  const closeTab = useWorkbench((s) => s.closeTab)
  const logon = useWorkbench((s) => s.session.loggedIn)
  const editorFontSize = useWorkbench((s) => s.editorFontSize)
  const systemInfoVisible = useWorkbench((s) => s.systemInfoVisible)
  const setSystemStatusOpen = useWorkbench((s) => s.setSystemStatusOpen)
  const setLogoffConfirm = useWorkbench((s) => s.setLogoffConfirm)
  const setEditorFontSize = useWorkbench((s) => s.setEditorFontSize)
  const toggleSystemInfo = useWorkbench((s) => s.toggleSystemInfo)
  const pendingSelectionObj = useWorkbench((s) => s.pendingSelection)
  const pendingSelection = !!pendingSelectionObj
  const findOpen = useWorkbench((s) => s.findOpen)
  const runFindNext = useWorkbench((s) => s.runFindNext)

  const activeTab = tabs.find((t) => t.key === activeTabKey) ?? null

  // minimal reactive program info (avoids re-render on every keystroke)
  const { activeProgramName, activeDirty, activeIsExample } = useWorkbench(
    useShallow((s) => {
      const t = s.tabs.find((x) => x.key === s.activeTabKey)
      const n = t?.kind === 'program' ? t.programName : null
      const p = n ? s.programs[n] : undefined
      return {
        activeProgramName: n,
        activeDirty: !!p?.dirty,
        activeIsExample: !!p?.isExample,
      }
    }),
  )

  const lastTcode = useWorkbench((s) => s.lastTcode)
  const browserTable = useWorkbench((s) => s.browserTable)
  const selectedFunction = useWorkbench((s) => s.selectedFunction)
  const se38Program = useWorkbench((s) => s.se38Program)
  const se38Subobject = useWorkbench((s) => s.se38Subobject)
  const se38ShowSubobject = useWorkbench((s) => s.se38ShowSubobject)

  const title = getContextTitle({
    view,
    tabs,
    activeTabKey,
    lastTcode,
    browserTable,
    selectedFunction,
    selectionProgram: pendingSelectionObj?.programName ?? null,
    se38Program,
    se38Subobject,
    se38ShowSubobject,
  })

  // window (document) title — like the SAP GUI window caption
  useEffect(() => {
    document.title = title
  }, [title])

  // ── common actions (store-level, stable) ─────────────────────────────
  const back = () => {
    const s = useWorkbench.getState()
    if (s.view === 'se38') {
      if (s.se38ShowSubobject) s.setSe38ShowSubobject(false)
      else s.navigate('home')
      return
    }
    if (s.view !== 'tab') {
      s.navigate('home')
      return
    }
    const idx = s.tabs.findIndex((t) => t.key === s.activeTabKey)
    if (s.tabs.length > 1) {
      const prev = s.tabs[(idx - 1 + s.tabs.length) % s.tabs.length]
      s.activateTab(prev.key)
    } else {
      s.navigate('home')
    }
  }

  const exitToHome = () => {
    useWorkbench.getState().navigate('home')
  }

  const cancel = () => {
    const s = useWorkbench.getState()
    if (s.pendingSelection) {
      s.cancelSelection()
      return
    }
    if (s.view === 'tab' && s.activeTabKey) s.closeTab(s.activeTabKey)
  }

  const activateProgram = async (name: string) => {
    const s = useWorkbench.getState()
    await s.saveProgram(name)
    await s.checkProgram(name)
    const issues = useWorkbench.getState().checkResults[name] ?? []
    const errs = issues.filter((i) => i.kind === 'E')
    if (errs.length === 0) useWorkbench.getState().addMessage('S', `Object ${name} was activated`)
  }

  const pageMain = (dir: 'first' | 'last' | 'up' | 'down') => {
    const el = document.getElementById('wb-main')
    if (!el) return
    if (dir === 'first') el.scrollTo({ top: 0 })
    else if (dir === 'last') el.scrollTo({ top: el.scrollHeight })
    else el.scrollBy({ top: dir === 'up' ? -(el.clientHeight - 60) : el.clientHeight - 60 })
  }

  const findInEditor = () => {
    const s = useWorkbench.getState()
    const t = s.tabs.find((x) => x.key === s.activeTabKey)
    if (t?.kind === 'program') s.setFindOpen(true)
    else s.addMessage('I', 'Find: position the cursor in a source code screen')
  }

  const editorMode = activeProgramName ? 'Change' : null

  // ── per-view menu bars (SAP screen menus) ────────────────────────────
  const menus: MMenu[] = useMemo(() => {
    const w = () => useWorkbench.getState()
    const gotoMenu: MMenu = {
      label: 'Goto',
      items: [
        { label: 'Back', shortcut: 'F3', run: back },
        { label: 'Exit', shortcut: 'Shift+F3', run: exitToHome },
        { sep: true },
        { label: 'Line…', shortcut: 'Ctrl+G', disabled: true },
        { label: 'Class/Method…', disabled: true },
      ],
    }
    const systemMenu: MMenu = {
      label: 'System',
      items: [
        { label: 'Create Session', disabled: true },
        { label: 'End Session', disabled: true },
        { sep: true },
        { label: 'Status…', run: () => setSystemStatusOpen(true) },
        { label: 'Services', disabled: true },
        {
          label: 'Services → Object Search',
          run: () => {
            w().setSearchQuery('')
            w().navigate('search')
          },
        },
        { label: 'Services → Transaction Codes (SE93)', run: () => w().setTcodeDialogOpen(true) },
        { sep: true },
        { label: 'Log Off', run: () => setLogoffConfirm(true) },
      ],
    }
    const helpMenu: MMenu = {
      label: 'Help',
      items: [
        {
          label: 'Help on Current Screen',
          shortcut: 'F1',
          run: () =>
            w().addMessage('I', 'Help: this is an in-browser ABAP Workbench — use the menus, the command field, and the syllabus under Environment ▸ Syllabus for documentation.'),
        },
        { sep: true },
        { label: 'ABAP Keyword Documentation', disabled: true },
        { label: 'About ABAPForge', run: () => w().setAboutOpen(true) },
      ],
    }

    if (view === 'tab' && activeTab?.kind === 'program' && activeProgramName) {
      const n = activeProgramName
      const prog = w().programs[n]
      const editMenu: MMenu = {
        label: 'Edit',
        items: [
          { label: 'Undo', shortcut: 'Ctrl+Z', disabled: true },
          { label: 'Redo', shortcut: 'Ctrl+Y', disabled: true },
          { sep: true },
          { label: 'Cut', shortcut: 'Ctrl+X', disabled: true },
          { label: 'Copy', shortcut: 'Ctrl+C', disabled: true },
          { label: 'Paste', shortcut: 'Ctrl+V', disabled: true },
          { sep: true },
          { label: 'Find', shortcut: 'Ctrl+F', run: findInEditor },
          { label: 'Find Next', shortcut: 'Ctrl+G', disabled: !findOpen, run: runFindNext },
          { label: 'Replace', shortcut: 'Ctrl+H', disabled: true },
          { sep: true },
          { label: 'Select All', shortcut: 'Ctrl+A', disabled: true },
        ],
      }
      const gotoEditor: MMenu = {
        ...gotoMenu,
        items: [
          { label: 'Back', shortcut: 'F3', run: back },
          { label: 'Exit', shortcut: 'Shift+F3', run: exitToHome },
          { label: 'Cancel', shortcut: 'F12', run: cancel },
          { sep: true },
          { label: 'Line…', disabled: true },
          { label: 'Class/Method…', disabled: true },
          { label: 'Navigation History', disabled: true },
        ],
      }
      return [
        {
          label: 'Program',
          items: [
            { label: 'Create…', run: () => w().openNewDialog({ prefillType: prog?.type }) },
            { sep: true },
            { label: 'Display', disabled: true },
            { label: 'Change', run: () => w().addMessage('I', `${n}: editor is in Change mode`) },
            { sep: true },
            { label: 'Check', shortcut: 'Ctrl+F2', run: () => void w().checkProgram(n) },
            { label: 'Activate', run: () => void activateProgram(n) },
            { sep: true },
            { label: 'Execute', shortcut: 'F8', run: () => void w().runProgram(n) },
            { label: 'Execute with Variant…', disabled: true },
            { sep: true },
            ...(activeIsExample
              ? ([
                  { label: 'Save (read-only example)', disabled: true },
                  {
                    label: 'Save As…',
                    run: () =>
                      w().openNewDialog({
                        prefillName: `${n}_COPY`,
                        prefillSource: prog?.source,
                        prefillTitle: prog?.title,
                        prefillType: prog?.type,
                        saveAsFrom: n,
                      }),
                  },
                ] as MItem[])
              : ([
                  { label: 'Save', shortcut: 'Ctrl+S', run: () => void w().saveProgram(n) },
                ] as MItem[])),
            { sep: true },
            { label: 'Delete', run: () => w().setConfirmDelete({ name: n }) },
            { sep: true },
            { label: 'Exit', shortcut: 'Shift+F3', run: exitToHome },
          ],
        },
        editMenu,
        gotoEditor,
        {
          label: 'Utilities',
          items: [
            { label: 'Pretty Printer', shortcut: 'Shift+F1', run: () => w().addMessage('I', 'Pretty printer: source is re-indented on save (demo)') },
            { sep: true },
            { label: 'Text Elements', disabled: true },
            { label: 'Version Management', disabled: true },
            { label: 'Runtime Analysis', disabled: true },
          ],
        },
        {
          label: 'Environment',
          items: [
            { label: 'Object Navigator', shortcut: 'SE80', run: () => { w().setNavigatorOpen(true); w().navigate('home'); w().addMessage('I', 'Object Navigator (SE80)') } },
            { label: 'Where-Used List', shortcut: 'Ctrl+Shift+F', run: () => void w().showWhereUsed(n) },
            { sep: true },
            { label: 'Dictionary', shortcut: 'SE11', run: () => w().navigate('dictionary') },
            { label: 'Data Browser', shortcut: 'SE16', run: () => w().navigate('browser') },
            { label: 'Function Builder', shortcut: 'SE37', run: () => w().navigate('functions') },
            { label: 'Class Builder', shortcut: 'SE24', run: () => w().navigate('classes') },
            { label: 'Syllabus / Training', run: () => w().openSyllabusTopic(-1) },
          ],
        },
        systemMenu,
        helpMenu,
      ]
    }

    if (view === 'tab' && activeTab?.kind === 'output') {
      return [
        {
          label: 'List',
          items: [
            { label: 'Execute', shortcut: 'F8', run: () => void w().runProgram(activeTab.programName) },
            { label: 'Print List', shortcut: 'Ctrl+P', run: () => window.print() },
            { sep: true },
            { label: 'Display as ALV Grid', disabled: true },
          ],
        },
        gotoMenu,
        systemMenu,
        helpMenu,
      ]
    }

    if (view === 'browser') {
      return [
        {
          label: 'Table',
          items: [
            { label: 'Display', run: () => {} },
            { label: 'Maintain', disabled: true },
            { sep: true },
            { label: 'Definition (SE11)', run: () => w().navigate('dictionary') },
          ],
        },
        {
          label: 'Edit',
          items: [
            { label: 'Number of Hits', disabled: true },
            { label: 'Layout…', disabled: true },
          ],
        },
        gotoMenu,
        {
          label: 'Settings',
          items: [
            { label: 'User Settings', disabled: true },
            { label: 'Choose Fields…', disabled: true },
          ],
        },
        systemMenu,
        helpMenu,
      ]
    }

    if (view === 'dictionary') {
      return [
        {
          label: 'Dictionary',
          items: [
            { label: 'Display', run: () => {} },
            { label: 'Change', disabled: true },
            { sep: true },
            { label: 'Display Data (SE16)', run: () => w().navigate('browser') },
          ],
        },
        gotoMenu,
        {
          label: 'Utilities',
          items: [
            { label: 'Check', disabled: true },
            { label: 'Activate', disabled: true },
            { label: 'Database Utility', disabled: true },
          ],
        },
        systemMenu,
        helpMenu,
      ]
    }

    if (view === 'functions') {
      return [
        {
          label: 'Function Builder',
          items: [
            { label: 'Display', run: () => {} },
            { label: 'Change', disabled: true },
            { sep: true },
            { label: 'Check', disabled: true },
            { label: 'Test (F8)', run: () => w().addMessage('I', 'Function Module Test: use the test console in the view below') },
            { sep: true },
            { label: 'Display Object List', disabled: true },
          ],
        },
        gotoMenu,
        {
          label: 'Environment',
          items: [
            { label: 'Object Navigator (SE80)', run: () => { w().setNavigatorOpen(true); w().navigate('home') } },
            { label: 'Where-Used List', disabled: true },
          ],
        },
        systemMenu,
        helpMenu,
      ]
    }

    if (view === 'classes') {
      return [
        {
          label: 'Class Builder',
          items: [
            { label: 'Display', run: () => {} },
            { label: 'Change', disabled: true },
            { sep: true },
            { label: 'Check', disabled: true },
            { label: 'Activate', disabled: true },
            { sep: true },
            { label: 'Create Method…', disabled: true },
          ],
        },
        gotoMenu,
        systemMenu,
        helpMenu,
      ]
    }

    if (view === 'search') {
      return [
        {
          label: 'Search',
          items: [
            { label: 'Start Search', run: () => {} },
            { label: 'Reset', run: () => w().setSearchQuery('') },
          ],
        },
        gotoMenu,
        systemMenu,
        helpMenu,
      ]
    }

    if (view === 'syllabus') {
      return [
        {
          label: 'Training',
          items: [
            { label: 'Overview', run: () => w().openSyllabusTopic(-1) },
            { sep: true },
            { label: 'Open in Object Navigator', run: () => { w().setNavigatorOpen(true); w().navigate('home') } },
          ],
        },
        gotoMenu,
        systemMenu,
        helpMenu,
      ]
    }

    if (view === 'se38') {
      return [
        {
          label: 'Program',
          items: [
            { label: 'Display', run: () => void w().se38Display('display') },
            { label: 'Change', run: () => void w().se38Display('change') },
            { sep: true },
            { label: 'Check', shortcut: 'Ctrl+F2', disabled: true },
            { label: 'Execute', shortcut: 'F8', disabled: true },
            { sep: true },
            { label: 'Exit', shortcut: 'Shift+F3', run: exitToHome },
          ],
        },
        {
          label: 'Goto',
          items: [
            { label: 'Back', shortcut: 'F3', run: back },
            { label: 'Exit', shortcut: 'Shift+F3', run: exitToHome },
            { sep: true },
            { label: 'Object Navigator', shortcut: 'SE80', run: () => { w().setNavigatorOpen(true); w().navigate('home'); w().addMessage('I', 'Object Navigator (SE80)') } },
          ],
        },
        {
          label: 'Utilities',
          items: [
            { label: 'Text Elements', run: () => { w().setSe38Subobject('text'); void w().se38Display('display') } },
            { label: 'Display Documentation', run: () => { w().setSe38Subobject('doc'); void w().se38Display('display') } },
            { sep: true },
            { label: 'Pretty Printer', disabled: true },
          ],
        },
        {
          label: 'Environment',
          items: [
            { label: 'Object Navigator', shortcut: 'SE80', run: () => { w().setNavigatorOpen(true); w().addMessage('I', 'Object Navigator (SE80)') } },
            { sep: true },
            { label: 'Dictionary', shortcut: 'SE11', run: () => w().navigate('dictionary') },
            { label: 'Data Browser', shortcut: 'SE16', run: () => w().navigate('browser') },
            { label: 'Function Builder', shortcut: 'SE37', run: () => w().navigate('functions') },
            { label: 'Class Builder', shortcut: 'SE24', run: () => w().navigate('classes') },
            { label: 'Syllabus / Training', run: () => w().openSyllabusTopic(-1) },
          ],
        },
        systemMenu,
        helpMenu,
      ]
    }

    // SAP Easy Access (home)
    return [
      {
        label: 'Menu',
        items: [
          { label: 'SAP Easy Access', run: () => w().navigate('home') },
          { sep: true },
          { label: 'ABAP Editor (SE38)', run: () => w().openSe38Initial() },
          { label: 'Object Navigator (SE80)', run: () => { w().setNavigatorOpen(true); w().addMessage('I', 'Object Navigator (SE80)') } },
          { sep: true },
          { label: 'Syllabus / Training', run: () => w().openSyllabusTopic(-1) },
        ],
      },
      {
        label: 'Edit',
        items: [
          { label: 'Find Object…', shortcut: 'Ctrl+K', run: () => w().setCommandPaletteOpen(true) },
          { sep: true },
          { label: 'Display Object…', disabled: true },
        ],
      },
      {
        label: 'Favorites',
        items: [
          { label: 'Add to Favorites', disabled: true },
          { label: 'Change…', disabled: true },
          { label: 'Delete', disabled: true },
          { sep: true },
          { label: 'Refresh Favorites', run: () => void w().refreshFavorites() },
        ],
      },
      {
        label: 'Extras',
        items: [
          { label: 'Global Object Search', run: () => w().navigate('search') },
          { label: 'SAP GUI Settings…', disabled: true },
        ],
      },
      systemMenu,
      helpMenu,
    ]
  }, [view, activeTab?.kind, activeTabKey, activeProgramName, activeDirty, activeIsExample, findOpen, setLogoffConfirm, setSystemStatusOpen])

  // ── global keys (SAP keyboard map) ───────────────────────────────────
  const anyDialogOpen = useWorkbench(
    (s) =>
      !!s.pendingSelection ||
      s.commandPaletteOpen ||
      s.newDialog.open ||
      !!s.confirmCreate ||
      !!s.confirmDelete ||
      s.aboutOpen ||
      s.tcodeDialogOpen ||
      s.systemStatusOpen ||
      s.logoffConfirm,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useWorkbench.getState().setCommandPaletteOpen(true)
        return
      }
      if (anyDialogOpen) return

      const s = useWorkbench.getState()
      const target = e.target as HTMLElement | null
      const inInput = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      const prog = s.tabs.find((x) => x.key === s.activeTabKey)?.kind === 'program'
        ? s.tabs.find((x) => x.key === s.activeTabKey)!.programName
        : null

      if (e.key === 'F3' && !e.shiftKey) {
        e.preventDefault()
        back()
      } else if (e.key === 'F3' && e.shiftKey) {
        e.preventDefault()
        exitToHome()
      } else if (e.key === 'F12') {
        e.preventDefault()
        cancel()
      } else if (e.key === 'F8' && s.view === 'se38') {
        e.preventDefault()
        void s.se38Display('display')
      } else if (e.key === 'F8' && prog && s.view === 'tab') {
        e.preventDefault()
        void s.runProgram(prog)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && prog && s.view === 'tab') {
        e.preventDefault()
        void s.saveProgram(prog)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'F2' && prog && s.view === 'tab') {
        e.preventDefault()
        void s.checkProgram(prog)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        window.print()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        if (prog && s.view === 'tab') {
          e.preventDefault()
          s.setFindOpen(true)
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        if (s.findOpen) {
          e.preventDefault()
          s.runFindNext()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'PageUp') {
        e.preventDefault()
        pageMain('first')
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'PageDown') {
        e.preventDefault()
        pageMain('last')
      } else if (e.key === 'PageUp' && !inInput) {
        pageMain('up')
      } else if (e.key === 'PageDown' && !inInput) {
        pageMain('down')
      } else if (e.key === 'F1') {
        e.preventDefault()
        s.addMessage('I', 'Help: use the menus above; the syllabus (Environment ▸ Syllabus) contains the ABAP training documentation.')
      } else if (inInput && e.key === 'Escape') {
        ;(target as HTMLElement).blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [anyDialogOpen])

  if (!logon) return <LogonPad />

  const hasTabs = tabs.length > 0
  const isEditorTab = activeTab?.kind === 'program' && !!activeProgramName

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#d6e0ec] text-[#1c2b3a]" data-app="abapforge">
      {/* ── window title bar ── */}
      <header className="sap-titlebar relative flex h-7 shrink-0 items-center gap-2 px-2 text-white" role="banner">
        {/* System menu (hamburger) */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-5 w-5 items-center justify-center rounded-[2px] text-[13px] leading-none text-white/90 outline-none hover:bg-white/15 focus-visible:bg-white/15"
            title="System menu"
            aria-label="System menu"
          >
            ≡
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={2}
            className="min-w-[220px] rounded-none border border-[#8fa7bf] bg-white p-0.5 text-[12.5px] shadow-[0_4px_16px_rgba(10,30,60,0.35)]"
          >
            <MenuList
              items={[
                { label: 'Find Object…', shortcut: 'Ctrl+K', run: () => useWorkbench.getState().setCommandPaletteOpen(true) },
                { sep: true },
                { label: 'Status…', run: () => setSystemStatusOpen(true) },
                { label: 'Log Off', run: () => setLogoffConfirm(true) },
              ]}
            />
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Back (F3) */}
        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center rounded-[2px] text-[15px] leading-none text-white/90 hover:bg-white/15"
          title="Back (F3)"
          aria-label="Back"
          onClick={back}
        >
          ‹
        </button>
        <span className="flex h-4 w-4 items-center justify-center rounded-[2px] bg-white/15" aria-hidden>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
            <rect x="1.5" y="2.5" width="13" height="10" fill="#fff" opacity="0.92" />
            <rect x="1.5" y="2.5" width="13" height="2.4" fill="#0a6ed1" />
            <path d="M5 9.6l2 2 4-4.4" fill="none" stroke="#1c7a1c" strokeWidth="1.6" />
          </svg>
        </span>
        <span className="truncate text-[12px] font-semibold">{title}</span>
        <span className="ml-auto flex select-none items-center gap-1 text-[12px] leading-none">
          <button
            type="button"
            className="cursor-default px-1.5 opacity-80 hover:opacity-100"
            title="Minimize"
            aria-label="Minimize"
          >
            –
          </button>
          <button
            type="button"
            className="cursor-default px-1.5 opacity-80 hover:opacity-100"
            title="Maximize"
            aria-label="Maximize"
          >
            ▢
          </button>
          <button
            type="button"
            className="sap-titlebar-close cursor-default rounded-[2px] px-1.5 opacity-90 hover:text-white"
            title="Log Off"
            aria-label="Log Off"
            onClick={() => setLogoffConfirm(true)}
          >
            ✕
          </button>
        </span>
      </header>

      {/* ── menu bar ── */}
      <nav className="sap-menubar flex h-[26px] shrink-0 items-center px-1" role="menubar" aria-label="Main menu">
        {menus.map((m) => (
          <DropdownMenu key={m.label}>
            <DropdownMenuTrigger className="sap-menu-item outline-none">{m.label}</DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={1}
              className="min-w-[230px] rounded-none border border-[#8fa7bf] bg-white p-0.5 text-[13px] shadow-[0_4px_16px_rgba(10,30,60,0.35)]"
            >
              <MenuList items={m.items} />
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </nav>

      {/* ── standard toolbar ── */}
      <div className="sap-toolbar flex h-[30px] shrink-0 items-center gap-0.5 px-1.5">
        <ToolBtn
          icon={I.enter}
          title="Enter"
          onClick={() => {
            const s = useWorkbench.getState()
            if (s.pendingSelection) s.addMessage('I', 'Enter — use Execute (F8) on the selection screen')
          }}
        />
        <div className="mx-1">
          <CommandField />
        </div>
        <span className="sap-toolbar-sep" aria-hidden />
        <ToolBtn
          icon={I.save}
          title="Save (Ctrl+S)"
          disabled={!isEditorTab}
          onClick={() => activeProgramName && void useWorkbench.getState().saveProgram(activeProgramName)}
        />
        <ToolBtn icon={I.back} title="Back (F3)" onClick={back} />
        <ToolBtn icon={I.exit} title="Exit (Shift+F3)" onClick={exitToHome} />
        <ToolBtn icon={I.cancel} title="Cancel (F12)" onClick={cancel} disabled={!hasTabs && !useWorkbench.getState().pendingSelection} />
        <ToolBtn icon={I.print} title="Print (Ctrl+P)" onClick={() => window.print()} />
        <span className="sap-toolbar-sep" aria-hidden />
        <ToolBtn icon={I.find} title="Find (Ctrl+F)" onClick={findInEditor} />
        <ToolBtn icon={I.findNext} title="Find Next (Ctrl+G)" disabled={!findOpen} onClick={runFindNext} />
        <span className="sap-toolbar-sep" aria-hidden />
        <ToolBtn icon={I.first} title="First Page (Ctrl+PgUp)" onClick={() => pageMain('first')} />
        <ToolBtn icon={I.prev} title="Previous Page (PgUp)" onClick={() => pageMain('up')} />
        <ToolBtn icon={I.next} title="Next Page (PgDn)" onClick={() => pageMain('down')} />
        <ToolBtn icon={I.last} title="Last Page (Ctrl+PgDn)" onClick={() => pageMain('last')} />
        <span className="sap-toolbar-sep" aria-hidden />
        <ToolBtn icon={I.session} title="Create New Session" disabled />
        <ToolBtn
          icon={I.toggleNav}
          title="Object Navigator (SE80)"
          active={navigatorOpen}
          onClick={() => setNavigatorOpen(!navigatorOpen)}
        />

        <div className="ml-auto flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger className="sap-tool-btn outline-none" title="Customize Local Layout (Alt+F12)" aria-label="Customize Local Layout">
              {I.customize}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={1} className="min-w-[240px] rounded-none border border-[#8fa7bf] bg-white p-0.5 text-[13px] shadow-[0_4px_16px_rgba(10,30,60,0.35)]">
              <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#5b6d80]">
                SAP GUI Settings
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-0.5 bg-[#d6dfe8]" />
              <DropdownMenuLabel className="px-2.5 py-[3px] text-[11.5px] text-[#5b6d80]">Font size (ABAP editor)</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={String(editorFontSize)} onValueChange={(v) => setEditorFontSize(Number(v))}>
                <DropdownMenuRadioItem value="12" className="rounded-none px-2.5 py-[6px] text-[13px] focus:bg-[#bcd6f2]">Small</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="13" className="rounded-none px-2.5 py-[6px] text-[13px] focus:bg-[#bcd6f2]">Medium (default)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="14" className="rounded-none px-2.5 py-[6px] text-[13px] focus:bg-[#bcd6f2]">Large</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator className="my-0.5 bg-[#d6dfe8]" />
              <DropdownMenuCheckboxItem
                checked={systemInfoVisible}
                onCheckedChange={toggleSystemInfo}
                className="rounded-none px-2.5 py-[6px] text-[13px] focus:bg-[#bcd6f2]"
              >
                Status bar: system information
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="my-0.5 bg-[#d6dfe8]" />
              <DropdownMenuItem disabled className="rounded-none px-2.5 py-[5px] text-[12.5px] data-[disabled]:opacity-40">
                Command Field History
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-none px-2.5 py-[6px] text-[13px] focus:bg-[#bcd6f2]"
                onSelect={() => setSystemStatusOpen(true)}
              >
                System Status…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── application toolbar (screen-specific buttons) ── */}
      {isEditorTab && (
        <div className="sap-apptoolbar flex h-[26px] shrink-0 items-center gap-0.5 px-1.5">
          <ToolBtn
            icon={I.execute}
            title="Execute (F8)"
            onClick={() => activeProgramName && void useWorkbench.getState().runProgram(activeProgramName)}
          />
          <ToolBtn
            icon={I.check}
            title="Check syntax (Ctrl+F2)"
            onClick={() => activeProgramName && void useWorkbench.getState().checkProgram(activeProgramName)}
          />
          <ToolBtn
            icon={I.activate}
            title="Activate program"
            onClick={() => activeProgramName && void activateProgram(activeProgramName)}
          />
          <span className="sap-toolbar-sep" aria-hidden />
          <ToolBtn
            icon={I.whereUsed}
            title="Where-Used List (Ctrl+Shift+F)"
            onClick={() => activeProgramName && void useWorkbench.getState().showWhereUsed(activeProgramName)}
          />
          <ToolBtn
            icon={I.objectList}
            title="Display Object List"
            onClick={() => setNavigatorOpen(true)}
          />
          <span className="sap-toolbar-sep" aria-hidden />
          <ToolBtn
            icon={I.pretty}
            title="Pretty Printer (Shift+F1)"
            onClick={() => useWorkbench.getState().addMessage('I', 'Pretty printer: source is formatted automatically when you execute')}
          />
          <span className="ml-2 flex items-center gap-2 text-[11.5px] text-[#3f5468]">
            <span>
              {editorMode === 'Change' ? 'Change' : 'Display'}
              <span className="px-1.5 text-[#8fa0b3]">|</span>
              <span className={activeDirty ? 'text-[#8a6d1a]' : 'text-[#1c7a1c]'}>
                {activeDirty ? 'Inactive (revised)' : 'Active'}
              </span>
            </span>
          </span>
        </div>
      )}

      {/* ── main area ── */}
      <div className="relative flex min-h-0 flex-1 gap-[3px] bg-[#c3d1e2] p-[3px]">
        {navigatorOpen && (
          <>
            <aside
              className="sap-sidebar absolute inset-y-0 left-0 z-30 w-[278px] shrink-0 border border-[#9db2cc] shadow-xl md:relative md:z-auto md:shadow-none"
              aria-label="Object Navigator"
            >
              <NavigatorTree />
            </aside>
            <button
              type="button"
              className="absolute inset-0 z-20 bg-black/15 md:hidden"
              onClick={() => setNavigatorOpen(false)}
              aria-label="Close navigator"
              tabIndex={-1}
            />
          </>
        )}

        <main
          id="wb-main"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[2px] border border-[#9db2cc] bg-white"
          role="main"
        >
          {hasTabs && (
            <div className="sap-tabstrip flex min-h-[28px] items-end gap-1 overflow-x-auto px-1.5 pt-1">
              <button
                type="button"
                className={`sap-tab shrink-0 ${view === 'home' ? 'bg-white' : ''}`}
                data-active={view === 'home'}
                onClick={() => useWorkbench.getState().navigate('home')}
                title="SAP Easy Access"
              >
                <span className="text-[11px]">▤</span>
                Easy Access
              </button>
              {tabs.map((tab) => {
                const isActive = view === 'tab' && tab.key === activeTabKey
                const dirty = !!useWorkbench.getState().programs[tab.programName]?.dirty
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className="sap-tab shrink-0"
                    data-active={isActive}
                    onClick={() => activateTab(tab.key)}
                    onAuxClick={(e) => {
                      if (e.button === 1) closeTab(tab.key)
                    }}
                    title={tab.kind === 'program' ? tab.programName : `List: ${tab.programName}`}
                  >
                    <span className="truncate font-mono">{tab.programName}</span>
                    {tab.kind === 'output' && (
                      <span className="text-[9.5px] font-semibold uppercase text-[#7b8a9c]">list</span>
                    )}
                    {tab.kind === 'program' && dirty && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#e0a33e]" title="Inactive (unsaved changes)" />
                    )}
                    <span
                      role="button"
                      tabIndex={-1}
                      className="ml-0.5 rounded-sm px-0.5 hover:bg-[#c7d8ec] hover:text-[#c4302f]"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(tab.key)
                      }}
                      aria-label={`Close ${tab.programName}`}
                    >
                      ✕
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="min-h-0 flex-1">
            {view === 'home' && <EasyAccess />}
            {view === 'se38' && <Se38Initial />}
            {view === 'tab' &&
              (activeTab?.kind === 'program' ? (
                pendingSelectionObj && pendingSelectionObj.programName === activeTab.programName ? (
                  <SelectionScreen />
                ) : (
                  <EditorView programName={activeTab.programName} />
                )
              ) : activeTab?.kind === 'output' ? (
                <OutputView programName={activeTab.programName} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[#7b8a9c]">
                  Select a tab or open a program
                </div>
              ))}
            {view === 'search' && <SearchView />}
            {view === 'syllabus' && <SyllabusView />}
            {view === 'dictionary' && <DictionaryView />}
            {view === 'browser' && <DataBrowserView />}
            {view === 'classes' && <ClassBuilderView />}
            {view === 'functions' && <FunctionBuilderView />}
          </div>
        </main>
      </div>

      {/* ── status bar ── */}
      <StatusBar />

      {/* ── dialogs & toasts ── */}
      <NewObjectDialog />
      <ConfirmCreateDialog />
      <ConfirmDeleteDialog />
      <LogoffConfirmDialog />
      <SystemStatusDialog />
      <AboutDialog />
      <TcodeRegistryDialog />
      <CommandPalette />
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}
