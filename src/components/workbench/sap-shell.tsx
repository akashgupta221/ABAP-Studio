'use client'

// ── SAP Shell: the complete workbench window ──────────────────────────
import { useEffect } from 'react'
import {
  BookOpen, Braces, CheckCircle2, ChevronDown, Database, FileCode2, FilePlus2,
  FunctionSquare, Home, LogOut, Menu, Monitor, Play, Save, Search, Settings, Table2,
  Terminal, Undo2, X,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Toaster } from '@/components/ui/sonner'
import { useWorkbench } from './use-workbench'
import { CommandField } from './command-field'
import { StatusBar } from './status-bar'
import { NavigatorTree } from './navigator-tree'
import { EasyAccess } from './easy-access'
import { EditorView } from './editor-view'
import { OutputView } from './output-view'
import { SyllabusView } from './syllabus-view'
import { SearchView } from './search-view'
import { DictionaryView } from './dictionary-view'
import { DataBrowserView } from './data-browser'
import { FunctionBuilderView } from './function-builder'
import { ClassBuilderView } from './class-builder'
import { SelectionScreenDialog } from './selection-screen'
import { CommandPalette } from './command-palette'
import { AboutDialog, ConfirmCreateDialog, NewObjectDialog, TcodeRegistryDialog } from './dialogs'

function SystemPill({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="hidden items-center gap-1 rounded-[3px] border border-white/25 bg-white/10 px-2 py-[3px] text-[11px] font-medium text-white md:inline-flex"
      title={`${label}: ${value}`}
    >
      <span className="text-white/60">{label}</span>
      <span className="font-mono">{value}</span>
    </span>
  )
}

function MenuBarButton({
  label, children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="sap-menu-item outline-none">{label}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56 border-[#9db2cc] text-[12.5px]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SapShell() {
  const view = useWorkbench((s) => s.view)
  const tabs = useWorkbench((s) => s.tabs)
  const activeTabKey = useWorkbench((s) => s.activeTabKey)
  const programs = useWorkbench((s) => s.programs)
  const navigatorOpen = useWorkbench((s) => s.navigatorOpen)
  const setNavigatorOpen = useWorkbench((s) => s.setNavigatorOpen)
  const setCommandPaletteOpen = useWorkbench((s) => s.setCommandPaletteOpen)
  const navigate = useWorkbench((s) => s.navigate)
  const activateTab = useWorkbench((s) => s.activateTab)
  const closeTab = useWorkbench((s) => s.closeTab)
  const runProgram = useWorkbench((s) => s.runProgram)
  const checkProgram = useWorkbench((s) => s.checkProgram)
  const saveProgram = useWorkbench((s) => s.saveProgram)
  const openNewDialog = useWorkbench((s) => s.openNewDialog)
  const setAboutOpen = useWorkbench((s) => s.setAboutOpen)
  const setTcodeDialogOpen = useWorkbench((s) => s.setTcodeDialogOpen)
  const setSearchQuery = useWorkbench((s) => s.setSearchQuery)
  const openSyllabusTopic = useWorkbench((s) => s.openSyllabusTopic)

  const activeTab = tabs.find((t) => t.key === activeTabKey) ?? null
  const activeProgramName =
    activeTab?.kind === 'program' ? activeTab.programName : activeTab?.kind === 'output' ? activeTab.programName : null

  // ── global keyboard shortcuts ───────────────────────────────────────
  const anyDialogOpen = useWorkbench(
    (s) =>
      !!s.pendingSelection ||
      s.commandPaletteOpen ||
      s.newDialog.open ||
      !!s.confirmCreate ||
      s.aboutOpen ||
      s.tcodeDialogOpen,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+K — command palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }
      // while any modal dialog is open, dialogs own the keyboard
      // (selection screen handles F8 itself; Radix handles Escape)
      if (anyDialogOpen) return

      const target = e.target as HTMLElement | null
      const inInput = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (!activeProgramName) return

      if (e.key === 'F8') {
        e.preventDefault()
        void runProgram(activeProgramName)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveProgram(activeProgramName)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'F2') {
        e.preventDefault()
        void checkProgram(activeProgramName)
      } else if (inInput && e.key === 'Escape') {
        (target as HTMLElement).blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeProgramName, anyDialogOpen, checkProgram, runProgram, saveProgram, setCommandPaletteOpen])

  const hasTabs = tabs.length > 0

  // navigate + update the t-code shown in the status bar (SAP feel)
  const goto = (v: typeof view, tcode: string) => {
    useWorkbench.setState({ lastTcode: tcode })
    navigate(v)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#dbe5f1] text-[#1a2733]" data-app="abap-workbench">
      {/* ── title bar ── */}
      <header
        className="sap-titlebar flex h-10 shrink-0 items-center gap-3 px-3 text-white"
        role="banner"
      >
        <button
          type="button"
          className="rounded-[3px] p-1 hover:bg-white/15 lg:hidden"
          onClick={() => setNavigatorOpen(!navigatorOpen)}
          aria-label="Toggle navigator"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="select-none text-[19px] font-black tracking-tight" aria-hidden>
          SAP
        </span>
        <span className="hidden select-none text-[12.5px] font-medium text-white/90 sm:block">
          ABAP Workbench — Development Training System
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <SystemPill label="System" value="NPL" />
          <SystemPill label="Client" value="100" />
          <SystemPill label="User" value="DEVELOPER" />
        </div>
      </header>

      {/* ── menu bar ── */}
      <nav className="sap-menubar flex h-[26px] shrink-0 items-center gap-0.5 px-1.5" role="menubar" aria-label="Main menu">
        <MenuBarButton label="Program">
          <DropdownMenuItem onClick={() => openNewDialog({})}>
            <FilePlus2 className="h-3.5 w-3.5" /> New Object…
            <span className="ml-auto font-mono text-[10.5px] text-[#7b8a9c]">create</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!activeProgramName} onClick={() => activeProgramName && void checkProgram(activeProgramName)}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Check
            <span className="ml-auto font-mono text-[10.5px] text-[#7b8a9c]">Ctrl+F2</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!activeProgramName} onClick={() => activeProgramName && void saveProgram(activeProgramName)}>
            <Save className="h-3.5 w-3.5" /> Save
            <span className="ml-auto font-mono text-[10.5px] text-[#7b8a9c]">Ctrl+S</span>
          </DropdownMenuItem>
          {activeProgramName && programs[activeProgramName]?.isExample && (
            <DropdownMenuItem
              onClick={() =>
                openNewDialog({
                  prefillName: `${activeProgramName}_COPY`,
                  prefillSource: programs[activeProgramName].source,
                  prefillTitle: programs[activeProgramName].title,
                  prefillType: programs[activeProgramName].type,
                  saveAsFrom: activeProgramName,
                })
              }
            >
              <FileCode2 className="h-3.5 w-3.5" /> Save As…
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!activeProgramName} onClick={() => activeProgramName && void runProgram(activeProgramName)}>
            <Play className="h-3.5 w-3.5" /> Execute
            <span className="ml-auto font-mono text-[10.5px] text-[#7b8a9c]">F8</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!activeTabKey} onClick={() => activeTabKey && closeTab(activeTabKey)}>
            <X className="h-3.5 w-3.5" /> Close Tab
          </DropdownMenuItem>
        </MenuBarButton>

        <MenuBarButton label="Edit">
          <DropdownMenuItem disabled>
            <Undo2 className="h-3.5 w-3.5" /> Undo
            <span className="ml-auto font-mono text-[10.5px] text-[#7b8a9c]">editor</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setSearchQuery('')
              navigate('search')
            }}
          >
            <Search className="h-3.5 w-3.5" /> Find Objects…
            <span className="ml-auto font-mono text-[10.5px] text-[#7b8a9c]">Ctrl+K</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Settings className="h-3.5 w-3.5" /> Preferences
          </DropdownMenuItem>
        </MenuBarButton>

        <MenuBarButton label="Goto">
          <DropdownMenuItem onClick={() => goto('home', 'SE80')}>
            <Home className="h-3.5 w-3.5" /> SAP Easy Access
            <span className="ml-auto font-mono text-[10.5px] text-[#7b8a9c]">SE80</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { useWorkbench.setState({ lastTcode: 'SE38' }); openNewDialog({ prefillType: 'REPORT' }) }}>
            <Play className="h-3.5 w-3.5" /> ABAP Editor
            <span className="ml-auto font-mono text-[10.5px] text-[#7b8a9c]">SE38</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => goto('dictionary', 'SE11')}>
            <Database className="h-3.5 w-3.5" /> Data Dictionary
            <span className="ml-auto font-mono text-[10.5px] text-[#7b8a9c]">SE11</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => goto('browser', 'SE16')}>
            <Table2 className="h-3.5 w-3.5" /> Data Browser
            <span className="ml-auto font-mono text-[10.5px] text-[#7b8a9c]">SE16</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => goto('classes', 'SE24')}>
            <Braces className="h-3.5 w-3.5" /> Class Builder
            <span className="ml-auto font-mono text-[10.5px] text-[#7b8a9c]">SE24</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => goto('functions', 'SE37')}>
            <FunctionSquare className="h-3.5 w-3.5" /> Function Builder
            <span className="ml-auto font-mono text-[10.5px] text-[#7b8a9c]">SE37</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openSyllabusTopic(-1)}>
            <BookOpen className="h-3.5 w-3.5" /> Syllabus &amp; Learning Path
          </DropdownMenuItem>
        </MenuBarButton>

        <MenuBarButton label="System">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 text-[12.5px]">
              <Terminal className="h-3.5 w-3.5" /> Services
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="border-[#9db2cc]">
              <DropdownMenuItem
                onClick={() => {
                  setSearchQuery('')
                  goto('search', 'SEARCH')
                }}
              >
                <Search className="h-3.5 w-3.5" /> Object Search
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goto('browser', 'SE16')}>
                <Table2 className="h-3.5 w-3.5" /> Data Browser (SE16)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goto('dictionary', 'SE11')}>
                <Database className="h-3.5 w-3.5" /> Dictionary (SE11)
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => setTcodeDialogOpen(true)}>
            <Terminal className="h-3.5 w-3.5" /> Transaction Codes
            <span className="ml-auto font-mono text-[10.5px] text-[#7b8a9c]">SE93</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAboutOpen(true)}>
            <Monitor className="h-3.5 w-3.5" /> System Status…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => goto('home', 'SE80')}>
            <LogOut className="h-3.5 w-3.5" /> Log Off (returns to Easy Access)
          </DropdownMenuItem>
        </MenuBarButton>

        <MenuBarButton label="Help">
          <DropdownMenuItem onClick={() => setAboutOpen(true)}>
            <Monitor className="h-3.5 w-3.5" /> About ABAP Workbench
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTcodeDialogOpen(true)}>
            <Terminal className="h-3.5 w-3.5" /> Available Transaction Codes
          </DropdownMenuItem>
        </MenuBarButton>
      </nav>

      {/* ── toolbar + command field ── */}
      <div className="sap-toolbar flex h-[38px] shrink-0 items-center gap-1 px-2">
        <button
          type="button"
          className="sap-tool-btn"
          title="New Object…"
          onClick={() => openNewDialog({})}
          aria-label="New object"
        >
          <FilePlus2 className="h-4 w-4" />
        </button>
        <span className="mx-0.5 h-5 w-px bg-[#b8c7da]" aria-hidden />
        <button
          type="button"
          className="sap-tool-btn"
          title="Check (Ctrl+F2)"
          disabled={!activeProgramName}
          onClick={() => activeProgramName && void checkProgram(activeProgramName)}
          aria-label="Check syntax"
        >
          <CheckCircle2 className="h-4 w-4 text-green-700" />
        </button>
        <button
          type="button"
          className="sap-tool-btn"
          title="Save (Ctrl+S)"
          disabled={!activeProgramName}
          onClick={() => activeProgramName && void saveProgram(activeProgramName)}
          aria-label="Save"
        >
          <Save className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="sap-tool-btn"
          title="Execute (F8)"
          disabled={!activeProgramName}
          onClick={() => activeProgramName && void runProgram(activeProgramName)}
          aria-label="Execute"
        >
          <Play className="h-4 w-4 text-[#0a6ed1]" />
        </button>
        <span className="mx-0.5 h-5 w-px bg-[#b8c7da]" aria-hidden />
        <button
          type="button"
          className="sap-tool-btn"
          title="Search objects (Ctrl+K)"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Search objects"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`sap-tool-btn hidden lg:inline-flex ${navigatorOpen ? '!bg-[#dce9f8] !border-[#8fb0d4]' : ''}`}
          title="Toggle navigator"
          onClick={() => setNavigatorOpen(!navigatorOpen)}
          aria-label="Toggle navigator"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="ml-2 flex items-center gap-1.5">
          <CommandField />
          <span className="hidden text-[10px] text-[#7b8a9c] xl:inline">Ctrl+L</span>
        </div>

        <div className="ml-auto hidden items-center gap-1.5 text-[10.5px] text-[#5b6d80] md:flex">
          <kbd className="rounded-sm border border-[#c5d2e2] bg-white px-1 font-mono">F8</kbd>
          <span>Execute</span>
          <kbd className="ml-1 rounded-sm border border-[#c5d2e2] bg-white px-1 font-mono">Ctrl+S</kbd>
          <span>Save</span>
          <kbd className="ml-1 rounded-sm border border-[#c5d2e2] bg-white px-1 font-mono">Ctrl+K</kbd>
          <span>Search</span>
        </div>
      </div>

      {/* ── main area ── */}
      <div className="relative flex min-h-0 flex-1 gap-[3px] bg-[#c7d5e8] p-[3px]">
        {/* navigator sidebar */}
        {navigatorOpen && (
          <>
            <aside
              className="sap-sidebar absolute inset-y-0 left-0 z-30 w-[270px] shrink-0 rounded-[3px] border border-[#9db2cc] shadow-xl lg:relative lg:z-auto lg:shadow-none"
              aria-label="Navigator"
            >
              <button
                type="button"
                className="absolute -right-2 top-1/2 z-40 hidden h-6 w-4 -translate-y-1/2 items-center justify-center rounded-r-sm border border-[#9db2cc] bg-[#e4ebf4] text-[#5b6d80] hover:bg-[#dce9f8] lg:flex"
                onClick={() => setNavigatorOpen(false)}
                aria-label="Collapse navigator"
                title="Hide navigator"
              >
                <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
              </button>
              <NavigatorTree />
            </aside>
            {/* mobile backdrop */}
            <button
              type="button"
              className="absolute inset-0 z-20 bg-black/20 lg:hidden"
              onClick={() => setNavigatorOpen(false)}
              aria-label="Close navigator"
              tabIndex={-1}
            />
          </>
        )}
        {!navigatorOpen && (
          <button
            type="button"
            className="absolute left-0 top-1/2 z-20 hidden h-10 w-4 -translate-y-1/2 items-center justify-center rounded-r-sm border border-[#9db2cc] bg-[#e4ebf4] text-[#5b6d80] hover:bg-[#dce9f8] lg:flex"
            onClick={() => setNavigatorOpen(true)}
            aria-label="Show navigator"
            title="Show navigator"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-90" />
          </button>
        )}

        {/* content area */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[3px] border border-[#9db2cc] bg-white" role="main">
          {/* tab strip */}
          {hasTabs && (
            <div className="sap-tabstrip flex min-h-[30px] items-end gap-1 overflow-x-auto px-1.5 pt-1.5">
              <button
                type="button"
                className={`sap-tab shrink-0 ${view === 'home' ? 'bg-white' : ''}`}
                data-active={view === 'home'}
                onClick={() => navigate('home')}
                title="SAP Easy Access"
              >
                <Home className="h-3.5 w-3.5" />
                Easy Access
              </button>
              {tabs.map((tab) => {
                const prog = programs[tab.programName]
                const isActive = view === 'tab' && tab.key === activeTabKey
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
                    title={tab.kind === 'program' ? prog?.title || tab.programName : `Output of ${tab.programName}`}
                  >
                    {tab.kind === 'program' ? (
                      <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[#0a6ed1]" />
                    ) : (
                      <Monitor className="h-3.5 w-3.5 shrink-0 text-[#5d3a8e]" />
                    )}
                    <span className="truncate font-mono">{tab.programName}</span>
                    {tab.kind === 'output' && (
                      <span className="text-[10px] font-semibold uppercase text-[#7b8a9c]">out</span>
                    )}
                    {tab.kind === 'program' && prog?.dirty && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#f0a500]" title="unsaved changes" />
                    )}
                    <span
                      role="button"
                      tabIndex={-1}
                      className="ml-0.5 rounded-sm p-0.5 hover:bg-[#c7d8ec] hover:text-[#c4302f]"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(tab.key)
                      }}
                      aria-label={`Close ${tab.programName} tab`}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* view content */}
          <div className="min-h-0 flex-1">
            {view === 'home' && <EasyAccess />}
            {view === 'tab' &&
              (activeTab?.kind === 'program' ? (
                <EditorView programName={activeTab.programName} />
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
      <SelectionScreenDialog />
      <NewObjectDialog />
      <ConfirmCreateDialog />
      <AboutDialog />
      <TcodeRegistryDialog />
      <CommandPalette />
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}
