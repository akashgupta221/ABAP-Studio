'use client'

// ── Section 7 & 8 workbench transactions ──────────────────────────────
// SCI/SLIN static checks · SLG1 application logs · SM21 system log ·
// SM36/SM37 background jobs · SQ01/SQ02 ABAP Query · SE09/SE10/STMS transports · SM50 work processes
import { useCallback, useEffect, useState } from 'react'
import { Activity, CheckCircle2, Play, Plus, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react'
import { api, useWorkbench } from './use-workbench'
import { TableList, ViewShell } from './tcode-views'

// ── SCI / SLIN static inspection ───────────────────────────────────────
interface Issue { kind: 'E' | 'W' | 'I'; line: number; check: string; message: string }
interface Metrics { statements: number; selects: number; loops: number; writes: number; dataDeclarations: number; forms: number; lines: number }

export function InspectorView() {
  const [program, setProgram] = useState('')
  const [report, setReport] = useState<{ issues: Issue[]; metrics: Metrics } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lastProgram = useWorkbench((s) => s.tabs.find((t) => t.key === s.activeTabKey)?.programName ?? '')

  useEffect(() => {
    if (lastProgram) setProgram(lastProgram.toUpperCase())
  }, [lastProgram])

  const run = async () => {
    if (!program.trim()) return
    setBusy(true)
    setErr(null)
    try {
      const r = await api<{ issues: Issue[]; metrics: Metrics }>(`/api/inspector?name=${encodeURIComponent(program.trim().toUpperCase())}`)
      setReport(r)
    } catch (e) {
      setReport(null)
      setErr(e instanceof Error ? e.message : 'Inspection failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ViewShell title="ABAP Code Inspector (SCI / SLIN)" subtitle="Static checks and metrics over a repository program — syntax, unused variables, SELECT in loop, nested loops, SELECT *">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-none border border-[#c6d7e6] bg-white px-3 py-2">
        <input
          value={program}
          onChange={(e) => setProgram(e.target.value.toUpperCase())}
          placeholder="Program name, e.g. ZQA_EXEC"
          className="h-[26px] w-full max-w-[320px] rounded-none border border-[#c6d7e6] px-2 font-mono text-[12px] uppercase outline-none focus:border-[#0a6ed1]"
          aria-label="Program to inspect"
        />
        <button type="button" className="sap-btn sap-btn-primary" disabled={busy} onClick={() => void run()}>
          <ShieldAlert className="h-3.5 w-3.5" />
          {busy ? 'Inspecting…' : 'Run checks'}
        </button>
        {err && <span className="text-[12px] text-[#8a2222]">{err}</span>}
      </div>
      {report && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              ['Statements', report.metrics.statements],
              ['SELECTs', report.metrics.selects],
              ['LOOPs', report.metrics.loops],
              ['WRITEs', report.metrics.writes],
              ['Data decls', report.metrics.dataDeclarations],
              ['FORMs', report.metrics.forms],
              ['Lines', report.metrics.lines],
              ['Findings', report.issues.length],
            ] as [string, number][]).map(([label, value]) => (
              <div key={label} className="rounded-none border border-[#c6d7e6] bg-white px-3 py-2">
                <div className="text-[10.5px] uppercase tracking-wide text-[#55677a]">{label}</div>
                <div className="font-mono text-[18px] font-bold text-[#17324a]">{value}</div>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-none border border-[#c6d7e6] bg-white">
            <div className="border-b border-[#dce6f0] bg-[#edf3fa] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">Findings</div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="alv-grid">
                  <th className="w-10 px-2 py-1 text-left text-[11px]">Sev</th>
                  <th className="w-14 px-2 py-1 text-right text-[11px]">Line</th>
                  <th className="w-40 px-2 py-1 text-left text-[11px]">Check</th>
                  <th className="px-2 py-1 text-left text-[11px]">Message</th>
                </tr>
              </thead>
              <tbody>
                {report.issues.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-[12px] text-[#2c6b34]">No findings — the program passes the static checks.</td></tr>
                )}
                {report.issues.map((i, idx) => (
                  <tr key={idx} className="border-b border-[#eef3f8]">
                    <td className="px-2 py-1 font-mono font-bold">
                      <span className={i.kind === 'E' ? 'text-[#a31f1f]' : i.kind === 'W' ? 'text-[#8a6d1a]' : 'text-[#0a6e6e]'}>{i.kind}</span>
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-[#55677a]">{i.line}</td>
                    <td className="px-2 py-1 font-mono text-[11px] text-[#0a3d73]">{i.check}</td>
                    <td className="px-2 py-1 text-[#44586c]">{i.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ViewShell>
  )
}

// ── SLG1 application logs ──────────────────────────────────────────────
interface LogDto { id: number; object: string; externalNumber: string; messages: { msgType: string; text: string }[]; createdBy: string; createdAt: string }

export function Slg1View() {
  const [logs, setLogs] = useState<LogDto[] | null>(null)
  const [sel, setSel] = useState<LogDto | null>(null)
  const refresh = useCallback(() => {
    api<{ logs: LogDto[] }>('/api/logs').then((r) => setLogs(r.logs)).catch(() => setLogs([]))
  }, [])
  useEffect(() => { refresh() }, [refresh])
  return (
    <ViewShell
      title="Application Log (SLG1)"
      subtitle="Logs written by ABAP with BAL_LOG_CREATE / BAL_LOG_MSG_ADD / BAL_DB_SAVE"
      onBack={sel ? () => setSel(null) : undefined}
      action={<button type="button" className="sap-btn" onClick={refresh}><RefreshCw className="h-3.5 w-3.5" />Refresh</button>}
    >
      {!sel ? (
        <TableList
          empty="No application logs yet — run a program that uses BAL_LOG_CREATE / BAL_LOG_MSG_ADD / BAL_DB_SAVE."
          headers={['Object', 'External number', 'Messages', 'Created by', 'Time']}
          rows={(logs ?? []).map((l) => ({ key: String(l.id), cells: [l.object, l.externalNumber, String(l.messages.length), l.createdBy, new Date(l.createdAt).toLocaleString()] }))}
          onOpen={(key) => setSel((logs ?? []).find((l) => String(l.id) === key) ?? null)}
        />
      ) : (
        <div className="overflow-hidden rounded-none border border-[#c6d7e6] bg-white">
          <div className="border-b border-[#dce6f0] bg-[#edf3fa] px-3 py-1.5 font-mono text-[12px] font-bold text-[#17324a]">
            {sel.object} {sel.externalNumber && <span className="font-normal text-[#55677a]">· {sel.externalNumber}</span>}
          </div>
          <table className="w-full text-[12px]">
            <tbody>
              {sel.messages.map((m, i) => (
                <tr key={i} className="border-b border-[#eef3f8]">
                  <td className="w-14 px-2 py-1 text-center font-mono font-bold text-[#0a3d73]">{m.msgType}</td>
                  <td className="px-2 py-1 text-[#44586c]">{m.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ViewShell>
  )
}

// ── SM21 system log ────────────────────────────────────────────────────
interface SysLogDto { id: number; type: string; text: string; userName: string; program: string; createdAt: string }

export function Sm21View() {
  const [entries, setEntries] = useState<SysLogDto[] | null>(null)
  const refresh = useCallback(() => {
    api<{ entries: SysLogDto[] }>('/api/system-log').then((r) => setEntries(r.entries)).catch(() => setEntries([]))
  }, [])
  useEffect(() => { refresh() }, [refresh])
  return (
    <ViewShell
      title="System Log (SM21)"
      subtitle="Every report execution is recorded here — dumps are flagged DUMP with the runtime error text"
      action={<button type="button" className="sap-btn" onClick={refresh}><RefreshCw className="h-3.5 w-3.5" />Refresh</button>}
    >
      <TableList
        empty="No system log entries yet — execute a report."
        headers={['Type', 'Time', 'User', 'Program', 'Text']}
        rows={(entries ?? []).map((e) => ({ key: String(e.id), cells: [e.type, new Date(e.createdAt).toLocaleString(), e.userName, e.program, e.text] }))}
      />
    </ViewShell>
  )
}

// ── SM36 / SM37 background jobs ────────────────────────────────────────
interface JobDto { id: number; name: string; report: string; status: string; scheduledAt: string; startedAt?: string; finishedAt?: string; resultStatus: string; resultError: string; lines: number }
interface JobDetail { job: JobDto & { log: string[] } }

export function JobsView() {
  const [jobs, setJobs] = useState<JobDto[] | null>(null)
  const [name, setName] = useState('')
  const [report, setReport] = useState('')
  const [delay, setDelay] = useState('0')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [detail, setDetail] = useState<JobDetail['job'] | null>(null)
  const owner = useWorkbench((s) => s.session.owner)

  const refresh = useCallback(() => {
    api<{ jobs: JobDto[] }>('/api/jobs').then((r) => setJobs(r.jobs)).catch(() => setJobs([]))
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const schedule = async () => {
    setBusy(true)
    try {
      await api('/api/jobs', { method: 'PUT', body: JSON.stringify({ name, report, delaySeconds: Number(delay) || 0 }) })
      setMsg({ kind: 'ok', text: `Job ${name} scheduled for ${report.toUpperCase()} (runs on the next SM37 open when due)` })
      setName(''); setReport('')
      refresh()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Scheduling failed' })
    } finally {
      setBusy(false)
    }
  }

  const openDetail = async (id: number) => {
    try {
      const r = await api<JobDetail>('/api/jobs', { method: 'POST', body: JSON.stringify({ id }) })
      setDetail(r.job)
    } catch {
      setDetail(null)
    }
  }

  const cancel = async (id: number) => {
    await api(`/api/jobs?id=${id}`, { method: 'DELETE' }).catch(() => null)
    refresh()
  }

  return (
    <ViewShell
      title="Background Jobs (SM36 / SM37)"
      subtitle="Schedule a report as a job; due jobs execute when the monitor loads, results and logs are kept"
      onBack={detail ? () => setDetail(null) : undefined}
      action={<button type="button" className="sap-btn" onClick={refresh}><RefreshCw className="h-3.5 w-3.5" />Refresh</button>}
      msg={msg}
    >
      {detail ? (
        <div className="space-y-2">
          <div className="rounded-none border border-[#c6d7e6] bg-white px-3 py-2">
            <div className="font-mono text-[13px] font-bold text-[#17324a]">{detail.name} → {detail.report}</div>
            <div className="text-[11.5px] text-[#55677a]">status {detail.status} · result {detail.resultStatus || '—'} {detail.resultError && <span className="text-[#8a2222]">· {detail.resultError}</span>}</div>
          </div>
          <pre className="wb-scroll max-h-[50vh] overflow-auto rounded-none border border-[#c6d7e6] bg-white p-3 font-mono text-[12px] text-[#17324a]">
            {(detail.log ?? []).join('\n') || '(no job log output)'}
          </pre>
        </div>
      ) : (
        <div className="space-y-3">
          {owner && (
            <div className="rounded-none border border-[#c6d7e6] bg-white px-3 py-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">Schedule a job</div>
              <div className="flex flex-wrap items-center gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Job name" className="h-[26px] w-40 rounded-none border border-[#c6d7e6] px-2 text-[12px]" aria-label="Job name" />
                <input value={report} onChange={(e) => setReport(e.target.value.toUpperCase())} placeholder="Report Z…" className="h-[26px] w-52 rounded-none border border-[#c6d7e6] px-2 font-mono text-[12px] uppercase" aria-label="Report" />
                <label className="flex items-center gap-1 text-[11.5px] text-[#55677a]">
                  delay (s)
                  <input value={delay} onChange={(e) => setDelay(e.target.value)} className="h-[26px] w-16 rounded-none border border-[#c6d7e6] px-2 text-right font-mono text-[12px]" aria-label="Delay seconds" />
                </label>
                <button type="button" className="sap-btn sap-btn-primary" disabled={busy} onClick={() => void schedule()}><Plus className="h-3.5 w-3.5" />Schedule</button>
              </div>
            </div>
          )}
          <TableList
            empty="No jobs scheduled yet."
            headers={['ID', 'Name', 'Report', 'Status', 'Scheduled', 'Result', 'Log lines']}
            rows={(jobs ?? []).map((j) => ({ key: String(j.id), cells: [String(j.id), j.name, j.report, j.status, new Date(j.scheduledAt).toLocaleString(), j.resultStatus || '—', String(j.lines)] }))}
            onOpen={(key) => void openDetail(Number(key))}
            onDelete={owner ? (key) => void cancel(Number(key)) : undefined}
          />
        </div>
      )}
    </ViewShell>
  )
}

// ── SQ01 / SQ02 ABAP Query ─────────────────────────────────────────────
interface InfosetDto { name: string; baseTable: string; description: string }
interface QueryDto { name: string; infoset: string; fields: string[]; filters: { field: string; op: string; low: string; high?: string }[] }

export function QueryView() {
  const [infosets, setInfosets] = useState<InfosetDto[]>([])
  const [queries, setQueries] = useState<QueryDto[]>([])
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [isName, setIsName] = useState('')
  const [isTable, setIsTable] = useState('')
  const [qName, setQName] = useState('')
  const [qInfoset, setQInfoset] = useState('')
  const [qFields, setQFields] = useState('')
  const [runResult, setRunResult] = useState<{ query: string; generatedSource: string; status: string; list: string[]; error: { message?: string } | null } | null>(null)
  const owner = useWorkbench((s) => s.session.owner)

  const refresh = useCallback(() => {
    api<{ infosets: InfosetDto[]; queries: QueryDto[] }>('/api/query')
      .then((r) => { setInfosets(r.infosets); setQueries(r.queries) })
      .catch(() => { setInfosets([]); setQueries([]) })
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const saveInfoset = async () => {
    setBusy(true)
    try {
      await api('/api/query', { method: 'POST', body: JSON.stringify({ kind: 'infoset', name: isName, baseTable: isTable }) })
      setMsg({ kind: 'ok', text: `Infoset ${isName} created (SQ02)` })
      setIsName(''); setIsTable('')
      refresh()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Save failed' })
    } finally { setBusy(false) }
  }

  const saveQuery = async () => {
    setBusy(true)
    try {
      await api('/api/query', {
        method: 'POST',
        body: JSON.stringify({ kind: 'query', name: qName, infoset: qInfoset, fields: qFields.split(/[,\s]+/).filter(Boolean) }),
      })
      setMsg({ kind: 'ok', text: `Query ${qName} created (SQ01)` })
      setQName(''); setQFields('')
      refresh()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Save failed' })
    } finally { setBusy(false) }
  }

  const run = async (name: string) => {
    setBusy(true)
    try {
      const r = await api<{ query: string; generatedSource: string; status: string; list: string[]; error: { message?: string } | null }>(`/api/query?action=run&name=${encodeURIComponent(name)}`)
      setRunResult(r)
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Query failed' })
    } finally { setBusy(false) }
  }

  return (
    <ViewShell
      title="ABAP Query (SQ01 / SQ02)"
      subtitle="Define an infoset over a dictionary table, build a query, and execute the generated ABAP"
      onBack={runResult ? () => setRunResult(null) : undefined}
      msg={msg}
    >
      {runResult ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-none border border-[#c6d7e6] bg-white px-3 py-2">
            <Play className="h-4 w-4 text-[#2c6b34]" />
            <span className="font-mono text-[12.5px] font-bold text-[#17324a]">{runResult.query}</span>
            <span className="text-[11.5px] text-[#55677a]">status {runResult.status}</span>
            {runResult.error && <span className="text-[11.5px] text-[#8a2222]">{runResult.error.message}</span>}
          </div>
          <div className="overflow-hidden rounded-none border border-[#c6d7e6] bg-white">
            <div className="border-b border-[#dce6f0] bg-[#edf3fa] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">Generated ABAP</div>
            <pre className="wb-scroll max-h-[30vh] overflow-auto p-3 font-mono text-[11.5px] text-[#17324a]">{runResult.generatedSource}</pre>
          </div>
          <div className="overflow-hidden rounded-none border border-[#c6d7e6] bg-white">
            <div className="border-b border-[#dce6f0] bg-[#edf3fa] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">Result list</div>
            <pre className="wb-scroll max-h-[40vh] overflow-auto p-3 font-mono text-[12px] text-[#17324a]">{runResult.list.join('\n') || '(no output)'}</pre>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {owner && (
            <div className="rounded-none border border-[#c6d7e6] bg-white px-3 py-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">SQ02 — create infoset</div>
              <div className="flex flex-wrap items-center gap-2">
                <input value={isName} onChange={(e) => setIsName(e.target.value.toUpperCase())} placeholder="Infoset name" className="h-[26px] w-44 rounded-none border border-[#c6d7e6] px-2 font-mono text-[12px] uppercase" aria-label="Infoset name" />
                <input value={isTable} onChange={(e) => setIsTable(e.target.value.toUpperCase())} placeholder="Base table (e.g. SPFLI)" className="h-[26px] w-44 rounded-none border border-[#c6d7e6] px-2 font-mono text-[12px] uppercase" aria-label="Base table" />
                <button type="button" className="sap-btn" disabled={busy} onClick={() => void saveInfoset()}><Plus className="h-3 w-3" />Create infoset</button>
              </div>
              <div className="mt-3 mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">SQ01 — create query</div>
              <div className="flex flex-wrap items-center gap-2">
                <input value={qName} onChange={(e) => setQName(e.target.value.toUpperCase())} placeholder="Query name" className="h-[26px] w-44 rounded-none border border-[#c6d7e6] px-2 font-mono text-[12px] uppercase" aria-label="Query name" />
                <input value={qInfoset} onChange={(e) => setQInfoset(e.target.value.toUpperCase())} placeholder="Infoset" className="h-[26px] w-40 rounded-none border border-[#c6d7e6] px-2 font-mono text-[12px] uppercase" aria-label="Query infoset" />
                <input value={qFields} onChange={(e) => setQFields(e.target.value.toUpperCase())} placeholder="Fields (space separated, empty = all)" className="h-[26px] w-64 rounded-none border border-[#c6d7e6] px-2 font-mono text-[12px] uppercase" aria-label="Query fields" />
                <button type="button" className="sap-btn" disabled={busy} onClick={() => void saveQuery()}><Plus className="h-3 w-3" />Create query</button>
              </div>
            </div>
          )}
          <TableList
            empty="No queries yet — create an infoset, then a query."
            headers={['Query', 'Infoset', 'Fields']}
            rows={queries.map((q) => ({ key: q.name, cells: [q.name, q.infoset, (q.fields.length ? q.fields : ['(all)']).join(', ')] }))}
            onOpen={(key) => void run(key)}
            extraAction={(key) => (
              <button type="button" className="sap-btn" onClick={(e) => { e.stopPropagation(); void run(key) }}><Play className="h-3 w-3" />Run</button>
            )}
          />
          <div className="text-[11.5px] text-[#55677a]">
            Infosets: {(infosets.map((i) => `${i.name} (${i.baseTable})`).join(' · ')) || '—'}
          </div>
        </div>
      )}
    </ViewShell>
  )
}

// ── SE09/SE10 + STMS transports ────────────────────────────────────────
interface TransportDto { reqId: string; description: string; type: string; status: string; entries: { objectType: string; objectName: string }[]; createdAt: string; releasedAt?: string; importedAt?: string }

export function TransportsView() {
  const [requests, setRequests] = useState<TransportDto[]>([])
  const [queue, setQueue] = useState<TransportDto[]>([])
  const [desc, setDesc] = useState('')
  const [type, setType] = useState('WORKBENCH')
  const [objType, setObjType] = useState('PROG')
  const [objName, setObjName] = useState('')
  const [selected, setSelected] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const owner = useWorkbench((s) => s.session.owner)

  const refresh = useCallback(() => {
    Promise.all([
      api<{ requests: TransportDto[] }>('/api/transports'),
      api<{ queue: TransportDto[] }>('/api/transports?queue=released'),
    ]).then(([a, b]) => { setRequests(a.requests); setQueue(b.queue) }).catch(() => { setRequests([]); setQueue([]) })
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const act = async (payload: Record<string, unknown>, okText: string) => {
    setBusy(true)
    try {
      await api('/api/transports', { method: 'POST', body: JSON.stringify(payload) })
      setMsg({ kind: 'ok', text: okText })
      refresh()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Action failed' })
    } finally { setBusy(false) }
  }

  const current = requests.find((r) => r.reqId === selected)

  return (
    <ViewShell
      title="Transport Organizer (SE09 / SE10) & Import Queue (STMS)"
      subtitle="Create requests, add objects, release them into the import queue, then import"
      msg={msg}
    >
      {owner && (
        <div className="mb-3 rounded-none border border-[#c6d7e6] bg-white px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-[26px] rounded-none border border-[#c6d7e6] px-2 text-[12px]" aria-label="Request type">
              <option value="WORKBENCH">Workbench request</option>
              <option value="CUSTOMIZING">Customizing request</option>
            </select>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" className="h-[26px] w-64 rounded-none border border-[#c6d7e6] px-2 text-[12px]" aria-label="Request description" />
            <button type="button" className="sap-btn" disabled={busy} onClick={() => void act({ action: 'create', type, description: desc }, 'Transport request created')}><Plus className="h-3 w-3" />Create request</button>
          </div>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <TableList
            empty="No transport requests yet."
            headers={['Request', 'Type', 'Status', 'Objects']}
            rows={requests.map((r) => ({ key: r.reqId, cells: [r.reqId, r.type === 'WORKBENCH' ? 'Workbench' : 'Customizing', r.status, String(r.entries.length)] }))}
            onOpen={(key) => setSelected(key)}
          />
          {current && (
            <div className="rounded-none border border-[#c6d7e6] bg-white px-3 py-2">
              <div className="mb-1 font-mono text-[12.5px] font-bold text-[#17324a]">{current.reqId} — {current.description}</div>
              <ul className="mb-2 space-y-0.5 text-[11.5px] text-[#44586c]">
                {current.entries.map((e, i) => <li key={i} className="font-mono">{e.objectType} {e.objectName}</li>)}
                {current.entries.length === 0 && <li className="text-[#8a6d1a]">No objects yet</li>}
              </ul>
              {owner && current.status === 'OPEN' && (
                <div className="flex flex-wrap items-center gap-2">
                  <select value={objType} onChange={(e) => setObjType(e.target.value)} className="h-[24px] rounded-none border border-[#c6d7e6] px-1 text-[11.5px]" aria-label="Object type">
                    {['PROG', 'TABL', 'MESS', 'TRAN', 'CLAS', 'FUGR'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input value={objName} onChange={(e) => setObjName(e.target.value.toUpperCase())} placeholder="object name" className="h-[24px] w-40 rounded-none border border-[#c6d7e6] px-2 font-mono text-[11.5px] uppercase" aria-label="Object name" />
                  <button type="button" className="sap-btn" disabled={busy} onClick={() => void act({ action: 'add', reqId: current.reqId, objectType: objType, objectName: objName }, 'Object added to request')}>Add object</button>
                  <button type="button" className="sap-btn sap-btn-primary" disabled={busy} onClick={() => void act({ action: 'release', reqId: current.reqId }, `${current.reqId} released to the import queue`)}>Release</button>
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">
            <Activity className="h-3.5 w-3.5" /> STMS import queue
          </div>
          <TableList
            empty="Import queue is empty — release a request first."
            headers={['Request', 'Description', 'Released']}
            rows={queue.map((r) => ({ key: r.reqId, cells: [r.reqId, r.description, r.releasedAt ? new Date(r.releasedAt).toLocaleString() : ''] }))}
            extraAction={(key) => (
              <button type="button" className="sap-btn" onClick={(e) => { e.stopPropagation(); void act({ action: 'import', reqId: key }, `${key} imported (simulated)`) }}>
                <CheckCircle2 className="h-3 w-3" />Import
              </button>
            )}
          />
        </div>
      </div>
    </ViewShell>
  )
}

// ── SM50 work process monitor (snapshot of recent activity) ────────────
interface ExecDto { programName: string; status: string; durationMs: number; createdAt: string } // shape from /api/admin? use execution log endpoint

export function WorkprocessView() {
  const [rows, setRows] = useState<{ programName: string; status: string; durationMs: number; createdAt: string }[] | null>(null)
  const refresh = useCallback(() => {
    api<{ executions: { programName: string; status: string; durationMs: number; createdAt: string }[] }>('/api/executions?limit=20')
      .then((r) => setRows(r.executions))
      .catch(() => setRows([]))
  }, [])
  useEffect(() => { refresh() }, [refresh])
  return (
    <ViewShell
      title="Work Process Monitor (SM50)"
      subtitle="Simulated snapshot — recent report activity mapped onto dialog work processes (no OS processes exist in a browser system)"
      action={<button type="button" className="sap-btn" onClick={refresh}><RefreshCw className="h-3.5 w-3.5" />Refresh</button>}
    >
      <TableList
        empty="No recent executions."
        headers={['WP', 'Type', 'Program', 'Action', 'Status', 'Duration', 'Time']}
        rows={(rows ?? []).map((r, i) => ({
          key: String(i),
          cells: [`WP${i % 4}`, 'DIALOG', r.programName, 'Sequential read', r.status, `${r.durationMs} ms`, new Date(r.createdAt).toLocaleString()],
        }))}
      />
    </ViewShell>
  )
}
