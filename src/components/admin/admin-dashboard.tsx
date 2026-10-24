'use client'

// ── Owner-only administration dashboard ───────────────────────────────
// All data and mutations are enforced by /api/admin/* on the server; this UI
// only presents the tools. No role or user id supplied by the browser is ever
// trusted for authorization.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Database,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'

interface Metrics {
  totalUsers: number
  active7d: number
  active30d: number
  suspendedUsers: number
  totalPrograms: number
  examplePrograms: number
  privatePrograms: number
  legacyPrograms: number
  totalExecutions: number
  executions7d: number
  errors7d: number
  avgDurationMs7d: number
}

interface UserRow {
  id: string
  username: string
  email: string | null
  role: string
  suspended: boolean
  createdAt: string
  lastLoginAt: string | null
  programCount: number
  executionCount: number
  favoriteCount: number
}

interface ProgramRow {
  id: string
  name: string
  title: string
  type: string
  isExample: boolean
  executions: number
  createdAt: string
  updatedAt: string
  ownerId: string | null
  ownerUsername: string | null
}

interface AuditRow {
  id: number
  actorName: string
  action: string
  targetType: string
  targetId: string
  detail: string
  createdAt: string
}

interface ActivityRow {
  id: number
  programName: string
  status: string
  durationMs: number
  errorLine: number | null
  createdAt: string
  username: string | null
}

interface Overview {
  generatedAt: string
  metrics: Metrics
  users: UserRow[]
  programs: ProgramRow[]
  audit: AuditRow[]
  recentActivity: ActivityRow[]
}

type Tab = 'overview' | 'users' | 'programs' | 'audit'

function when(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function ago(value: string | null): string {
  if (!value) return 'never'
  const ms = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}

function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  icon: React.ReactNode
  tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : tone === 'warn'
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : tone === 'bad'
          ? 'text-red-700 bg-red-50 border-red-200'
          : 'text-[#0a4d8c] bg-blue-50 border-blue-200'
  return (
    <div className="rounded border border-[#c9d4e0] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#5b6b7c]">{label}</div>
          <div className="mt-1 text-[24px] font-semibold leading-none text-[#16283b]">{value}</div>
          {hint && <div className="mt-1.5 text-[10.5px] text-[#6a7a8b]">{hint}</div>}
        </div>
        <span className={`flex h-8 w-8 items-center justify-center rounded border ${toneClass}`}>{icon}</span>
      </div>
    </div>
  )
}

export function AdminDashboard({ ownerName }: { ownerName: string }) {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [userQuery, setUserQuery] = useState('')
  const [programQuery, setProgramQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/overview', { cache: 'no-store' })
      const body = (await res.json().catch(() => ({}))) as Overview & { error?: string }
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
      setData(body)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const act = useCallback(
    async (id: string, action: 'suspend' | 'reactivate' | 'revoke_sessions', username: string) => {
      const verb =
        action === 'suspend' ? 'Suspend' : action === 'reactivate' ? 'Reactivate' : 'Revoke all sessions for'
      const extra =
        action === 'suspend'
          ? '\n\nThe user will be signed out immediately and cannot log on until reactivated.'
          : action === 'revoke_sessions'
            ? '\n\nEvery active session for this user will be invalidated.'
            : ''
      if (!window.confirm(`${verb} ${username}?${extra}`)) return
      setBusyId(id)
      setNotice(null)
      try {
        const res = await fetch(`/api/admin/users/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) throw new Error(body.error ?? 'Action failed')
        setNotice(`${username}: ${verb.toLowerCase()} completed`)
        await load()
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusyId(null)
      }
    },
    [load],
  )

  const remove = useCallback(
    async (user: UserRow) => {
      const typed = window.prompt(
        `PERMANENT DELETE — ${user.username}\n\nThis removes the account, its private programs and favorites. Execution logs are retained without a user link.\n\nType the exact user name to confirm:`,
      )
      if (typed === null) return
      if (typed !== user.username) {
        setError('Deletion cancelled: the user name did not match exactly')
        return
      }
      setBusyId(user.id)
      setNotice(null)
      try {
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmUsername: typed }),
        })
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) throw new Error(body.error ?? 'Deletion failed')
        setNotice(`${user.username} was permanently deleted`)
        await load()
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusyId(null)
      }
    },
    [load],
  )

  const users = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    if (!data) return []
    return q
      ? data.users.filter(
          (u) =>
            u.username.toLowerCase().includes(q) ||
            (u.email ?? '').toLowerCase().includes(q) ||
            u.role.toLowerCase().includes(q),
        )
      : data.users
  }, [data, userQuery])

  const programs = useMemo(() => {
    const q = programQuery.trim().toLowerCase()
    if (!data) return []
    return q
      ? data.programs.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q) ||
            (p.ownerUsername ?? '').toLowerCase().includes(q),
        )
      : data.programs
  }, [data, programQuery])

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users', count: data?.users.length },
    { id: 'programs', label: 'All programs', count: data?.programs.length },
    { id: 'audit', label: 'Audit log', count: data?.audit.length },
  ]

  return (
    <div className="min-h-screen bg-[#eef2f6] text-[#1c2b3a]">
      <header className="border-b border-[#0a3a66] bg-gradient-to-b from-[#0d4a7a] to-[#0a3a66] text-white shadow">
        <div className="mx-auto flex h-12 max-w-[1500px] items-center gap-3 px-4">
          <Shield className="h-5 w-5 text-[#9fd0ff]" aria-hidden />
          <div className="text-[13.5px] font-semibold tracking-wide">ABAP-Studio · System Administration</div>
          <span className="rounded border border-white/25 bg-white/10 px-2 py-0.5 text-[10.5px] uppercase tracking-wider">
            MER · Client 105
          </span>
          <div className="ml-auto flex items-center gap-3 text-[11.5px]">
            <span className="hidden sm:inline text-white/80">
              Owner: <strong className="font-semibold text-white">{ownerName}</strong>
            </span>
            <Link
              href="/"
              className="rounded border border-white/25 bg-white/10 px-2.5 py-1 hover:bg-white/20"
            >
              Workbench
            </Link>
            <button
              type="button"
              onClick={() => {
                void fetch('/api/auth/logout', { method: 'POST' }).finally(() => window.location.assign('/'))
              }}
              className="flex items-center gap-1 rounded border border-white/25 bg-white/10 px-2.5 py-1 hover:bg-white/20"
            >
              <LogOut className="h-3.5 w-3.5" /> Log off
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded border border-[#b9c7d6] bg-white p-0.5" role="tablist" aria-label="Administration sections">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded px-3 py-1.5 text-[11.5px] font-medium ${
                  tab === t.id ? 'bg-[#0a4d8c] text-white shadow-sm' : 'text-[#33475b] hover:bg-[#e8eef5]'
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className={`ml-1.5 text-[10px] ${tab === t.id ? 'text-white/75' : 'text-[#6a7a8b]'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 text-[10.5px] text-[#5b6b7c]">
            {data && <span>Updated {when(data.generatedAt)}</span>}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-1 rounded border border-[#b9c7d6] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#25445f] hover:bg-[#f4f7fa] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-3 flex items-start gap-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-800">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">{error}</div>
            <button type="button" className="text-red-600 hover:text-red-800" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}
        {notice && (
          <div className="mb-3 flex items-start gap-2 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">{notice}</div>
            <button type="button" className="text-emerald-600 hover:text-emerald-800" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        )}

        {loading && !data ? (
          <div className="flex h-64 items-center justify-center rounded border border-[#c9d4e0] bg-white text-[12px] text-[#5b6b7c]">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading system data…
          </div>
        ) : data ? (
          <>
            {tab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
                  <Stat label="Registered users" value={data.metrics.totalUsers} hint={`${data.metrics.active7d} active in 7 days`} icon={<Users className="h-4 w-4" />} />
                  <Stat label="Active (30 d)" value={data.metrics.active30d} hint={`${data.metrics.active7d} this week`} icon={<Activity className="h-4 w-4" />} tone="good" />
                  <Stat label="Suspended" value={data.metrics.suspendedUsers} hint="Logon blocked" icon={<ShieldOff className="h-4 w-4" />} tone={data.metrics.suspendedUsers ? 'warn' : 'default'} />
                  <Stat label="Repository objects" value={data.metrics.totalPrograms} hint={`${data.metrics.examplePrograms} examples · ${data.metrics.privatePrograms} private · ${data.metrics.legacyPrograms} legacy`} icon={<BookOpen className="h-4 w-4" />} />
                  <Stat label="Executions (7 d)" value={data.metrics.executions7d} hint={`${data.metrics.totalExecutions} all time`} icon={<Database className="h-4 w-4" />} />
                  <Stat label="Runtime errors (7 d)" value={data.metrics.errors7d} hint={`Avg ${data.metrics.avgDurationMs7d} ms`} icon={<AlertTriangle className="h-4 w-4" />} tone={data.metrics.errors7d ? 'bad' : 'good'} />
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                  <section className="rounded border border-[#c9d4e0] bg-white shadow-sm">
                    <h2 className="border-b border-[#dbe4ed] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#3f566d]">
                      Recent executions
                    </h2>
                    <div className="max-h-[320px] overflow-auto">
                      <table className="w-full border-collapse text-[11px]">
                        <thead className="sticky top-0 bg-[#f4f7fa] text-left text-[10px] uppercase tracking-wide text-[#5b6b7c]">
                          <tr>
                            <th className="px-3 py-1.5 font-semibold">Program</th>
                            <th className="px-2 py-1.5 font-semibold">User</th>
                            <th className="px-2 py-1.5 font-semibold">Status</th>
                            <th className="px-2 py-1.5 font-semibold">ms</th>
                            <th className="px-3 py-1.5 font-semibold">When</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.recentActivity.map((r) => (
                            <tr key={r.id} className="border-t border-[#edf1f5]">
                              <td className="px-3 py-1.5 font-mono text-[10.5px]">{r.programName}</td>
                              <td className="px-2 py-1.5">{r.username ?? '—'}</td>
                              <td className="px-2 py-1.5">
                                <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ${r.status === 'ERROR' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 tabular-nums text-[#5b6b7c]">{r.durationMs}</td>
                              <td className="px-3 py-1.5 text-[#5b6b7c]">{ago(r.createdAt)}</td>
                            </tr>
                          ))}
                          {data.recentActivity.length === 0 && (
                            <tr><td colSpan={5} className="px-3 py-6 text-center text-[#7c8b9a]">No executions recorded yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="rounded border border-[#c9d4e0] bg-white shadow-sm">
                    <h2 className="border-b border-[#dbe4ed] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#3f566d]">
                      Latest administrative actions
                    </h2>
                    <div className="max-h-[320px] overflow-auto divide-y divide-[#edf1f5]">
                      {data.audit.slice(0, 10).map((a) => (
                        <div key={a.id} className="px-3 py-2 text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#25445f]">{a.action.replaceAll('_', ' ')}</span>
                            <span className="ml-auto text-[10px] text-[#7c8b9a]">{when(a.createdAt)}</span>
                          </div>
                          <div className="text-[#5b6b7c]">
                            by {a.actorName} · target {a.detail || a.targetId}
                          </div>
                        </div>
                      ))}
                      {data.audit.length === 0 && (
                        <div className="px-3 py-6 text-center text-[11px] text-[#7c8b9a]">No administrative actions yet.</div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {tab === 'users' && (
              <section className="rounded border border-[#c9d4e0] bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-2 border-b border-[#dbe4ed] px-3 py-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#3f566d]">User master</h2>
                  <label className="ml-auto flex items-center gap-1.5 rounded border border-[#b9c7d6] px-2 py-1">
                    <Search className="h-3.5 w-3.5 text-[#7c8b9a]" />
                    <input
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="Search users…"
                      className="w-48 bg-transparent text-[11px] outline-none placeholder:text-[#9aa8b6]"
                    />
                  </label>
                </div>
                <div className="overflow-auto">
                  <table className="w-full border-collapse text-[11px]">
                    <thead className="bg-[#f4f7fa] text-left text-[10px] uppercase tracking-wide text-[#5b6b7c]">
                      <tr>
                        <th className="px-3 py-2 font-semibold">User</th>
                        <th className="px-2 py-2 font-semibold">Role</th>
                        <th className="px-2 py-2 font-semibold">Status</th>
                        <th className="px-2 py-2 font-semibold">Programs</th>
                        <th className="px-2 py-2 font-semibold">Executions</th>
                        <th className="px-2 py-2 font-semibold">Last logon</th>
                        <th className="px-2 py-2 font-semibold">Created</th>
                        <th className="px-3 py-2 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-t border-[#edf1f5] align-middle">
                          <td className="px-3 py-2">
                            <div className="font-mono font-semibold text-[#16283b]">{u.username}</div>
                            <div className="text-[10px] text-[#7c8b9a]">{u.email ?? 'no email linked'}</div>
                          </td>
                          <td className="px-2 py-2">
                            <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ${u.role === 'OWNER' ? 'bg-[#0a4d8c] text-white' : 'bg-[#e8eef5] text-[#3f566d]'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ${u.suspended ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {u.suspended ? 'SUSPENDED' : 'ACTIVE'}
                            </span>
                          </td>
                          <td className="px-2 py-2 tabular-nums">{u.programCount}</td>
                          <td className="px-2 py-2 tabular-nums">{u.executionCount}</td>
                          <td className="px-2 py-2 text-[#5b6b7c]" title={when(u.lastLoginAt)}>{ago(u.lastLoginAt)}</td>
                          <td className="px-2 py-2 text-[#5b6b7c]">{when(u.createdAt)}</td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-1">
                              {u.role === 'OWNER' ? (
                                <span className="text-[10px] text-[#7c8b9a]">protected owner</span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={busyId === u.id}
                                    onClick={() => void act(u.id, u.suspended ? 'reactivate' : 'suspend', u.username)}
                                    className={`rounded border px-2 py-1 text-[10px] font-medium disabled:opacity-50 ${u.suspended ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                                  >
                                    {u.suspended ? 'Reactivate' : 'Suspend'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyId === u.id}
                                    onClick={() => void act(u.id, 'revoke_sessions', u.username)}
                                    className="rounded border border-[#b9c7d6] bg-white px-2 py-1 text-[10px] font-medium text-[#25445f] hover:bg-[#f4f7fa] disabled:opacity-50"
                                  >
                                    Revoke sessions
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyId === u.id}
                                    onClick={() => void remove(u)}
                                    className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan={8} className="px-3 py-8 text-center text-[#7c8b9a]">No users match this search.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {tab === 'programs' && (
              <section className="rounded border border-[#c9d4e0] bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-2 border-b border-[#dbe4ed] px-3 py-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#3f566d]">All repository programs</h2>
                  <span className="text-[10px] text-[#7c8b9a]">Owner visibility across every user</span>
                  <label className="ml-auto flex items-center gap-1.5 rounded border border-[#b9c7d6] px-2 py-1">
                    <Search className="h-3.5 w-3.5 text-[#7c8b9a]" />
                    <input
                      value={programQuery}
                      onChange={(e) => setProgramQuery(e.target.value)}
                      placeholder="Search programs or owners…"
                      className="w-56 bg-transparent text-[11px] outline-none placeholder:text-[#9aa8b6]"
                    />
                  </label>
                </div>
                <div className="max-h-[calc(100vh-220px)] overflow-auto">
                  <table className="w-full border-collapse text-[11px]">
                    <thead className="sticky top-0 bg-[#f4f7fa] text-left text-[10px] uppercase tracking-wide text-[#5b6b7c]">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Object</th>
                        <th className="px-2 py-2 font-semibold">Type</th>
                        <th className="px-2 py-2 font-semibold">Owner</th>
                        <th className="px-2 py-2 font-semibold">Access</th>
                        <th className="px-2 py-2 font-semibold">Runs</th>
                        <th className="px-2 py-2 font-semibold">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programs.map((p) => (
                        <tr key={p.id} className="border-t border-[#edf1f5]">
                          <td className="px-3 py-1.5">
                            <div className="font-mono font-semibold text-[#16283b]">{p.name}</div>
                            <div className="max-w-[420px] truncate text-[10px] text-[#7c8b9a]">{p.title}</div>
                          </td>
                          <td className="px-2 py-1.5">{p.type}</td>
                          <td className="px-2 py-1.5">{p.ownerUsername ?? '—'}</td>
                          <td className="px-2 py-1.5">
                            <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ${p.isExample ? 'bg-blue-100 text-blue-700' : p.ownerUsername ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {p.isExample ? 'EXAMPLE' : p.ownerUsername ? 'PRIVATE' : 'LEGACY'}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 tabular-nums">{p.executions}</td>
                          <td className="px-2 py-1.5 text-[#5b6b7c]">{when(p.updatedAt)}</td>
                        </tr>
                      ))}
                      {programs.length === 0 && (
                        <tr><td colSpan={6} className="px-3 py-8 text-center text-[#7c8b9a]">No programs match this search.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {tab === 'audit' && (
              <section className="rounded border border-[#c9d4e0] bg-white shadow-sm">
                <div className="border-b border-[#dbe4ed] px-3 py-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#3f566d]">Administrative audit log</h2>
                  <p className="text-[10px] text-[#7c8b9a]">Immutable record of sensitive owner actions. Passwords, tokens and source are never stored here.</p>
                </div>
                <div className="overflow-auto">
                  <table className="w-full border-collapse text-[11px]">
                    <thead className="bg-[#f4f7fa] text-left text-[10px] uppercase tracking-wide text-[#5b6b7c]">
                      <tr>
                        <th className="px-3 py-2 font-semibold">When</th>
                        <th className="px-2 py-2 font-semibold">Actor</th>
                        <th className="px-2 py-2 font-semibold">Action</th>
                        <th className="px-2 py-2 font-semibold">Target</th>
                        <th className="px-3 py-2 font-semibold">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.audit.map((a) => (
                        <tr key={a.id} className="border-t border-[#edf1f5]">
                          <td className="px-3 py-1.5 text-[#5b6b7c]">{when(a.createdAt)}</td>
                          <td className="px-2 py-1.5 font-mono">{a.actorName}</td>
                          <td className="px-2 py-1.5 font-semibold text-[#25445f]">{a.action}</td>
                          <td className="px-2 py-1.5 text-[#5b6b7c]">{a.targetType} · {a.targetId}</td>
                          <td className="px-3 py-1.5">{a.detail}</td>
                        </tr>
                      ))}
                      {data.audit.length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-8 text-center text-[#7c8b9a]">No administrative actions recorded.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        ) : null}

        <footer className="mt-4 flex flex-wrap items-center gap-2 text-[10px] text-[#7c8b9a]">
          <Shield className="h-3 w-3" />
          Owner authorization is enforced server-side on every request. Metrics derive from stored users and execution logs.
          <span className="ml-auto">ABAP-Studio administration · MER (105)</span>
        </footer>
      </main>
    </div>
  )
}
