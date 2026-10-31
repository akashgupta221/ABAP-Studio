'use client'

// ── Signed-in dashboard ────────────────────────────────────────────────
// Modern home surface: collapsible sidebar, topbar with quick actions,
// live stats from the real APIs, a program table with edit/delete, the
// curriculum overview and honest empty states. The SAP workbench itself
// stays untouched at /workbench — this surface links into it.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BookOpen, Boxes, ChevronDown, ChevronRight, ChevronUp, Clock, FileCode2, FolderOpen, GraduationCap,
  LayoutDashboard, LogOut, Menu, PanelsTopLeft, Pencil, Play, Plus, RefreshCw,
  Search, Table2, Trash2, User, Wrench, X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { UserButton } from '@clerk/nextjs'
import { useToast } from '@/hooks/use-toast'
import { signOutClerkClient } from '@/lib/clerk-client'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ── types (mirror the API responses) ───────────────────────────────────

interface ProgramRow {
  id: string
  name: string
  title: string
  description: string
  type: string
  paradigm: string
  isExample: boolean
  executions: number
  ownerUsername: string | null
  updatedAt: string
  createdAt: string
}

interface TopicRow {
  id: number
  srNo: number
  code: string
  title: string
  summary: string
  category: string
  paradigm: string
  exampleCount: number
}

interface RecentRun {
  id: string
  programName: string
  createdAt: string
}

type View = 'overview' | 'programs' | 'curriculum' | 'recent'

const PROGRAM_TYPES = ['REPORT', 'CLASS', 'INCLUDE', 'FUNCTION_GROUP'] as const

// ── small helpers ──────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return ''
  }
}

const TYPE_STYLES: Record<string, string> = {
  REPORT: 'bg-[#e8f1fa] text-[#0a4d8c] border-[#c9def2]',
  CLASS: 'bg-[#f3ecfa] text-[#6a3fa0] border-[#ddc9f0]',
  INCLUDE: 'bg-[#eaf5ea] text-[#1c7a1c] border-[#c2e3c4]',
  FUNCTION_GROUP: 'bg-[#fdf4e7] text-[#8a4a06] border-[#f0dcbc]',
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
        TYPE_STYLES[type] ?? 'border-[#e1e9f1] bg-[#f4f7fa] text-[#5b6d80]'
      }`}
    >
      {type}
    </span>
  )
}

// ── data hook ──────────────────────────────────────────────────────────

interface DashboardData {
  mine: ProgramRow[]
  examples: ProgramRow[]
  topics: TopicRow[]
  recents: RecentRun[]
  modernCount: number | null
}

function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setError(false)
    try {
      const [progsRes, topicsRes, recentsRes, modernRes] = await Promise.all([
        fetch('/api/programs', { cache: 'no-store' }),
        fetch('/api/topics', { cache: 'no-store' }),
        fetch('/api/recents', { cache: 'no-store' }),
        fetch('/api/modern', { cache: 'no-store' }),
      ])
      if (!progsRes.ok || !topicsRes.ok || !recentsRes.ok) throw new Error('fetch failed')
      const progs = (await progsRes.json()) as { programs: ProgramRow[] }
      const topics = (await topicsRes.json()) as { topics: TopicRow[] }
      const recents = (await recentsRes.json()) as { recents: RecentRun[] }
      let modernCount: number | null = null
      if (modernRes.ok) {
        const modern = (await modernRes.json()) as { programs: ProgramRow[] }
        modernCount = modern.programs.length
      }
      const mine = progs.programs.filter((p) => !p.isExample)
      const examples = progs.programs.filter((p) => p.isExample)
      setData({ mine, examples, topics: topics.topics, recents: recents.recents.slice(0, 12), modernCount })
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, error, loading, refresh }
}

// ── new program dialog ─────────────────────────────────────────────────

const NAME_RE = /^[A-Za-z_/][A-Za-z0-9_/%$#]*$/

function NewProgramDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (name: string) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [type, setType] = useState<string>('REPORT')
  const [paradigm, setParadigm] = useState<string>('BOTH')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const reset = () => {
    setName('')
    setTitle('')
    setType('REPORT')
    setParadigm('BOTH')
    setFormError('')
  }

  const submit = async () => {
    setFormError('')
    const upper = name.trim().toUpperCase()
    if (!NAME_RE.test(upper)) {
      setFormError('Use letters, digits and underscore — starting with Z is the customer namespace convention.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: upper, title: title.trim(), type, paradigm }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setFormError(body.error ?? 'The object could not be created.')
        return
      }
      toast({ title: `${upper} created`, description: 'Opening it in the workbench…' })
      onOpenChange(false)
      reset()
      onCreated(upper)
    } catch {
      setFormError('Could not reach the server — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) setFormError('')
      }}
    >
      <DialogContent className="sm:max-w-[480px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-[#16283b]">Create a new program</DialogTitle>
          <DialogDescription className="text-[13px] text-[#5b6d80]">
            The object is created in your private repository. A starter source template is opened
            in the SE38 editor.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="np-name" className="text-[12.5px] font-semibold text-[#16283b]">
              Object name
            </Label>
            <Input
              id="np-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Z_MY_FIRST_REPORT"
              className="font-mono text-[13px] uppercase"
              autoFocus
              required
              maxLength={40}
            />
            <p className="text-[11.5px] text-[#5b6d80]">Letters, digits, underscore. Max 40 characters.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-title" className="text-[12.5px] font-semibold text-[#16283b]">
              Title <span className="font-normal text-[#5b6d80]">(optional)</span>
            </Label>
            <Input
              id="np-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My first sales report"
              maxLength={300}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-type" className="text-[12.5px] font-semibold text-[#16283b]">
                Type
              </Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="np-type" aria-label="Program type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-paradigm" className="text-[12.5px] font-semibold text-[#16283b]">
                Paradigm
              </Label>
              <Select value={paradigm} onValueChange={setParadigm}>
                <SelectTrigger id="np-paradigm" aria-label="Programming paradigm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POP">POP — procedural</SelectItem>
                  <SelectItem value="OOP">OOP — classes</SelectItem>
                  <SelectItem value="BOTH">BOTH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formError && (
            <p role="alert" className="rounded-lg border border-[#f0d2cf] bg-[#fdf1f0] px-3 py-2 text-[12.5px] text-[#c0392b]">
              {formError}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="rounded-lg bg-[#0a6ed1] hover:bg-[#0a4d8c]">
              {busy ? 'Creating…' : 'Create program'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── edit details dialog ────────────────────────────────────────────────

function EditProgramDialog({
  program, onOpenChange, onSaved,
}: {
  program: ProgramRow | null
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (program) {
      setTitle(program.title)
      setDescription(program.description)
      setFormError('')
    }
  }, [program])

  if (!program) return null

  const submit = async () => {
    setBusy(true)
    setFormError('')
    try {
      const res = await fetch(`/api/programs/${program.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setFormError(body.error ?? 'The change could not be saved.')
        return
      }
      toast({ title: `${program.name} updated` })
      onOpenChange(false)
      onSaved()
    } catch {
      setFormError('Could not reach the server — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!program} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-[#16283b]">
            Edit details — <span className="font-mono">{program.name}</span>
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[#5b6d80]">
            The object name is fixed once created; title and description can change any time.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ep-title" className="text-[12.5px] font-semibold text-[#16283b]">
              Title
            </Label>
            <Input id="ep-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-desc" className="text-[12.5px] font-semibold text-[#16283b]">
              Description
            </Label>
            <textarea
              id="ep-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full rounded-lg border border-[#c9d4e0] bg-white px-3 py-2 text-[13px] text-[#16283b] outline-none focus:border-[#0a6ed1] focus:ring-2 focus:ring-[#0a6ed1]/20"
            />
          </div>
          {formError && (
            <p role="alert" className="rounded-lg border border-[#f0d2cf] bg-[#fdf1f0] px-3 py-2 text-[12.5px] text-[#c0392b]">
              {formError}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="rounded-lg bg-[#0a6ed1] hover:bg-[#0a4d8c]">
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── program table ──────────────────────────────────────────────────────

type SortKey = 'name' | 'type' | 'executions' | 'updatedAt'
const SORTERS: Record<SortKey, (p: ProgramRow) => string | number> = {
  name: (p) => p.name,
  type: (p) => p.type,
  executions: (p) => p.executions,
  updatedAt: (p) => new Date(p.updatedAt).getTime(),
}

function ProgramTable({
  programs, onEdit, onDelete, emptyAction,
}: {
  programs: ProgramRow[]
  onEdit: (p: ProgramRow) => void
  onDelete: (p: ProgramRow) => void
  emptyAction?: React.ReactNode
}) {
  // ALV-style sortable columns (real sorting, like the SAP Grid's column headers)
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = useMemo(() => {
    const rows = [...programs].sort((a, b) => {
      const av = SORTERS[sortKey](a)
      const bv = SORTERS[sortKey](b)
      const cmp = typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv)
        : Number(av) - Number(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [programs, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'updatedAt' || key === 'executions' ? 'desc' : 'asc')
    }
  }

  if (programs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#c9d4e0] bg-white px-6 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f1fa] text-[#0a4d8c]">
          <FileCode2 className="h-6 w-6" />
        </span>
        <p className="mt-4 text-[15px] font-bold text-[#16283b]">No programs yet</p>
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-[#5b6d80]">
          Your repository is empty. Create your first program — the SE38 editor opens with a
          starter template you can run immediately.
        </p>
        {emptyAction && <div className="mt-5">{emptyAction}</div>}
      </div>
    )
  }

  const arrowFor = (key: SortKey) =>
    sortKey === key ? (
      sortDir === 'asc'
        ? <ChevronUp className="h-3 w-3 text-[#0a6ed1]" aria-hidden />
        : <ChevronDown className="h-3 w-3 text-[#0a6ed1]" aria-hidden />
    ) : null

  const thButton = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className={`inline-flex items-center gap-1 rounded font-mono text-[9.5px] uppercase tracking-[0.13em] text-[#5b6d80] transition-colors hover:text-[#0a4d8c] ${align === 'right' ? 'flex-row-reverse' : ''}`}
      aria-label={`Sort by ${label}`}
    >
      {label}
      {arrowFor(key)}
    </button>
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-[#c9d4e0] bg-white shadow-sm">
      {/* ALV application toolbar */}
      <div className="flex items-center gap-2 border-b border-[#c9d4e0] bg-[#e8f1fa] px-3.5 py-2">
        <Table2 className="h-3.5 w-3.5 text-[#0a4d8c]" aria-hidden />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-[#0a4d8c]">
          ALV Grid — My Programs
        </span>
        <span className="rounded border border-[#c9def2] bg-white px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tabular-nums text-[#0a4d8c]">
          {programs.length}
        </span>
        <span className="ml-auto hidden font-mono text-[9px] uppercase tracking-[0.12em] text-[#5b6d80] sm:inline">
          Click a column to sort
        </span>
      </div>
      <div
        tabIndex={0}
        aria-label="My programs list"
        className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-[#0a6ed1]/40"
      >
        <table className="w-full min-w-[640px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-[#c9d4e0] bg-[#f0f5fa]">
              <th scope="col" className="px-4 py-2.5">{thButton('name', 'Program')}</th>
              <th scope="col" className="px-4 py-2.5">{thButton('type', 'Type')}</th>
              <th scope="col" className="px-4 py-2.5">{thButton('executions', 'Runs')}</th>
              <th scope="col" className="px-4 py-2.5">{thButton('updatedAt', 'Last updated')}</th>
              <th scope="col" className="px-4 py-2.5 text-right font-mono text-[9.5px] uppercase tracking-[0.13em] text-[#5b6d80]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-b border-[#e4ecf4] transition-colors last:border-0 hover:bg-[#e8f1fa]/50">
                <td className="max-w-[260px] px-4 py-2.5">
                  <p className="truncate font-mono text-[12.5px] font-semibold text-[#16283b]">{p.name}</p>
                  {p.title && <p className="truncate text-[12px] text-[#5b6d80]">{p.title}</p>}
                </td>
                <td className="px-4 py-2.5"><TypeBadge type={p.type} /></td>
                <td className="px-4 py-2.5 text-[12.5px] tabular-nums text-[#5b6d80]">{p.executions}</td>
                <td className="px-4 py-2.5 text-[12.5px] text-[#5b6d80]">{timeAgo(p.updatedAt)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/workbench?program=${encodeURIComponent(p.name)}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-[#0a6ed1] hover:bg-[#e8f1fa]"
                      aria-label={`Open ${p.name}`}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-[#3d5068] hover:bg-[#f4f7fa]"
                      aria-label={`Edit details of ${p.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(p)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-[#c0392b] hover:bg-[#fdf1f0]"
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── stat card ──────────────────────────────────────────────────────────

const TONES = {
  blue: {
    chip: 'bg-gradient-to-br from-[#0a6ed1] to-[#0a4d8c] text-white shadow-[0_6px_14px_-6px_rgba(10,110,209,0.6)]',
    hairline: 'from-[#0a6ed1]/60 via-[#22b8cf]/40 to-transparent',
  },
  violet: {
    chip: 'bg-gradient-to-br from-[#6a3fa0] to-[#472a6e] text-white shadow-[0_6px_14px_-6px_rgba(106,63,160,0.6)]',
    hairline: 'from-[#6a3fa0]/60 via-[#a78bd4]/40 to-transparent',
  },
  emerald: {
    chip: 'bg-gradient-to-br from-[#1c9a53] to-[#136e3b] text-white shadow-[0_6px_14px_-6px_rgba(28,154,83,0.6)]',
    hairline: 'from-[#1c9a53]/60 via-[#6fd39a]/40 to-transparent',
  },
  amber: {
    chip: 'bg-gradient-to-br from-[#b0600b] to-[#7d4406] text-white shadow-[0_6px_14px_-6px_rgba(176,96,11,0.6)]',
    hairline: 'from-[#b0600b]/60 via-[#e0a45c]/40 to-transparent',
  },
} as const

type Tone = keyof typeof TONES

function StatCard({
  icon: Icon, label, value, hint, testid, tone = 'blue',
}: {
  icon: typeof FileCode2
  label: string
  value: string | number
  hint?: string
  testid?: string
  tone?: Tone
}) {
  const t = TONES[tone]
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#e1e9f1] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div aria-hidden className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${t.hairline}`} />
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.chip}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <p data-testid={testid} className="mt-3.5 text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-[#16283b]">
        {value}
      </p>
      <p className="mt-1.5 text-[12.5px] font-medium text-[#3d5068]">{label}</p>
      {hint && <p className="mt-0.5 text-[11.5px] text-[#5b6d80]">{hint}</p>}
    </div>
  )
}

// ── 7-day activity strip (real data from /api/recents) ────────────────

function ActivityStrip({ recents }: { recents: RecentRun[] }) {
  const days = useMemo(() => {
    const buckets: { key: string; label: string; count: number }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      buckets.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
        count: 0,
      })
    }
    for (const r of recents) {
      const key = new Date(r.createdAt)
      const local = new Date(key.getFullYear(), key.getMonth(), key.getDate())
      const bucket = buckets.find((b) => b.key === local.toISOString().slice(0, 10))
      if (bucket) bucket.count += 1
    }
    return buckets
  }, [recents])

  const max = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#e1e9f1] bg-white p-5 shadow-sm">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#22b8cf]/60 via-[#0a6ed1]/40 to-transparent" />
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13.5px] font-bold text-[#16283b]">Executions, last 7 days</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#5b6d80]">
          {total} run{total === 1 ? '' : 's'}
        </p>
      </div>
      <div
        role="img"
        aria-label={`Executions per day over the last 7 days, ${total} total`}
        className="mt-4 flex h-20 items-end gap-2"
      >
        {days.map((d) => (
          <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex h-full w-full items-end">
              <div
                className={`w-full rounded-t-md transition-all ${
                  d.count > 0
                    ? 'bg-gradient-to-t from-[#0a4d8c] to-[#22b8cf]'
                    : 'bg-[#eef3f8]'
                }`}
                style={{ height: `${Math.max(d.count > 0 ? 12 : 4, (d.count / max) * 100)}%` }}
                title={`${d.count} run${d.count === 1 ? '' : 's'}`}
              />
            </div>
            <span className="font-mono text-[9px] uppercase text-[#5b6d80]">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── main app ───────────────────────────────────────────────────────────

const NAV: { key: View; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'programs', label: 'My Programs', icon: FileCode2 },
  { key: 'curriculum', label: 'Curriculum', icon: GraduationCap },
  { key: 'recent', label: 'Recent activity', icon: Clock },
]

export function DashboardApp({
  username, role, owner,
}: {
  username: string
  role: string
  owner: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { data, error, loading, refresh } = useDashboardData()

  const [view, setView] = useState<View>('overview')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ProgramRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProgramRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const filteredMine = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    const sorted = [...data.mine].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    if (!q) return sorted
    return sorted.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    )
  }, [data, search])

  const doLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      await signOutClerkClient()
      window.location.assign('/')
    } catch {
      toast({ title: 'Log out failed', description: 'Could not reach the server — try again.', variant: 'destructive' })
      setLoggingOut(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      const res = await fetch(`/api/programs/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        toast({
          title: 'Delete failed',
          description: body.error ?? 'The object could not be deleted.',
          variant: 'destructive',
        })
        return
      }
      toast({ title: `${deleteTarget.name} deleted`, description: 'The object was removed from your repository.' })
      setDeleteTarget(null)
      void refresh()
    } catch {
      toast({ title: 'Delete failed', description: 'Could not reach the server — try again.', variant: 'destructive' })
    } finally {
      setDeleteBusy(false)
    }
  }

  const onCreated = (name: string) => {
    void refresh()
    router.push(`/workbench?program=${encodeURIComponent(name)}`)
  }

  const hour = new Date().getHours()
  const dayPart = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const sidebar = (mobile = false) => (
    <div className={`flex h-full flex-col ${mobile ? 'w-64' : collapsed ? 'w-[68px]' : 'w-64'} transition-[width] duration-200`}>
      <div className="flex h-16 items-center gap-2.5 border-b border-[#123a63] px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <BrandMark size={30} />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[14.5px] font-bold leading-tight text-white">ABAP Atelier</span>
              <span className="block font-mono text-[8px] uppercase tracking-[0.15em] text-[#7ba3cc]">
                Client 105
              </span>
            </span>
          )}
        </Link>
        {mobile && (
          <button
            type="button"
            onClick={() => setMobileNav(false)}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-[#a8c4e4] hover:bg-white/10"
            aria-label="Close navigation"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        )}
      </div>

      <nav aria-label="Dashboard" className="flex-1 space-y-1 overflow-y-auto p-3" tabIndex={0}>
        {NAV.map((item) => {
          const active = view === item.key
          const count =
            data && item.key === 'programs'
              ? data.mine.length
              : data && item.key === 'curriculum'
                ? data.topics.length
                : null
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setView(item.key)
                setMobileNav(false)
              }}
              title={collapsed ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
              className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium transition-colors ${
                active
                  ? 'bg-gradient-to-r from-[#0a6ed1] to-[#0a4d8c] text-white shadow-[0_6px_16px_-8px_rgba(10,110,209,0.8)]'
                  : 'text-[#a8c4e4] hover:bg-white/5 hover:text-white'
              } ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && item.label}
              {!collapsed && count !== null && count > 0 && (
                <span
                  className={`ml-auto rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-bold tabular-nums ${
                    active ? 'bg-white/20 text-white' : 'bg-white/10 text-[#a8c4e4]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}

        <div className="my-3 border-t border-[#123a63]" role="separator" />

        <Link
          href="/workbench"
          onClick={() => setMobileNav(false)}
          title={collapsed ? 'Open Workbench' : undefined}
          className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-semibold text-[#6cb6f5] transition-colors hover:bg-white/5 ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <Wrench className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && 'Open Workbench'}
        </Link>
        <Link
          href="/workbench?tcode=MODERN"
          onClick={() => setMobileNav(false)}
          title={collapsed ? 'Modern ABAP' : undefined}
          className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium text-[#a8c4e4] transition-colors hover:bg-white/5 hover:text-white ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <Boxes className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && 'Modern ABAP'}
        </Link>
        {owner && (
          <Link
            href="/admin"
            onClick={() => setMobileNav(false)}
            title={collapsed ? 'Administration' : undefined}
            className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium text-[#a8c4e4] transition-colors hover:bg-white/5 hover:text-white ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <Wrench className="h-4.5 w-4.5 shrink-0 hidden" />
            <PanelsTopLeft className="h-4.5 w-4.5 shrink-0" />
            {!collapsed && 'Administration'}
          </Link>
        )}
      </nav>

      <div className="border-t border-[#123a63] p-3">
        {!collapsed && (
          <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0a6ed1] text-[12px] font-bold text-white">
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-[12px] font-semibold text-white">{username}</p>
              <p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-[#7ba3cc]">{role}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => void doLogout()}
          disabled={loggingOut}
          className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium text-[#a8c4e4] transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50 ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title={collapsed ? 'Log out' : undefined}
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && (loggingOut ? 'Logging out…' : 'Log Out')}
        </button>
      </div>
    </div>
  )

  return (
    <div data-dash className="flex min-h-screen bg-[#f4f7fa] text-[#16283b]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen shrink-0 bg-[#0b2b52] lg:block" aria-label="Sidebar">
        {sidebar(false)}
      </aside>

      {/* mobile nav overlay */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/50" aria-hidden onClick={() => setMobileNav(false)} />
          <div className="absolute inset-y-0 left-0 bg-[#0b2b52] shadow-2xl">{sidebar(true)}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-[#e1e9f1] bg-white/90 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNav(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#3d5068] hover:bg-[#f4f7fa] lg:hidden"
            aria-label="Open navigation"
            aria-expanded={mobileNav}
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden h-10 w-10 items-center justify-center rounded-lg text-[#3d5068] hover:bg-[#f4f7fa] lg:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
          >
            <PanelsTopLeft className="h-5 w-5" />
          </button>

          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 sm:flex">
            <span className="text-[13px] text-[#5b6d80]">ABAP Atelier</span>
            <ChevronRight className="h-3.5 w-3.5 text-[#9aafbf]" aria-hidden />
            <span className="truncate text-[13px] font-semibold text-[#16283b]">
              {NAV.find((n) => n.key === view)?.label ?? 'Dashboard'}
            </span>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {view === 'programs' && (
              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aafbf]" aria-hidden />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search my programs…"
                  aria-label="Search my programs"
                  className="h-10 w-56 rounded-xl border-[#dde6ef] bg-[#f8fafc] pl-9 text-[13px] focus-visible:ring-[#0a6ed1]/25"
                />
              </div>
            )}
            <Button
              onClick={() => setNewOpen(true)}
              aria-label="New Program"
              className="h-10 rounded-xl bg-[#0a6ed1] px-3.5 text-[13.5px] font-semibold hover:bg-[#0a4d8c]"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Program</span>
            </Button>
            {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && (
              <span className="ml-1 flex items-center" title="Account">
                <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8' } }} />
              </span>
            )}
          </div>
        </header>

        {/* content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {error && (
            <div className="mb-6 flex flex-col items-start gap-3 rounded-2xl border border-[#f0d2cf] bg-[#fdf1f0] p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13.5px] text-[#8a2f24]">
                The dashboard data could not be loaded. The server may be waking up — try again.
              </p>
              <Button
                variant="outline"
                onClick={() => void refresh()}
                className="shrink-0 rounded-lg border-[#e5b9b4] text-[#8a2f24] hover:bg-[#fbeae8]"
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            </div>
          )}

          {loading && !data && (
            <div className="space-y-6" aria-hidden>
              <div className="h-10 w-72 animate-pulse rounded-xl bg-[#e6edf4]" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#e6edf4]" />
                ))}
              </div>
              <div className="h-64 animate-pulse rounded-2xl bg-[#e6edf4]" />
            </div>
          )}

          {data && view === 'overview' && (
            <div className="space-y-8">
              {/* welcome */}
              <div className="flex flex-col gap-5 rounded-2xl border border-[#e1e9f1] bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div>
                  <h1 className="text-[clamp(20px,2.6vw,26px)] font-extrabold tracking-[-0.02em] text-[#16283b]">
                    {dayPart}, {username}! Ready to build something?
                  </h1>
                  <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-[#5b6d80]">
                    Your private repository, the shared curriculum and the full SAP workbench are
                    ready. Pick up where you left off or start something new.
                  </p>
                </div>
                <div className="flex shrink-0 gap-2.5">
                  <Button
                    onClick={() => setNewOpen(true)}
                    className="h-11 rounded-xl bg-[#0a6ed1] px-5 text-[14px] font-semibold hover:bg-[#0a4d8c]"
                  >
                    <Plus className="h-4 w-4" /> Create New Program
                  </Button>
                  <Link
                    href="/workbench"
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#c9d4e0] bg-white px-5 text-[14px] font-semibold text-[#0a4d8c] transition-colors hover:bg-[#e8f1fa]"
                  >
                    <Wrench className="h-4 w-4" /> Workbench
                  </Link>
                </div>
              </div>

              {/* continue where you left off (real latest run) */}
              {data.recents[0] && (
                <Link
                  href={`/workbench?program=${encodeURIComponent(data.recents[0].programName)}`}
                  className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-[#0b2b52] to-[#0a3a68] p-5 shadow-md transition-all hover:shadow-lg"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#6cb6f5]">
                    <Play className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[8.5px] uppercase tracking-[0.15em] text-[#7ba3cc]">
                      Continue where you left off
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[14px] font-bold text-white">
                      {data.recents[0].programName}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-[12px] text-[#a8c4e4] sm:block">
                    {timeAgo(data.recents[0].createdAt)}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#6cb6f5] transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              )}

              {/* stats */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={FileCode2} label="My programs" value={data.mine.length} testid="stat-my-programs" hint="Private to your account" tone="blue" />
                <StatCard icon={FolderOpen} label="Shared examples" value={data.examples.length} hint="Read-only curriculum objects" tone="violet" />
                <StatCard icon={GraduationCap} label="Curriculum topics" value={data.topics.length} hint="From SELECT to CDS & RAP" tone="emerald" />
                <StatCard
                  icon={Clock}
                  label="Recent runs"
                  value={data.recents.length}
                  hint="Your latest executions"
                  tone="amber"
                />
              </div>

              {/* real 7-day execution activity */}
              <ActivityStrip recents={data.recents} />

              {/* quick actions */}
              <section aria-labelledby="qa-heading" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <h2 id="qa-heading" className="sr-only">Quick actions</h2>
                {[
                  { icon: Plus, label: 'Create New Program', hint: 'Starter template in SE38', run: () => setNewOpen(true) },
                  { icon: FolderOpen, label: 'Open Workbench', hint: 'Easy Access & transactions', href: '/workbench' },
                  { icon: BookOpen, label: 'Browse Examples', hint: '41 runnable curriculum objects', href: '/workbench' },
                  data.recents[0]
                    ? { icon: Play, label: 'Continue Recent Work', hint: data.recents[0].programName, href: `/workbench?program=${encodeURIComponent(data.recents[0].programName)}` }
                    : { icon: GraduationCap, label: 'Explore the Curriculum', hint: '10 topics, beginner-friendly', href: '/dashboard', run: () => setView('curriculum') },
                ].map((a) =>
                  'href' in a && a.href && !('run' in a) ? (
                    <Link
                      key={a.label}
                      href={a.href}
                      className="group flex items-center gap-3.5 rounded-2xl border border-[#e1e9f1] bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#b9d3ee] hover:shadow-md"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f1fa] text-[#0a4d8c] transition-colors group-hover:bg-[#0a6ed1] group-hover:text-white">
                        <a.icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-bold text-[#16283b]">{a.label}</span>
                        <span className="block truncate text-[12px] text-[#5b6d80]">{a.hint}</span>
                      </span>
                    </Link>
                  ) : (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => ('run' in a && a.run ? a.run() : undefined)}
                      className="group flex items-center gap-3.5 rounded-2xl border border-[#e1e9f1] bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#b9d3ee] hover:shadow-md"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f1fa] text-[#0a4d8c] transition-colors group-hover:bg-[#0a6ed1] group-hover:text-white">
                        <a.icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-bold text-[#16283b]">{a.label}</span>
                        <span className="block truncate text-[12px] text-[#5b6d80]">{a.hint}</span>
                      </span>
                    </button>
                  ),
                )}
              </section>

              {/* recent programs */}
              <section aria-labelledby="rp-heading" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 id="rp-heading" className="text-[16px] font-bold text-[#16283b]">My programs</h2>
                  <button
                    type="button"
                    onClick={() => setView('programs')}
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#0a6ed1] hover:text-[#0a4d8c]"
                  >
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ProgramTable
                  programs={filteredMine.slice(0, 6)}
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                  emptyAction={
                    <Button onClick={() => setNewOpen(true)} className="rounded-xl bg-[#0a6ed1] hover:bg-[#0a4d8c]">
                      <Plus className="h-4 w-4" /> Create your first program
                    </Button>
                  }
                />
              </section>
            </div>
          )}

          {data && view === 'programs' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-[#16283b]">My Programs</h1>
                  <p className="mt-1 text-[13.5px] text-[#5b6d80]">
                    {data.mine.length} object{data.mine.length === 1 ? '' : 's'} in your private repository.
                    Open one to run or edit it in the workbench.
                  </p>
                </div>
                <div className="relative md:hidden">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aafbf]" aria-hidden />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    aria-label="Search my programs"
                    className="h-10 rounded-xl pl-9 text-[13px]"
                  />
                </div>
              </div>
              <ProgramTable
                programs={filteredMine}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
                emptyAction={
                  <Button onClick={() => setNewOpen(true)} className="rounded-xl bg-[#0a6ed1] hover:bg-[#0a4d8c]">
                    <Plus className="h-4 w-4" /> Create your first program
                  </Button>
                }
              />
            </div>
          )}

          {data && view === 'curriculum' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-[#16283b]">Curriculum</h1>
                <p className="mt-1 text-[13.5px] text-[#5b6d80]">
                  {data.topics.length} topics from first SELECT to Modern ABAP. Each topic lists its
                  runnable example objects in Easy Access.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {data.topics.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-[#e1e9f1] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#b9d3ee] hover:shadow-md">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-[9.5px] uppercase tracking-[0.13em] text-[#5b6d80]">
                        Topic {String(t.srNo).padStart(2, '0')} · {t.category}
                      </p>
                      <span className="rounded border border-[#c9def2] bg-[#e8f1fa] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-[#0a4d8c]">
                        {t.exampleCount} example{t.exampleCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <h2 className="mt-2 text-[15.5px] font-bold text-[#16283b]">{t.title}</h2>
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[#5b6d80]">{t.summary}</p>
                  </div>
                ))}
              </div>
              <Link
                href="/workbench"
                className="inline-flex items-center gap-2 rounded-xl bg-[#0a6ed1] px-5 py-3 text-[14px] font-semibold text-white hover:bg-[#0a4d8c]"
              >
                <Wrench className="h-4 w-4" /> Open Easy Access to start a topic
              </Link>
            </div>
          )}

          {data && view === 'recent' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-[#16283b]">Recent activity</h1>
                <p className="mt-1 text-[13.5px] text-[#5b6d80]">
                  Your latest program executions, newest first.
                </p>
              </div>
              {data.recents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#c9d4e0] bg-white px-6 py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f1fa] text-[#0a4d8c]">
                    <Clock className="h-6 w-6" />
                  </span>
                  <p className="mt-4 text-[15px] font-bold text-[#16283b]">No runs yet</p>
                  <p className="mt-1 max-w-sm text-[13px] text-[#5b6d80]">
                    Execute a program in the workbench and it appears here.
                  </p>
                </div>
              ) : (
                <ol className="space-y-2.5">
                  {data.recents.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/workbench?program=${encodeURIComponent(r.programName)}`}
                        className="flex items-center gap-3.5 rounded-2xl border border-[#e1e9f1] bg-white px-4 py-3.5 shadow-sm transition-all hover:border-[#b9d3ee] hover:shadow-md"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e8f1fa] text-[#0a4d8c]">
                          <Play className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-[13px] font-semibold text-[#16283b]">
                            {r.programName}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] text-[#5b6d80]">{timeAgo(r.createdAt)}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#9aafbf]" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </main>

        <footer className="border-t border-[#e1e9f1] bg-white px-4 py-4 sm:px-6">
          <p className="mx-auto max-w-6xl text-[11.5px] text-[#5b6d80]">
            ABAP Atelier — independent SAP training simulator, not affiliated with SAP SE. System MER ·
            Client 105.
          </p>
        </footer>
      </div>

      <NewProgramDialog open={newOpen} onOpenChange={setNewOpen} onCreated={onCreated} />
      <EditProgramDialog program={editTarget} onOpenChange={(v) => !v && setEditTarget(null)} onSaved={refresh} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl sm:max-w-[440px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[17px] font-bold text-[#16283b]">
              Delete <span className="font-mono">{deleteTarget?.name}</span>?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed text-[#5b6d80]">
              This permanently removes the object from your repository. Shared examples can never be
              deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
              disabled={deleteBusy}
              className="rounded-lg bg-[#c0392b] hover:bg-[#a93226]"
            >
              {deleteBusy ? 'Deleting…' : 'Delete program'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
