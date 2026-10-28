'use client'

// ── Dialogs: New Object, Confirm Create, About, T-code Registry, ──────
//    Confirm Delete, Log Off, System Status (classic SAP GUI popups) ──
import { useEffect, useState, type ComponentType } from 'react'
import {
  CircleHelp, Database, FilePlus2, Globe, Keyboard, Monitor, TerminalSquare, Wrench,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useWorkbench } from './use-workbench'
import { se38CreateSource } from '@/lib/program-defaults'
import type { ProgramType, Topic } from './types'

const DEFAULT_TEMPLATE = (name: string, type: ProgramType): string => {
  if (type === 'CLASS') {
    return `CLASS ${name.toLowerCase()} DEFINITION.
  PUBLIC SECTION.
    METHODS: run.
ENDCLASS.

CLASS ${name.toLowerCase()} IMPLEMENTATION.
  METHOD run.
    WRITE: / 'Hello from class ${name}'.
  ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  DATA(lo) = NEW ${name.toLowerCase()}( ).
  lo->run( ).
`
  }
  if (type === 'INCLUDE') {
    return `* Include ${name} — data definitions
DATA: gv_value TYPE i VALUE 42.
`
  }
  if (type === 'FUNCTION_GROUP') {
    return `FUNCTION-POOL ${name.toLowerCase()}.
* function group ${name}
`
  }
  return `REPORT ${name.toLowerCase()}.

WRITE: / 'Hello from ${name}'.
`
}

// ── classic SAP GUI title bar: bold white caption, [?] and [✕] ────────
function SapPopupTitle({ title, description, onClose }: {
  title: string
  description: string
  onClose: () => void
}) {
  return (
    <div className="sap-popup-title">
      <DialogTitle className="truncate text-[12px] font-bold text-[#17324a]">{title}</DialogTitle>
      <DialogDescription className="sr-only">{description}</DialogDescription>
      <div className="ml-auto flex items-center gap-1">
        <span
          aria-hidden
          className="flex h-[16px] w-[16px] items-center justify-center text-[11px] font-bold text-[#4c6b8a]"
        >
          ?
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="sap-titlebar-close flex h-[16px] w-[16px] items-center justify-center text-[10px] leading-none text-[#17324a]"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Object Directory Entry (SE38 Create → package assignment) ──────────
export function ObjectDirectoryDialog() {
  const objectDir = useWorkbench((s) => s.objectDir)
  const setObjectDir = useWorkbench((s) => s.setObjectDir)
  const createProgram = useWorkbench((s) => s.createProgram)
  const sessionUser = useWorkbench((s) => s.session.user)

  const [packageName, setPackageName] = useState('')
  const [busy, setBusy] = useState(false)
  const open = !!objectDir
  const name = objectDir?.name ?? ''

  const today = (() => {
    const d = new Date()
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}.${mm}.${d.getFullYear()}`
  })()

  const createLocalObject = async () => {
    if (!name || busy) return
    const type = objectDir?.type ?? 'REPORT'
    setBusy(true)
    try {
      await createProgram({
        name,
        title: objectDir?.title || name,
        type,
        source: se38CreateSource(name, type),
      })
    } finally {
      setBusy(false)
      setPackageName('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setObjectDir(null)}>
      <DialogContent showCloseButton={false} className="sap-popup max-w-[560px] gap-0 p-0 sm:max-w-[560px]">
        <SapPopupTitle
          title="Create Object Directory Entry"
          description={`Assign a package to program ${name}`}
          onClose={() => setObjectDir(null)}
        />

        <div className="sap-popup-body space-y-[7px] text-[12.5px] text-[#1c2b3a]">
          <div className="flex items-center gap-2">
            <span className="w-[120px] text-right text-[#33475c]">Object</span>
            <span className="flex h-[22px] w-[62px] items-center border border-[#c6d3e2] bg-[#eef2f6] px-1.5 font-mono text-[12px]">
              R3TR
            </span>
            <span className="flex h-[22px] w-[62px] items-center border border-[#c6d3e2] bg-[#eef2f6] px-1.5 font-mono text-[12px]">
              PROG
            </span>
            <span className="flex h-[22px] min-w-[160px] items-center border border-[#c6d3e2] bg-[#eef2f6] px-1.5 font-mono text-[12px]">
              {name}
            </span>
          </div>

          <div className="border-t border-[#c3cfdc] pt-2 text-[12px] font-semibold text-[#33475c]">
            Attributes
          </div>

          <div className="flex items-center gap-2">
            <span className="w-[120px] text-right text-[#1c2b3a]">Package</span>
            <input
              value={packageName}
              onChange={(e) => setPackageName(e.target.value.toUpperCase())}
              className="sap-field w-[180px] font-mono uppercase"
              placeholder=" "
              aria-label="Package"
              spellCheck={false}
            />
            <button
              type="button"
              className="flex h-[22px] w-[20px] items-center justify-center border border-[#c6d3e2] bg-[#eef3f9] text-[#33475c] hover:bg-[#dbe8f8]"
              title="Possible entries — only local objects are available"
              aria-label="Possible entries for package"
              onClick={() =>
                useWorkbench
                  .getState()
                  .addMessage('I', 'Package selection: only local objects ($TMP) are available in this training system')
              }
            >
              ▼
            </button>
            <span className="text-[11px] italic text-[#7b8a9c]">blank = local object ($TMP)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-[120px] text-right text-[#1c2b3a]">Person Responsible</span>
            <span className="flex h-[22px] w-[160px] items-center border border-[#c6d3e2] bg-[#eef2f6] px-1.5 font-mono text-[12px]">
              {sessionUser}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-[120px] text-right text-[#1c2b3a]">Original System</span>
            <span className="flex h-[22px] w-[100px] items-center border border-[#c6d3e2] bg-[#eef2f6] px-1.5 font-mono text-[12px]">
              MER
            </span>
            <span className="w-[20px]" />
            <span className="text-[#1c2b3a]">Original language</span>
            <span className="flex h-[22px] w-[100px] items-center border border-[#c6d3e2] bg-[#eef2f6] px-1.5 font-mono text-[12px]">
              EN English
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-[120px] text-right text-[#1c2b3a]">Created On</span>
            <span className="flex h-[22px] w-[120px] items-center border border-[#c6d3e2] bg-[#eef2f6] px-1.5 font-mono text-[12px]">
              {today}
            </span>
          </div>
        </div>

        <div className="sap-popup-buttons">
          <button
            type="button"
            className="sap-btn sap-btn-primary"
            onClick={() => void createLocalObject()}
            disabled={busy || !name}
            title="Create the object as a local object in package $TMP"
          >
            {busy ? 'Creating…' : 'Local Object'}
          </button>
          <button type="button" className="sap-btn" disabled title="Lock overview is not available in this training system">
            Lock Overview
          </button>
          <button type="button" className="sap-btn" onClick={() => setObjectDir(null)} title="Cancel">
            X
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── New Object ─────────────────────────────────────────────────────────
export function NewObjectDialog() {
  const dialog = useWorkbench((s) => s.newDialog)
  const closeNewDialog = useWorkbench((s) => s.closeNewDialog)
  const createProgram = useWorkbench((s) => s.createProgram)

  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ProgramType>('REPORT')
  const [topicId, setTopicId] = useState<string>('none')
  const [busy, setBusy] = useState(false)
  const [topics, setTopics] = useState<Topic[]>([])

  const open = dialog.open

  useEffect(() => {
    if (open) {
      setName(dialog.prefillName ?? '')
      setTitle(dialog.prefillTitle ?? '')
      setType(dialog.prefillType ?? 'REPORT')
      setTopicId('none')
      fetch('/api/topics')
        .then((r) => r.json())
        .then((r: { topics?: Topic[] }) => setTopics(r.topics ?? []))
        .catch(() => setTopics([]))
    }
  }, [open, dialog.prefillName, dialog.prefillTitle, dialog.prefillType])

  const isSaveAs = !!dialog.saveAsFrom

  const submit = async () => {
    const n = name.trim().toUpperCase()
    if (!n) return
    setBusy(true)
    const source = dialog.prefillSource ?? DEFAULT_TEMPLATE(n, type)
    try {
      await createProgram({
        name: n,
        title: title.trim() || (isSaveAs ? `Copy of ${dialog.saveAsFrom}` : `${type} ${n}`),
        type,
        topicId: topicId === 'none' ? null : Number(topicId),
        source,
        tags: isSaveAs ? 'copy' : '',
        description: isSaveAs ? `Copy of ${dialog.saveAsFrom}` : '',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeNewDialog()}>
      <DialogContent showCloseButton={false} className="sap-popup max-w-[480px] gap-0 p-0 sm:max-w-[480px]">
        <SapPopupTitle
          title={isSaveAs ? 'Save As — Create Object' : 'Create Object'}
          description={isSaveAs
            ? `Copy of ${dialog.saveAsFrom} — customer objects should start with Z or Y`
            : 'New program, class, include or function group (names starting with Z/Y are customer namespace)'}
          onClose={closeNewDialog}
        />

        <div className="sap-popup-body space-y-[7px] text-[12.5px] text-[#1c2b3a]">
          <div className="flex items-center justify-end gap-2">
            <label htmlFor="new-name" className="w-[110px] text-right text-[12.5px] text-[#1c2b3a]">
              Object name
            </label>
            <input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              placeholder="Z_MY_PROGRAM"
              spellCheck={false}
              className="sap-field w-[250px] font-mono uppercase"
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <label htmlFor="new-title" className="w-[110px] text-right text-[12.5px] text-[#1c2b3a]">
              Title
            </label>
            <input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short description"
              className="sap-field w-[250px]"
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <label className="w-[110px] text-right text-[12.5px] text-[#1c2b3a]">
              Object type
            </label>
            <Select value={type} onValueChange={(v) => setType(v as ProgramType)}>
              <SelectTrigger className="sap-field w-[250px] font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-[#7f9db9] bg-white shadow-md">
                <SelectItem className="rounded-none text-[12.5px]" value="REPORT">REPORT — executable program</SelectItem>
                <SelectItem className="rounded-none text-[12.5px]" value="CLASS">CLASS — ABAP Objects class</SelectItem>
                <SelectItem className="rounded-none text-[12.5px]" value="INCLUDE">INCLUDE — include program</SelectItem>
                <SelectItem className="rounded-none text-[12.5px]" value="FUNCTION_GROUP">FUNCTION_GROUP — function group</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-end gap-2">
            <label className="w-[110px] text-right text-[12.5px] text-[#1c2b3a]">
              Topic
            </label>
            <Select value={topicId} onValueChange={setTopicId}>
              <SelectTrigger className="sap-field w-[250px]">
                <SelectValue placeholder="Assign to syllabus topic (optional)" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-[#7f9db9] bg-white shadow-md">
                <SelectItem className="rounded-none text-[12.5px]" value="none">— none —</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t.id} className="rounded-none text-[12.5px]" value={String(t.id)}>
                    {t.srNo}. {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isSaveAs && (
            <div className="flex items-center justify-end gap-1.5 pt-1 text-right text-[11.5px] italic text-[#5b6d80]">
              <FilePlus2 className="h-3.5 w-3.5 shrink-0 text-[#33475c]" aria-hidden />
              <span>A starter template with {type} skeleton will be created.</span>
            </div>
          )}
        </div>

        <div className="sap-popup-buttons">
          <button type="button" className="sap-btn sap-btn-primary" onClick={() => void submit()} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : isSaveAs ? 'Create Copy' : 'Create'}
          </button>
          <button type="button" className="sap-btn" onClick={closeNewDialog} disabled={busy}>
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Confirm Create (command field, unknown object) ────────────────────
export function ConfirmCreateDialog() {
  const confirmCreate = useWorkbench((s) => s.confirmCreate)
  const setConfirmCreate = useWorkbench((s) => s.setConfirmCreate)
  const beginSe38Create = useWorkbench((s) => s.beginSe38Create)

  if (!confirmCreate) return null

  return (
    <Dialog open onOpenChange={(o) => !o && setConfirmCreate(null)}>
      <DialogContent showCloseButton={false} className="sap-popup max-w-[420px] gap-0 p-0 sm:max-w-[420px]">
        <SapPopupTitle
          title="Confirm"
          description="Repository object not found"
          onClose={() => setConfirmCreate(null)}
        />
        <div className="sap-popup-body flex items-start gap-2.5 text-[12.5px] leading-[1.45] text-[#1c2b3a]">
          <CircleHelp className="mt-[2px] h-4 w-4 shrink-0 text-[#33475c]" aria-hidden />
          <p>
            Program <span className="font-mono font-bold">{confirmCreate.name}</span> does not exist in
            the repository. Do you want to create it?
          </p>
        </div>
        <div className="sap-popup-buttons">
          <button
            type="button"
            className="sap-btn sap-btn-primary"
            onClick={() => {
              const name = confirmCreate.name
              setConfirmCreate(null)
              beginSe38Create(name)
            }}
          >
            Create object…
          </button>
          <button type="button" className="sap-btn" onClick={() => setConfirmCreate(null)}>
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── About dialog (SAP GUI version-info layout) ────────────────────────
export function AboutDialog() {
  const open = useWorkbench((s) => s.aboutOpen)
  const setOpen = useWorkbench((s) => s.setAboutOpen)
  const session = useWorkbench((s) => s.session)
  const setSystemStatusOpen = useWorkbench((s) => s.setSystemStatusOpen)
  const addMessage = useWorkbench((s) => s.addMessage)

  const rows: [string, string][] = [
    ['Component', 'ABAPForge Workbench — web edition'],
    ['Release', '1.0 (SAP GUI 7.70 look-alike)'],
    ['System', `MER (105) — Client ${session.client}`],
    ['User', session.user],
    ['File Name', 'abapforge-web'],
    ['Build', '2026.10'],
    ['Kernel', 'in-browser ABAP interpreter'],
    ['Database', 'simulated SFLIGHT / HDB'],
  ]

  const copyInfo = () => {
    const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n')
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => addMessage('S', 'System information copied to clipboard'),
        () => addMessage('E', 'Clipboard is not available in this browser'),
      )
    } else {
      addMessage('E', 'Clipboard is not available in this browser')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sap-popup max-w-[470px] gap-0 p-0 sm:max-w-[470px]">
        <SapPopupTitle
          title="About ABAPForge"
          description="Information about this ABAP Workbench"
          onClose={() => setOpen(false)}
        />
        <div className="sap-popup-body text-[12.5px] text-[#1c2b3a]">
          <h3 className="mb-3 text-[17px] font-bold leading-tight">ABAPForge Workbench</h3>
          <table className="w-full text-[12px]">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td className="w-[130px] py-[2px] pr-3 align-top text-[#44586c]">{k}:</td>
                  <td className="py-[2px] font-mono text-[11.5px] text-[#1c2b3a]">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11.5px] leading-[1.45] text-[#5b6d80]">
            A free, browser-based SAP-style ABAP IDE for learning: SE38 · SE80 · SE11 · SE16 · SE24 · SE37,
            with a custom ABAP interpreter and a runnable training syllabus.
          </p>
          <p className="mt-2 text-[11px] text-[#7b8a9c]">
            Copyright (C) 2026 ABAPForge Project · Not affiliated with SAP SE
          </p>
          <div className="mt-3 flex items-center gap-2 border-t border-[#d8dee6] pt-2.5" aria-hidden>
            <span className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-[#0a6ed1]">
              <svg viewBox="0 0 16 16" className="h-6 w-6">
                <rect x="1.5" y="2.5" width="13" height="10" fill="#fff" opacity="0.95" />
                <rect x="1.5" y="2.5" width="13" height="2.4" fill="#0a6ed1" />
                <path d="M5 9.6l2 2 4-4.4" fill="none" stroke="#1c7a1c" strokeWidth="1.6" />
              </svg>
            </span>
            <span className="text-[11px] text-[#7b8a9c]">ABAPForge — the modern ABAP studio</span>
          </div>
        </div>
        <div className="sap-popup-buttons">
          <button type="button" className="sap-btn" onClick={copyInfo}>
            Copy Info
          </button>
          <button
            type="button"
            className="sap-btn"
            onClick={() => {
              setOpen(false)
              setSystemStatusOpen(true)
            }}
          >
            System Status…
          </button>
          <button type="button" className="sap-btn sap-btn-primary" onClick={() => setOpen(false)}>
            OK
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Confirm Delete (SAP "Delete Object" popup) ────────────────────────
export function ConfirmDeleteDialog() {
  const confirmDelete = useWorkbench((s) => s.confirmDelete)
  const setConfirmDelete = useWorkbench((s) => s.setConfirmDelete)
  const deleteProgram = useWorkbench((s) => s.deleteProgram)

  if (!confirmDelete) return null

  return (
    <Dialog open onOpenChange={(o) => !o && setConfirmDelete(null)}>
      <DialogContent showCloseButton={false} className="sap-popup max-w-[440px] gap-0 p-0 sm:max-w-[440px]">
        <SapPopupTitle
          title="Delete Object"
          description="Confirm deletion"
          onClose={() => setConfirmDelete(null)}
        />
        <div className="sap-popup-body text-[12.5px] leading-[1.45] text-[#1c2b3a]">
          Object <span className="font-mono font-bold">{confirmDelete.name}</span> will be deleted from the
          repository. This cannot be undone. Delete the object?
        </div>
        <div className="sap-popup-buttons">
          <button
            type="button"
            className="sap-btn sap-btn-danger"
            onClick={() => {
              const name = confirmDelete.name
              setConfirmDelete(null)
              void deleteProgram(name)
            }}
          >
            Delete
          </button>
          <button type="button" className="sap-btn" onClick={() => setConfirmDelete(null)}>
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Log Off confirmation ──────────────────────────────────────────────
export function LogoffConfirmDialog() {
  const open = useWorkbench((s) => s.logoffConfirm)
  const setOpen = useWorkbench((s) => s.setLogoffConfirm)
  const logoff = useWorkbench((s) => s.logoff)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sap-popup max-w-[430px] gap-0 p-0 sm:max-w-[430px]">
        <SapPopupTitle
          title="Log Off"
          description="System MER (105)"
          onClose={() => setOpen(false)}
        />
        <div className="sap-popup-body space-y-2 text-[12.5px] text-[#1c2b3a]">
          <div className="text-[11.5px] text-[#5b6d80]">System MER (105)</div>
          <p>Data that was not saved will be lost. Do you want to log off from the system?</p>
        </div>
        <div className="sap-popup-buttons">
          <button
            type="button"
            className="sap-btn sap-btn-primary"
            onClick={() => {
              setOpen(false)
              logoff()
            }}
          >
            Log Off
          </button>
          <button type="button" className="sap-btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── System Status (System ▸ Status…) ──────────────────────────────────
export function SystemStatusDialog() {
  const open = useWorkbench((s) => s.systemStatusOpen)
  const setOpen = useWorkbench((s) => s.setSystemStatusOpen)
  const session = useWorkbench((s) => s.session)
  const lastTcode = useWorkbench((s) => s.lastTcode)
  const view = useWorkbench((s) => s.view)
  const tabs = useWorkbench((s) => s.tabs)
  const activeTabKey = useWorkbench((s) => s.activeTabKey)

  const active = tabs.find((t) => t.key === activeTabKey) ?? null
  const program = view === 'tab' && active ? active.programName : '—'

  const rows: [string, string][] = [
    ['SAP GUI', 'SAP GUI 7.70 (64-bit) — web edition'],
    ['System', 'MER'],
    ['Client', session.client],
    ['User', session.user],
    ['Language', session.language],
    ['Transaction', lastTcode],
    ['Program', program],
    ['Release', '750'],
    ['Kernel', '754 (in-browser ABAP interpreter)'],
    ['Host', 'MERAPP01'],
    ['Database', 'HDB (simulated SFLIGHT model)'],
    ['Server', 'Node.js / Next.js runtime'],
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sap-popup max-w-[520px] gap-0 p-0 sm:max-w-[520px]">
        <SapPopupTitle
          title="System Status"
          description="MER — SAP NetWeaver AS ABAP (training edition)"
          onClose={() => setOpen(false)}
        />
        <div className="sap-popup-body">
          <table className="w-full border border-[#c3cfdc] bg-white text-[11.5px]">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td className="w-[130px] border-r border-b border-[#e3eaf2] bg-[#f4f7fa] px-2 py-[3px] font-medium text-[#3f5468]">{k}</td>
                  <td className="border-b border-[#e3eaf2] px-2 py-[3px] font-mono text-[#1c2b3a]">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sap-popup-buttons">
          <button type="button" className="sap-btn sap-btn-primary" onClick={() => setOpen(false)}>
            OK
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── SAP GUI for HTML settings (real options only) ─────────────────────
type SettingsSection = 'interaction' | 'visualization' | 'local' | 'services' | 'tools'

const SETTINGS_SECTIONS: {
  id: SettingsSection
  label: string
  icon: ComponentType<{ className?: string }>
}[] = [
  { id: 'interaction', label: 'Interaction Design', icon: Keyboard },
  { id: 'visualization', label: 'Visualization', icon: Monitor },
  { id: 'local', label: 'Local Data', icon: Database },
  { id: 'services', label: 'Front-End Services', icon: Globe },
  { id: 'tools', label: 'Tools', icon: Wrench },
]

const FONT_CHOICES: { value: number; label: string }[] = [
  { value: 12, label: 'Small' },
  { value: 13, label: 'Medium (default)' },
  { value: 14, label: 'Large' },
]

export function GuiSettingsDialog() {
  const open = useWorkbench((s) => s.settingsOpen)
  const setOpen = useWorkbench((s) => s.setSettingsOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {open && <GuiSettingsBody onClose={() => setOpen(false)} />}
    </Dialog>
  )
}

function GuiSettingsBody({ onClose }: { onClose: () => void }) {
  const editorFontSize = useWorkbench((s) => s.editorFontSize)
  const setEditorFontSize = useWorkbench((s) => s.setEditorFontSize)
  const systemInfoVisible = useWorkbench((s) => s.systemInfoVisible)
  const toggleSystemInfo = useWorkbench((s) => s.toggleSystemInfo)
  const session = useWorkbench((s) => s.session)
  const addMessage = useWorkbench((s) => s.addMessage)
  const setSystemStatusOpen = useWorkbench((s) => s.setSystemStatusOpen)

  const [section, setSection] = useState<SettingsSection>('visualization')
  const [draftFont, setDraftFont] = useState(editorFontSize)
  const [draftSystemInfo, setDraftSystemInfo] = useState(systemInfoVisible)

  const save = () => {
    setEditorFontSize(draftFont)
    if (draftSystemInfo !== systemInfoVisible) toggleSystemInfo()
    onClose()
    addMessage('S', 'SAP GUI settings saved')
  }

  const resetDraft = () => {
    setDraftFont(editorFontSize)
    setDraftSystemInfo(systemInfoVisible)
  }

  const restoreDefaults = () => {
    setDraftFont(13)
    setDraftSystemInfo(true)
  }

  return (
      <DialogContent
        showCloseButton={false}
        className="sap-popup max-w-[720px] gap-0 p-0 sm:max-w-[720px]"
        aria-label="SAP GUI for HTML Settings"
      >
        <SapPopupTitle
          title="SAP GUI for HTML Settings"
          description="Adjust the look and behaviour of the SAP GUI for HTML session"
          onClose={onClose}
        />

        <div className="grid min-h-[350px] grid-cols-[188px_minmax(0,1fr)]">
          <nav className="border-r border-[#c6d7e6] bg-[#f4f8fc] p-1.5" aria-label="Settings sections">
            {SETTINGS_SECTIONS.map((item) => {
              const Icon = item.icon
              const active = section === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setSection(item.id)}
                  className={`mb-0.5 flex w-full items-center gap-2 rounded-[2px] border px-2 py-[6px] text-left text-[12px] ${
                    active
                      ? 'border-[#8fb0d4] bg-[#cfe3f8] font-semibold text-[#0a2f57]'
                      : 'border-transparent text-[#284d74] hover:border-[#d5e2ef] hover:bg-[#e8f1fa]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="sap-popup-body min-w-0">
            {section === 'visualization' && (
              <div>
                <h2 className="text-[13px] font-bold text-[#17324a]">Visualization</h2>
                <p className="mt-0.5 text-[11.5px] text-[#55677a]">
                  These options apply to this browser session only.
                </p>

                <fieldset className="mt-4">
                  <legend className="mb-1.5 text-[12px] font-semibold text-[#17324a]">
                    ABAP editor font size
                  </legend>
                  <div className="space-y-1">
                    {FONT_CHOICES.map((choice) => (
                      <label
                        key={choice.value}
                        className="flex cursor-pointer items-center gap-2 text-[12px] text-[#17324a]"
                      >
                        <input
                          type="radio"
                          className="sap-radio"
                          name="gui-font-size"
                          value={choice.value}
                          checked={draftFont === choice.value}
                          onChange={() => setDraftFont(choice.value)}
                        />
                        {choice.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-3 border border-[#c6d7e6] bg-[#f7fafd]">
                  <div className="border-b border-[#dce6f0] px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#55677a]">
                    Preview
                  </div>
                  <pre
                    className="overflow-x-auto px-2 py-2 font-mono text-[#17324a]"
                    style={{ fontSize: draftFont }}
                  >
{`REPORT z_demo.
WRITE: / 'Hello, ABAP!'.`}
                  </pre>
                </div>

                <label className="mt-4 flex cursor-pointer items-center gap-2 text-[12px] text-[#17324a]">
                  <input
                    type="checkbox"
                    className="sap-checkbox"
                    checked={draftSystemInfo}
                    onChange={(e) => setDraftSystemInfo(e.target.checked)}
                  />
                  Display system information in the status bar
                </label>
              </div>
            )}

            {section === 'interaction' && (
              <div>
                <h2 className="text-[13px] font-bold text-[#17324a]">Interaction Design</h2>
                <p className="mt-1 text-[12px] leading-[1.55] text-[#44586c]">
                  Keyboard behaviour is fixed in this training system. The active shortcuts are:
                </p>
                <table className="mt-2 w-full border border-[#c6d7e6] text-[11.5px]">
                  <tbody>
                    {[
                      ['F3', 'Back'],
                      ['Shift+F3', 'Exit to SAP Easy Access'],
                      ['F8', 'Execute'],
                      ['Ctrl+F2', 'Check'],
                      ['Ctrl+S', 'Save'],
                      ['Ctrl+K', 'Find object'],
                      ['Ctrl+L', 'Focus the command field'],
                    ].map(([key, action]) => (
                      <tr key={key}>
                        <td className="w-[120px] border-b border-[#eef3f8] bg-[#f7fafd] px-2 py-[3px] font-mono font-semibold text-[#284d74]">
                          {key}
                        </td>
                        <td className="border-b border-[#eef3f8] px-2 py-[3px] text-[#17324a]">{action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {section === 'local' && (
              <div>
                <h2 className="text-[13px] font-bold text-[#17324a]">Local Data</h2>
                <p className="mt-1 text-[12px] leading-[1.55] text-[#44586c]">
                  The current session is stored locally in this browser. Logging off clears the
                  session; repository objects remain on the server.
                </p>
                <dl className="mt-3 grid grid-cols-[110px_minmax(0,1fr)] gap-x-2 gap-y-[5px] text-[12px]">
                  <dt className="text-right text-[#55677a]">System</dt>
                  <dd className="font-mono text-[#17324a]">MER</dd>
                  <dt className="text-right text-[#55677a]">Client</dt>
                  <dd className="font-mono text-[#17324a]">{session.client}</dd>
                  <dt className="text-right text-[#55677a]">User</dt>
                  <dd className="font-mono text-[#17324a]">{session.user}</dd>
                  <dt className="text-right text-[#55677a]">Language</dt>
                  <dd className="font-mono text-[#17324a]">{session.language}</dd>
                </dl>
              </div>
            )}

            {section === 'services' && (
              <div>
                <h2 className="text-[13px] font-bold text-[#17324a]">Front-End Services</h2>
                <p className="mt-1 text-[12px] leading-[1.55] text-[#44586c]">
                  No front-end services require configuration in this training system. Printing
                  uses the browser print dialog; file upload and download are handled by the
                  standard browser controls.
                </p>
              </div>
            )}

            {section === 'tools' && (
              <div>
                <h2 className="text-[13px] font-bold text-[#17324a]">Tools</h2>
                <p className="mt-1 text-[12px] leading-[1.55] text-[#44586c]">
                  The command field keeps a short history for this browser tab. The current
                  session details are available in System Status.
                </p>
                <button
                  type="button"
                  className="sap-btn mt-3"
                  onClick={() => {
                    onClose()
                    setSystemStatusOpen(true)
                  }}
                >
                  Open System Status…
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="sap-popup-buttons">
          <button type="button" className="sap-btn sap-btn-primary" onClick={save}>
            Save
          </button>
          <button type="button" className="sap-btn" onClick={resetDraft}>
            Reset
          </button>
          <button type="button" className="sap-btn" onClick={restoreDefaults}>
            Restore Default Settings
          </button>
          <button type="button" className="sap-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </DialogContent>
  )
}

// ── Transaction registry (SE93) ───────────────────────────────────────
const TCODE_TABLE: { code: string; desc: string; view: string }[] = [
  { code: 'SE38', desc: 'ABAP Editor — create, edit and execute programs', view: 'editor' },
  { code: 'SE80', desc: 'Object Navigator — repository browser and workbench', view: 'home' },
  { code: 'SE11', desc: 'ABAP Data Dictionary — tables and field catalogs', view: 'dictionary' },
  { code: 'SE16', desc: 'Data Browser — display table contents (SE16 <table>)', view: 'browser' },
  { code: 'SE24', desc: 'Class Builder — ABAP Objects classes', view: 'classes' },
  { code: 'SE37', desc: 'Function Builder — function modules', view: 'functions' },
  { code: 'SE93', desc: 'Transaction registry — this list', view: 'registry' },
  { code: 'SLG1', desc: 'Application log — recent executions (Easy Access)', view: 'home' },
  { code: 'SEARCH', desc: 'Global object search — SEARCH <text>', view: 'search' },
]

export function TcodeRegistryDialog() {
  const open = useWorkbench((s) => s.tcodeDialogOpen)
  const setOpen = useWorkbench((s) => s.setTcodeDialogOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sap-popup max-w-[520px] gap-0 p-0 sm:max-w-[520px]">
        <SapPopupTitle
          title="Transaction Codes (SE93)"
          description="Available transaction codes — enter them in the command field"
          onClose={() => setOpen(false)}
        />
        <div className="sap-popup-body space-y-2">
          <div className="flex items-center gap-2 text-[12px] text-[#44586c]">
            <TerminalSquare className="h-4 w-4 shrink-0 text-[#33475c]" aria-hidden />
            Available transaction codes — enter them in the command field
          </div>
          <table className="w-full border border-[#c3cfdc] bg-white text-[12px]">
            <thead>
              <tr className="alv-grid">
                <th className="px-2 py-[3px] text-left text-[11.5px]">Transaction</th>
                <th className="px-2 py-[3px] text-left text-[11.5px]">Description</th>
              </tr>
            </thead>
            <tbody>
              {TCODE_TABLE.map((t) => (
                <tr key={t.code} className="hover:bg-[#e7f0fb]">
                  <td className="border-b border-[#e3eaf2] px-2 py-[3px] font-mono font-bold text-[#0a3d73]">{t.code}</td>
                  <td className="border-b border-[#e3eaf2] px-2 py-[3px] text-[#44586c]">{t.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sap-popup-buttons">
          <button type="button" className="sap-btn sap-btn-primary" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
