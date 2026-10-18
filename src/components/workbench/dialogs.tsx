'use client'

// ── Dialogs: New Object, Confirm Create, About, T-code Registry, ──────
//    Confirm Delete, Log Off, System Status (classic SAP GUI popups) ──
import { useEffect, useState } from 'react'
import { CircleHelp, FilePlus2, Info, TerminalSquare } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useWorkbench } from './use-workbench'
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
      <DialogTitle className="truncate text-[12px] font-bold text-white">{title}</DialogTitle>
      <DialogDescription className="sr-only">{description}</DialogDescription>
      <div className="ml-auto flex items-center gap-1">
        <span
          aria-hidden
          className="flex h-[16px] w-[16px] items-center justify-center text-[11px] font-bold text-[#d6e6f8]"
        >
          ?
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="sap-titlebar-close flex h-[16px] w-[16px] items-center justify-center text-[10px] leading-none text-white"
        >
          ✕
        </button>
      </div>
    </div>
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
  const openNewDialog = useWorkbench((s) => s.openNewDialog)

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
              openNewDialog({ prefillName: name })
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

// ── About dialog ──────────────────────────────────────────────────────
export function AboutDialog() {
  const open = useWorkbench((s) => s.aboutOpen)
  const setOpen = useWorkbench((s) => s.setAboutOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sap-popup max-w-[460px] gap-0 p-0 sm:max-w-[460px]">
        <SapPopupTitle
          title="About"
          description="ABAPForge — The Modern ABAP Studio"
          onClose={() => setOpen(false)}
        />
        <div className="sap-popup-body space-y-2.5 text-[12.5px] text-[#1c2b3a]">
          <div className="flex items-start gap-2.5">
            <Info className="mt-[2px] h-4 w-4 shrink-0 text-[#33475c]" aria-hidden />
            <p>
              <strong>ABAPForge</strong> — the modern ABAP studio: a free, browser-based SAP-style IDE
              for learning ABAP development, modeled on SE38/SE80/SE11/SE16/SE24/SE37.
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-8 text-[11.5px] text-[#44586c]">
            <li>Custom ABAP interpreter (procedural, ABAP Objects, Open SQL on a simulated SFLIGHT database)</li>
            <li>Classical list output with SAP color semantics and interactive ALV grids</li>
            <li>10-topic training syllabus with runnable examples, from basics to CDS &amp; RAP concepts</li>
            <li>Modern 7.40+ syntax support: VALUE, COND, REDUCE, string templates</li>
            <li>100% free and self-hostable — deploy anywhere at no cost</li>
          </ul>
          <p className="border-t border-[#cfd6dd] pt-2 text-[11.5px] text-[#5b6d80]">
            System ABF · Client 100 · User DEVELOPER · Training content: HCLTech SAP ABAP syllabus
          </p>
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
          description="System NPL (1) (750)"
          onClose={() => setOpen(false)}
        />
        <div className="sap-popup-body space-y-2 text-[12.5px] text-[#1c2b3a]">
          <div className="text-[11.5px] text-[#5b6d80]">System NPL (1) (750)</div>
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
    ['System', 'NPL'],
    ['Client', session.client],
    ['User', session.user],
    ['Language', session.language],
    ['Transaction', lastTcode],
    ['Program', program],
    ['Release', '750'],
    ['Kernel', '754 (in-browser ABAP interpreter)'],
    ['Host', 'NPLAPP01'],
    ['Database', 'HDB (simulated SFLIGHT model)'],
    ['Server', 'Node.js / Next.js runtime'],
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sap-popup max-w-[520px] gap-0 p-0 sm:max-w-[520px]">
        <SapPopupTitle
          title="System Status"
          description="NPL — SAP NetWeaver AS ABAP (training edition)"
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
