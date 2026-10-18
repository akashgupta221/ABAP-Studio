'use client'

// ── Dialogs: New Object, Confirm Create, About, T-code Registry ───────
import { useEffect, useState } from 'react'
import { CircleHelp, FilePlus2, Info, TerminalSquare } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
      <DialogContent className="max-w-[480px] border-[#7f9db9] p-0 gap-0 overflow-hidden">
        <DialogHeader className="sap-titlebar px-4 py-2 text-left">
          <DialogTitle className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <FilePlus2 className="h-4 w-4" />
            {isSaveAs ? 'Save As — new repository object' : 'Create Repository Object'}
          </DialogTitle>
          <DialogDescription className="text-[11.5px] text-[#cfe2f5]">
            {isSaveAs
              ? `Copy of ${dialog.saveAsFrom} — customer objects should start with Z or Y`
              : 'New program, class, include or function group (names starting with Z/Y are customer namespace)'}
          </DialogDescription>
        </DialogHeader>

        <div className="sap-selscreen space-y-3 p-4">
          <div className="flex items-center justify-end gap-3">
            <Label htmlFor="new-name" className="w-[110px] text-right text-[12.5px] font-medium text-[#1c2f43]">
              Object name
            </Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              placeholder="Z_MY_PROGRAM"
              className="h-[28px] w-[260px] rounded-[2px] border-[#aab8c8] bg-white font-mono text-[12.5px]"
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <Label htmlFor="new-title" className="w-[110px] text-right text-[12.5px] font-medium text-[#1c2f43]">
              Title
            </Label>
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short description"
              className="h-[28px] w-[260px] rounded-[2px] border-[#aab8c8] bg-white text-[12.5px]"
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <Label className="w-[110px] text-right text-[12.5px] font-medium text-[#1c2f43]">
              Object type
            </Label>
            <Select value={type} onValueChange={(v) => setType(v as ProgramType)}>
              <SelectTrigger className="h-[28px] w-[260px] rounded-[2px] border-[#aab8c8] bg-white font-mono text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REPORT">REPORT — executable program</SelectItem>
                <SelectItem value="CLASS">CLASS — ABAP Objects class</SelectItem>
                <SelectItem value="INCLUDE">INCLUDE — include program</SelectItem>
                <SelectItem value="FUNCTION_GROUP">FUNCTION_GROUP — function group</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Label className="w-[110px] text-right text-[12.5px] font-medium text-[#1c2f43]">
              Topic
            </Label>
            <Select value={topicId} onValueChange={setTopicId}>
              <SelectTrigger className="h-[28px] w-[260px] rounded-[2px] border-[#aab8c8] bg-white text-[12.5px]">
                <SelectValue placeholder="Assign to syllabus topic (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.srNo}. {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isSaveAs && (
            <p className="text-right text-[11px] italic text-[#5b6d80]">
              A starter template with {type === 'REPORT' ? 'REPORT' : type} skeleton will be created.
            </p>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-2 border-t border-[#b8c7da] bg-[#e8eef6] px-4 py-2.5">
          <button type="button" className="sap-btn sap-btn-primary" onClick={() => void submit()} disabled={busy || !name.trim()}>
            {busy ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <FilePlus2 className="h-3.5 w-3.5" />
            )}
            {isSaveAs ? 'Create Copy' : 'Create'}
          </button>
          <button type="button" className="sap-btn" onClick={closeNewDialog} disabled={busy}>
            Cancel
          </button>
        </DialogFooter>
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
      <DialogContent className="max-w-[420px] border-[#7f9db9] p-0 gap-0 overflow-hidden">
        <DialogHeader className="sap-titlebar px-4 py-2 text-left">
          <DialogTitle className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <CircleHelp className="h-4 w-4" />
            Object does not exist
          </DialogTitle>
          <DialogDescription className="text-[11.5px] text-[#cfe2f5]">
            Repository object not found
          </DialogDescription>
        </DialogHeader>
        <div className="bg-white p-4 text-[13px] text-[#22364b]">
          Program <span className="font-mono font-bold">{confirmCreate.name}</span> does not exist in
          the repository. Do you want to create it?
        </div>
        <DialogFooter className="flex-row items-center justify-end gap-2 border-t border-[#b8c7da] bg-[#e8eef6] px-4 py-2.5">
          <button
            type="button"
            className="sap-btn sap-btn-primary"
            onClick={() => {
              const name = confirmCreate.name
              setConfirmCreate(null)
              openNewDialog({ prefillName: name })
            }}
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Create object…
          </button>
          <button type="button" className="sap-btn" onClick={() => setConfirmCreate(null)}>
            Cancel
          </button>
        </DialogFooter>
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
      <DialogContent className="max-w-[460px] border-[#7f9db9] p-0 gap-0 overflow-hidden">
        <DialogHeader className="sap-titlebar px-4 py-2 text-left">
          <DialogTitle className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <Info className="h-4 w-4" />
            About ABAPForge
          </DialogTitle>
          <DialogDescription className="text-[11.5px] text-[#cfe2f5]">
            The Modern ABAP Studio
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5 bg-white p-4 text-[12.5px] text-[#22364b]">
          <p>
            <strong>ABAPForge</strong> — the modern ABAP studio: a free, browser-based SAP-style IDE
            for learning ABAP development, modeled on SE38/SE80/SE11/SE16/SE24/SE37.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[12px] text-[#44586c]">
            <li>Custom ABAP interpreter (procedural, ABAP Objects, Open SQL on a simulated SFLIGHT database)</li>
            <li>Classical list output with SAP color semantics and interactive ALV grids</li>
            <li>10-topic training syllabus with runnable examples, from basics to CDS &amp; RAP concepts</li>
            <li>Modern 7.40+ syntax support: VALUE, COND, REDUCE, string templates</li>
            <li>100% free and self-hostable — deploy anywhere at no cost</li>
          </ul>
          <p className="border-t border-[#e2e9f2] pt-2 text-[11.5px] text-[#7b8a9c]">
            System ABF · Client 100 · User DEVELOPER · Training content: HCLTech SAP ABAP syllabus
          </p>
        </div>
        <DialogFooter className="border-t border-[#b8c7da] bg-[#e8eef6] px-4 py-2.5">
          <button type="button" className="sap-btn sap-btn-primary" onClick={() => setOpen(false)}>
            Close
          </button>
        </DialogFooter>
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
      <DialogContent className="max-w-[520px] border-[#7f9db9] p-0 gap-0 overflow-hidden">
        <DialogHeader className="sap-titlebar px-4 py-2 text-left">
          <DialogTitle className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <TerminalSquare className="h-4 w-4" />
            Transaction Registry (SE93)
          </DialogTitle>
          <DialogDescription className="text-[11.5px] text-[#cfe2f5]">
            Available transaction codes — enter them in the command field
          </DialogDescription>
        </DialogHeader>
        <table className="w-full bg-white text-[12.5px]">
          <thead>
            <tr className="alv-grid">
              <th className="px-3 py-1.5 text-left text-[11.5px]">Transaction</th>
              <th className="px-3 py-1.5 text-left text-[11.5px]">Description</th>
            </tr>
          </thead>
          <tbody>
            {TCODE_TABLE.map((t) => (
              <tr key={t.code} className="border-b border-[#eef2f7] hover:bg-[#e7f0fb]">
                <td className="px-3 py-1.5 font-mono font-bold text-[#0a3d73]">{t.code}</td>
                <td className="px-3 py-1.5 text-[#44586c]">{t.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <DialogFooter className="border-t border-[#b8c7da] bg-[#e8eef6] px-4 py-2.5">
          <button type="button" className="sap-btn sap-btn-primary" onClick={() => setOpen(false)}>
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
