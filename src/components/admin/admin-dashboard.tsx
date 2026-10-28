'use client'

// ── Owner-only administration dashboard ───────────────────────────────
// All data and mutations are enforced by /api/admin/* on the server; this UI
// only presents the tools. No role or user id supplied by the browser is ever
// trusted for authorization.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { signOutClerkClient } from '@/lib/clerk-client'
import {
  CheckCircle2,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  Trash2,
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

interface ExecutionDay {
  date: string
  label: string
  executions: number
  errors: number
}

interface Overview {
  generatedAt: string
  metrics: Metrics
  users: UserRow[]
  programs: ProgramRow[]
  audit: AuditRow[]
  recentActivity: ActivityRow[]
  executionSeries: ExecutionDay[]
}

type Tab = 'overview' | 'users' | 'programs' | 'audit'
type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral'

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

function Coupon({
  label,
  value,
  hint,
  code,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  code: string
  tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  return (
    <div className="mf-coupon" data-tone={tone}>
      <div className="mf-coupon-label">{label}</div>
      <div className="mf-coupon-value">{value}</div>
      {hint && <div className="mf-coupon-hint">{hint}</div>}
      <div className="mf-coupon-code">{code}</div>
    </div>
  )
}

function Status({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="mf-status" data-tone={tone}>
      {children}
    </span>
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
  const [busyProgramId, setBusyProgramId] = useState<string | null>(null)
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

  const removeProgram = useCallback(
    async (program: ProgramRow) => {
      if (program.isExample) return
      const owner = program.ownerUsername ?? 'legacy/unowned'
      const typed = window.prompt(
        `PERMANENT DELETE — ${program.name}\n\nOwner: ${owner}\n\nThis removes the program and detaches its execution history. Its source cannot be recovered.\n\nType the exact program name to confirm:`,
      )
      if (typed === null) return
      if (typed !== program.name) {
        setError('Deletion cancelled: the program name did not match exactly')
        return
      }
      setBusyProgramId(program.id)
      setNotice(null)
      try {
        const res = await fetch(`/api/admin/programs/${program.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmName: typed }),
        })
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) throw new Error(body.error ?? 'Deletion failed')
        setNotice(`${program.name} was permanently deleted`)
        await load()
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusyProgramId(null)
      }
    },
    [load],
  )

  const logoff = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(body.error ?? 'Logoff could not be completed')
        return
      }
      const clerkSignedOut = await signOutClerkClient()
      if (!clerkSignedOut) {
        toast.error(
          'The secure session was revoked, but the browser sign-out did not complete — retry logoff',
        )
        return
      }
      window.location.assign('/')
    } catch {
      toast.error('Cannot reach the system — logoff was not confirmed')
    }
  }, [])

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

  const executionMax = Math.max(1, ...(data?.executionSeries.map((d) => d.executions) ?? []))
  const activeUsers = data ? data.users.filter((u) => !u.suspended).length : 0
  const suspendedUsers = data ? data.users.filter((u) => u.suspended).length : 0

  return (
    <div className="mf-admin">
      <header className="mf-topbar">
        <div className="mf-brand">
          <span className="mf-mark" aria-hidden>
            AV
          </span>
          <div className="mf-brandtext">
            <h1>ABAP-Studio · System Administration</h1>
            <span className="mf-badge">MER · Client 105</span>
          </div>
        </div>
        <div className="mf-topmid" aria-hidden>
          SYSTEM MANIFEST / MER 105
        </div>
        <div className="mf-topactions">
          <span className="mf-owner">
            OWNER: <strong>{ownerName}</strong>
          </span>
          <button type="button" onClick={() => void load()} disabled={loading} className="mf-topbtn">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} aria-hidden /> Refresh
          </button>
          <Link href="/" className="mf-topbtn">
            Workbench
          </Link>
          <button type="button" onClick={() => void logoff()} className="mf-topbtn mf-topbtn-danger">
            <LogOut className="h-3 w-3" aria-hidden /> Log off
          </button>
        </div>
      </header>

      <div className="mf-shell">
        <aside className="mf-rail">
          <div className="mf-rail-label">Manifest index</div>
          <div className="mf-nav" role="tablist" aria-label="Administration sections">
            {tabs.map((t, index) => (
              <button
                key={t.id}
                id={`mf-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls="mf-tabpanel"
                onClick={() => setTab(t.id)}
                className="mf-navitem"
                data-active={tab === t.id}
              >
                <span className="mf-navnum">{String(index + 1).padStart(2, '0')}</span>
                <span className="mf-navlabel">{t.label}</span>
                <span className="mf-navcount">{t.count ?? 'live'}</span>
              </button>
            ))}
          </div>
          <div className="mf-railfoot">
            <div className="mf-live-line">
              <span className="mf-live-dot" aria-hidden /> Validated {data ? when(data.generatedAt) : '—'}
            </div>
            <div>Client 105</div>
            <div>System MER</div>
            <span className="mf-stamp">Owner gate</span>
          </div>
        </aside>

        <main className="mf-main">
          <div className="mf-hero">
            <div>
              <h2 className="mf-display">System manifest</h2>
              <p className="mf-sub">
                Every account, route and run in one working record. Stamped when it changes.
              </p>
            </div>
            <div className="mf-validated-wrap">
              <div className="mf-validated" aria-hidden>
                SERVER
                <br />
                VALIDATED
              </div>
              {data && <span className="mf-updated">Sync {when(data.generatedAt)}</span>}
            </div>
          </div>

          {error && (
            <div className="mf-banner" data-tone="error" role="alert">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>{error}</div>
              <button type="button" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          )}
          {notice && (
            <div className="mf-banner" data-tone="success" role="status">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>{notice}</div>
              <button type="button" onClick={() => setNotice(null)}>
                Dismiss
              </button>
            </div>
          )}

          {loading && !data ? (
            <div className="mf-loading">
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> Reading manifest…
            </div>
          ) : data ? (
            <section
              role="tabpanel"
              id="mf-tabpanel"
              aria-labelledby={`mf-tab-${tab}`}
              className="mf-tabpanel"
            >
              {tab === 'overview' && (
                <>
                  <div className="mf-coupons">
                    <Coupon
                      label="Accounts / total"
                      value={data.metrics.totalUsers}
                      hint={`${data.metrics.active7d} active in 7 days`}
                      code="Line 001"
                    />
                    <Coupon
                      label="Active / 30d"
                      value={data.metrics.active30d}
                      hint={`${data.metrics.active7d} this week`}
                      code="Line 002"
                      tone="good"
                    />
                    <Coupon
                      label="Suspended"
                      value={data.metrics.suspendedUsers}
                      hint="Logon blocked"
                      code="Line 003"
                      tone={data.metrics.suspendedUsers ? 'warn' : 'default'}
                    />
                    <Coupon
                      label="Routes / programs"
                      value={data.metrics.totalPrograms}
                      hint={`${data.metrics.examplePrograms} examples · ${data.metrics.privatePrograms} private`}
                      code="Line 004"
                    />
                    <Coupon
                      label="Runs / 7d"
                      value={data.metrics.executions7d}
                      hint={`${data.metrics.totalExecutions} all time`}
                      code="Line 005"
                    />
                    <Coupon
                      label="Errors / 7d"
                      value={data.metrics.errors7d}
                      hint={`Avg ${data.metrics.avgDurationMs7d} ms`}
                      code="Line 006"
                      tone={data.metrics.errors7d ? 'bad' : 'good'}
                    />
                  </div>

                  <div className="mf-board">
                    <section className="mf-panel" aria-labelledby="mf-account-manifest">
                      <div className="mf-panel-head">
                        <h3 id="mf-account-manifest" className="mf-panel-title">
                          Account manifest
                        </h3>
                        <button type="button" className="mf-panel-link" onClick={() => setTab('users')}>
                          Full manifest →
                        </button>
                      </div>
                      <div
                        className="mf-table-wrap"
                        role="region"
                        aria-label="Account manifest table"
                        tabIndex={0}
                      >
                        <table className="mf-table">
                          <thead>
                            <tr>
                              <th>Account</th>
                              <th>Role</th>
                              <th>Status</th>
                              <th>Last seen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.users.slice(0, 5).map((u) => (
                              <tr key={u.id} data-selected={u.role === 'OWNER' ? 'true' : undefined}>
                                <td>
                                  <span className="mf-account">{u.username}</span>
                                  <span className="mf-email">{u.email ?? 'no email linked'}</span>
                                </td>
                                <td>
                                  <span className="mf-role">{u.role}</span>
                                </td>
                                <td>
                                  <Status tone={u.suspended ? 'warn' : 'good'}>
                                    {u.suspended ? 'Suspended' : 'Active'}
                                  </Status>
                                </td>
                                <td className="mf-muted">{ago(u.lastLoginAt)}</td>
                              </tr>
                            ))}
                            {data.users.length === 0 && (
                              <tr>
                                <td colSpan={4} className="mf-empty">
                                  No accounts in the manifest yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <aside className="mf-panel mf-route" aria-labelledby="mf-system-route">
                      <h3 id="mf-system-route">Accounts → objects → runs.</h3>
                      <div className="mf-arc" aria-hidden>
                        <svg viewBox="0 0 260 72" preserveAspectRatio="none">
                          <path
                            d="M2 58 C70 4 188 4 258 58"
                            fill="none"
                            stroke="#0b2b52"
                            strokeWidth="1.5"
                          />
                          <circle cx="2" cy="58" r="3" fill="#0a6ed1" />
                          <circle cx="130" cy="14" r="3" fill="#0b2b52" />
                          <circle cx="258" cy="58" r="3" fill={data.metrics.errors7d ? '#c0392b' : '#2ea52e'} />
                        </svg>
                      </div>
                      <div className="mf-route-labels">
                        <span>Accounts {data.metrics.totalUsers}</span>
                        <span>Programs {data.metrics.totalPrograms}</span>
                        <span>Runs {data.metrics.executions7d}</span>
                      </div>
                      <div className="mf-meta-row">
                        <span>Runtime errors</span>
                        <b>{data.metrics.errors7d}</b>
                      </div>
                      <div className="mf-meta-row">
                        <span>Audit events</span>
                        <b>{data.audit.length}</b>
                      </div>
                      <div className="mf-route-actions">
                        <button type="button" className="mf-btn" onClick={() => void load()}>
                          Refresh
                        </button>
                        <button type="button" className="mf-btn" onClick={() => setTab('audit')}>
                          View audit
                        </button>
                      </div>
                    </aside>
                  </div>

                  <div className="mf-lower">
                    <section className="mf-panel mf-chart-panel" aria-labelledby="mf-run-ledger">
                      <div className="mf-panel-head">
                        <h3 id="mf-run-ledger" className="mf-panel-title">
                          Run ledger / 7 days
                        </h3>
                        <div className="mf-legend" aria-hidden>
                          <span>
                            <i /> Runs
                          </span>
                          <span className="mf-legend-err">
                            <i /> Errors
                          </span>
                        </div>
                      </div>
                      <div className="mf-chart">
                        {data.executionSeries.map((day) => {
                          const height = (day.executions / executionMax) * 100
                          const errorHeight = day.executions
                            ? (day.errors / executionMax) * 100
                            : 0
                          return (
                            <div
                              key={day.date}
                              className="mf-bar-wrap"
                              title={`${day.date}: ${day.executions} execution(s), ${day.errors} error(s)`}
                              aria-label={`${day.date}: ${day.executions} executions, ${day.errors} errors`}
                            >
                              <div className="mf-bar" style={{ height: `${height}%` }}>
                                {day.errors > 0 && (
                                  <div
                                    className="mf-bar-errors"
                                    style={{
                                      height: `${(errorHeight / Math.max(height, 1)) * 100}%`,
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="mf-days">
                        {data.executionSeries.map((day) => (
                          <span key={day.date}>
                            {day.label}
                            <b>{day.executions}</b>
                          </span>
                        ))}
                      </div>
                    </section>

                    <section className="mf-panel" aria-labelledby="mf-recent-executions">
                      <div className="mf-panel-head">
                        <h3 id="mf-recent-executions" className="mf-panel-title">
                          Recent executions
                        </h3>
                        <span className="mf-panel-link" aria-hidden>
                          Latest {Math.min(data.recentActivity.length, 20)}
                        </span>
                      </div>
                      <div
                        className="mf-table-wrap mf-recent-scroll"
                        role="region"
                        aria-label="Recent executions table"
                        tabIndex={0}
                      >
                        <table className="mf-table mf-table-compact">
                          <thead>
                            <tr>
                              <th>Program</th>
                              <th>User</th>
                              <th>Status</th>
                              <th>ms</th>
                              <th>When</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.recentActivity.map((r) => (
                              <tr key={r.id}>
                                <td className="mf-mono">{r.programName}</td>
                                <td className="mf-muted">{r.username ?? '—'}</td>
                                <td>
                                  <Status
                                    tone={
                                      r.status === 'ERROR' ? 'bad' : r.status === 'RUN' ? 'info' : 'good'
                                    }
                                  >
                                    {r.status}
                                  </Status>
                                </td>
                                <td className="mf-num mf-muted">{r.durationMs}</td>
                                <td className="mf-muted" title={when(r.createdAt)}>
                                  {ago(r.createdAt)}
                                </td>
                              </tr>
                            ))}
                            {data.recentActivity.length === 0 && (
                              <tr>
                                <td colSpan={5} className="mf-empty">
                                  No executions recorded yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>

                  <section className="mf-panel mf-audit-preview" aria-labelledby="mf-latest-actions">
                    <div className="mf-panel-head">
                      <h3 id="mf-latest-actions" className="mf-panel-title">
                        Latest administrative actions
                      </h3>
                      <button type="button" className="mf-panel-link" onClick={() => setTab('audit')}>
                        Audit log →
                      </button>
                    </div>
                    <div className="mf-audit-list">
                      {data.audit.slice(0, 10).map((a) => (
                        <div key={a.id} className="mf-audit-row">
                          <span className="mf-audit-action">{a.action.replaceAll('_', ' ')}</span>
                          <span
                            className="mf-audit-detail"
                            title={`${a.actorName} · ${a.detail || a.targetId}`}
                          >
                            {a.actorName} · {a.detail || a.targetId}
                          </span>
                          <span className="mf-audit-when" title={when(a.createdAt)}>
                            {ago(a.createdAt)}
                          </span>
                        </div>
                      ))}
                      {data.audit.length === 0 && (
                        <div className="mf-empty" style={{ gridColumn: '1 / -1' }}>
                          No administrative actions yet.
                        </div>
                      )}
                    </div>
                  </section>
                </>
              )}

              {tab === 'users' && (
                <>
                  <div className="mf-coupons mf-coupons-4">
                    <Coupon label="Accounts" value={data.users.length} hint="All manifest lines" code="Line 001" />
                    <Coupon label="Active" value={activeUsers} hint="Can enter the system" code="Line 002" tone="good" />
                    <Coupon
                      label="Suspended"
                      value={suspendedUsers}
                      hint="Logon blocked"
                      code="Line 003"
                      tone={suspendedUsers ? 'warn' : 'default'}
                    />
                    <Coupon
                      label="Owners"
                      value={data.users.filter((u) => u.role === 'OWNER').length}
                      hint="Protected accounts"
                      code="Line 004"
                    />
                  </div>
                  <section className="mf-panel" aria-labelledby="mf-user-master">
                    <div className="mf-panel-head mf-panel-head-wrap">
                      <div>
                        <h2 id="mf-user-master" className="mf-section-title">
                          User master
                        </h2>
                        <p className="mf-panel-sub">
                          Every account, role and state. Suspension, session revocation and deletion are
                          stamped in the audit log.
                        </p>
                      </div>
                      <label className="mf-search">
                        <Search className="h-3.5 w-3.5 text-[#5b6b7c]" aria-hidden />
                        <span className="sr-only">Search users</span>
                        <input
                          value={userQuery}
                          onChange={(e) => setUserQuery(e.target.value)}
                          placeholder="Search users…"
                          aria-label="Search users"
                        />
                      </label>
                    </div>
                    <div
                      className="mf-table-scroll"
                      role="region"
                      aria-label="User master table"
                      tabIndex={0}
                    >
                      <table className="mf-table mf-table-dense">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Programs</th>
                            <th>Executions</th>
                            <th>Last logon</th>
                            <th>Created</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={u.id}>
                              <td>
                                <span className="mf-account">{u.username}</span>
                                <span className="mf-email">{u.email ?? 'no email linked'}</span>
                              </td>
                              <td>
                                <span className="mf-role">{u.role}</span>
                              </td>
                              <td>
                                <Status tone={u.suspended ? 'warn' : 'good'}>
                                  {u.suspended ? 'Suspended' : 'Active'}
                                </Status>
                              </td>
                              <td className="mf-num">{u.programCount}</td>
                              <td className="mf-num">{u.executionCount}</td>
                              <td className="mf-muted" title={when(u.lastLoginAt)}>
                                {ago(u.lastLoginAt)}
                              </td>
                              <td className="mf-muted">{when(u.createdAt)}</td>
                              <td>
                                <div className="flex justify-end gap-1">
                                  {u.role === 'OWNER' ? (
                                    <span className="mf-note">
                                      Protected owner
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        disabled={busyId === u.id}
                                        onClick={() =>
                                          void act(
                                            u.id,
                                            u.suspended ? 'reactivate' : 'suspend',
                                            u.username,
                                          )
                                        }
                                        className={`mf-btn ${u.suspended ? 'mf-btn-good' : 'mf-btn-warn'}`}
                                      >
                                        {u.suspended ? 'Reactivate' : 'Suspend'}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busyId === u.id}
                                        onClick={() => void act(u.id, 'revoke_sessions', u.username)}
                                        className="mf-btn"
                                      >
                                        Revoke sessions
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busyId === u.id}
                                        onClick={() => void remove(u)}
                                        className="mf-btn mf-btn-danger"
                                        aria-label={`Delete user ${u.username}`}
                                      >
                                        <Trash2 className="h-3 w-3" aria-hidden />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {users.length === 0 && (
                            <tr>
                              <td colSpan={8} className="mf-empty">
                                No users match this search.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}

              {tab === 'programs' && (
                <>
                  <div className="mf-coupons mf-coupons-4">
                    <Coupon label="Repository objects" value={data.programs.length} hint="All routes" code="Line 001" />
                    <Coupon
                      label="Examples"
                      value={data.programs.filter((p) => p.isExample).length}
                      hint="Shared, read-only"
                      code="Line 002"
                    />
                    <Coupon
                      label="Private"
                      value={data.programs.filter((p) => !p.isExample && p.ownerUsername).length}
                      hint="Creator-only"
                      code="Line 003"
                      tone="good"
                    />
                    <Coupon
                      label="Legacy"
                      value={data.programs.filter((p) => !p.isExample && !p.ownerUsername).length}
                      hint="Owner visibility"
                      code="Line 004"
                      tone="warn"
                    />
                  </div>
                  <section className="mf-panel" aria-labelledby="mf-program-master">
                    <div className="mf-panel-head mf-panel-head-wrap">
                      <div>
                        <h2 id="mf-program-master" className="mf-section-title">
                          All repository programs
                        </h2>
                        <p className="mf-panel-sub">
                          Owner visibility across every user. Examples stay read-only; private objects stay
                          creator-only.
                        </p>
                      </div>
                      <label className="mf-search">
                        <Search className="h-3.5 w-3.5 text-[#5b6b7c]" aria-hidden />
                        <span className="sr-only">Search programs or owners</span>
                        <input
                          value={programQuery}
                          onChange={(e) => setProgramQuery(e.target.value)}
                          placeholder="Search programs or owners…"
                          aria-label="Search programs or owners"
                        />
                      </label>
                    </div>
                    <div
                      className="mf-table-scroll"
                      role="region"
                      aria-label="All programs table"
                      tabIndex={0}
                    >
                      <table className="mf-table mf-table-dense">
                        <thead>
                          <tr>
                            <th>Object</th>
                            <th>Type</th>
                            <th>Owner</th>
                            <th>Access</th>
                            <th>Runs</th>
                            <th>Updated</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {programs.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <span className="mf-account">{p.name}</span>
                                <span className="mf-email">{p.title}</span>
                              </td>
                              <td className="mf-note">{p.type}</td>
                              <td>{p.ownerUsername ?? '—'}</td>
                              <td>
                                <Status
                                  tone={p.isExample ? 'info' : p.ownerUsername ? 'good' : 'warn'}
                                >
                                  {p.isExample ? 'Example' : p.ownerUsername ? 'Private' : 'Legacy'}
                                </Status>
                              </td>
                              <td className="mf-num">{p.executions}</td>
                              <td className="mf-muted">{when(p.updatedAt)}</td>
                              <td style={{ textAlign: 'right' }}>
                                {p.isExample ? (
                                  <span className="mf-note">
                                    Protected example
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busyProgramId === p.id}
                                    onClick={() => void removeProgram(p)}
                                    className="mf-btn mf-btn-danger"
                                    aria-label={`Delete program ${p.name}`}
                                  >
                                    <Trash2 className="h-3 w-3" aria-hidden /> Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {programs.length === 0 && (
                            <tr>
                              <td colSpan={7} className="mf-empty">
                                No programs match this search.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}

              {tab === 'audit' && (
                <section className="mf-panel" aria-labelledby="mf-audit-log">
                  <div className="mf-panel-head mf-panel-head-wrap">
                    <div>
                      <h2 id="mf-audit-log" className="mf-section-title">
                        Administrative audit log
                      </h2>
                      <p className="mf-panel-sub">
                        Immutable record of sensitive owner actions. Passwords, tokens and source are never
                        stored here.
                      </p>
                    </div>
                    <span className="mf-mono text-[8px] uppercase tracking-[0.12em] text-[#5b6b7c]">
                      {data.audit.length} stamped events
                    </span>
                  </div>
                  <div
                    className="mf-table-scroll"
                    role="region"
                    aria-label="Administrative audit log table"
                    tabIndex={0}
                  >
                    <table className="mf-table mf-table-dense">
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Actor</th>
                          <th>Action</th>
                          <th>Target</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.audit.map((a) => (
                          <tr key={a.id}>
                            <td className="mf-muted">{when(a.createdAt)}</td>
                            <td className="mf-mono">{a.actorName}</td>
                            <td>
                              <span className="mf-role">{a.action}</span>
                            </td>
                            <td className="mf-muted">
                              {a.targetType} · {a.targetId}
                            </td>
                            <td>{a.detail}</td>
                          </tr>
                        ))}
                        {data.audit.length === 0 && (
                          <tr>
                            <td colSpan={5} className="mf-empty">
                              No administrative actions recorded.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </section>
          ) : null}

          <footer className="mf-footer">
            <Shield className="h-3 w-3" aria-hidden />
            <span>
              Owner authorization is enforced server-side on every request. Metrics derive from stored
              users and execution logs.
            </span>
            <span>ABAP-Studio administration · MER (105)</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
