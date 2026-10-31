'use client'

// ── Classic workbench transactions added on top of SE38/SE37/SE11 ─────
// SE91 Message Classes · SE93 Transaction registry · SNRO Number ranges ·
// AL11 Application server files · SM59 RFC destinations ·
// honest boundary screens for transactions the simulator cannot provide.
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, FileText, Hash, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { api, useWorkbench } from './use-workbench'

// honest documentation for transactions outside the simulator's scope
export const TCODE_BOUNDARIES: Record<string, { title: string; reason: string; alternative?: string }> = {
  SA38: { title: 'ABAP Program Execution (SA38)', reason: 'Reports run from SE38 (enter the program name there and press Execute).', alternative: 'SE38' },
  SE39: { title: 'Split-Screen Editor (SE39)', reason: 'Comparing two programs side by side needs a diff runtime that this training system does not provide. Copy both sources into any text diff tool.', alternative: 'SE38' },
  SE32: { title: 'Text Elements (SE32)', reason: 'Selection texts and text symbols are not part of the simulated text pool. Selection screens accept literals.', alternative: 'SE38' },
  SE36: { title: 'Logical Database Builder (SE36)', reason: 'Logical databases are a legacy read technique; the engine reads tables with Open SQL directly.', alternative: 'SE11' },
  SE51: { title: 'Screen Painter (SE51)', reason: 'Dynpro screens, table controls and tabstrips need a real dialog runtime — CALL SCREEN is not simulated in this training system.', alternative: 'SE38' },
  SE41: { title: 'Menu Painter (SE41)', reason: 'GUI statuses and menu bars belong to the dynpro runtime, which is not simulated. SET PF-STATUS is accepted as a no-op.', alternative: 'SE38' },
  SE43: { title: 'Area Menu Maintenance (SE43)', reason: 'Area menus need the SAP menu framework, which this training system does not include.', alternative: 'SE93' },
  SE35: { title: 'Dialog Modules (SE35)', reason: 'Dialog module pools need the dynpro runtime, which is not simulated.', alternative: 'SE38' },
  SE54: { title: 'Table Maintenance Generator (SE54)', reason: 'Generated maintenance dialogs are covered by direct entry maintenance: use SM30 instead.', alternative: 'SM30' },
  SM34: { title: 'View Cluster Maintenance (SM34)', reason: 'View clusters build on maintenance views, which are not simulated. Maintain tables directly with SM30.', alternative: 'SM30' },
  SE14: { title: 'Database Utility (SE14)', reason: 'The simulated database adjusts itself automatically when a dictionary table changes — no manual activation is needed.', alternative: 'SE11' },
  SE71: { title: 'SAPscript Form Painter (SE71)', reason: 'Form printing and layout sets are outside the simulator. The engine has no spool system.', alternative: 'SE38' },
  SE72: { title: 'SAPscript Styles (SE72)', reason: 'Form printing is outside the simulator.', alternative: 'SE38' },
  SE73: { title: 'SAPscript Fonts (SE73)', reason: 'Form printing is outside the simulator.', alternative: 'SE38' },
  SE78: { title: 'Form Graphics (SE78)', reason: 'Form graphics belong to the form/print runtime, which is not simulated.', alternative: 'SE38' },
  SO10: { title: 'Standard Texts (SO10)', reason: 'Standard texts belong to the SAPscript/office runtime, which is not simulated.', alternative: 'SE38' },
  SMARTFORMS: { title: 'Smart Forms Builder', reason: 'Smart Forms generate form function modules with a print runtime — not simulated in this training system.', alternative: 'SE38' },
  SMARTSTYLES: { title: 'Smart Styles Builder', reason: 'Smart Styles belong to the form/print runtime, which is not simulated.', alternative: 'SMARTFORMS' },
  NACE: { title: 'Output Control (NACE)', reason: 'Output determination links applications to forms — form printing is not simulated.', alternative: 'SE38' },
  SP01: { title: 'Spool Request Controller (SP01)', reason: 'The training system has no spool subsystem; list output appears directly on screen.', alternative: 'SE38' },
  SPAD: { title: 'Printer Administration (SPAD)', reason: 'There are no printers in the training system.', alternative: 'SP01' },
  SHDB: { title: 'Batch Input Recorder (SHDB)', reason: 'Recording screen steps needs a dynpro runtime, which is not simulated. BDCDATA tables and CALL TRANSACTION are accepted by the engine as a documented simulation.', alternative: 'SE38' },
  SM35: { title: 'Batch Input Sessions (SM35)', reason: 'BDC sessions depend on the dynpro runtime, which is not simulated.', alternative: 'SE38' },
  LSMW: { title: 'Legacy System Migration Workbench', reason: 'LSMW drives recordings and file conversions for data migration — outside the simulator. Files can be exchanged via AL11.', alternative: 'AL11' },
  SM59: { title: 'RFC Destinations (SM59)', reason: '', alternative: '' }, // real view
  BAPI: { title: 'BAPI Explorer', reason: 'The BAPI business-object repository belongs to real SAP applications. This system exposes its function modules in SE37 instead.', alternative: 'SE37' },
  WE31: { title: 'IDoc Segment Creation (WE31)', reason: 'IDocs/ALE need a message runtime that the training system does not include.', alternative: 'SE37' },
  WE30: { title: 'IDoc Type Creation (WE30)', reason: 'IDocs/ALE need a message runtime that the training system does not include.', alternative: 'SE37' },
  WE81: { title: 'IDoc Message Types (WE81)', reason: 'IDocs/ALE need a message runtime that the training system does not include.', alternative: 'SE37' },
  WE82: { title: 'Link IDoc/Message Types (WE82)', reason: 'IDocs/ALE need a message runtime that the training system does not include.', alternative: 'SE37' },
  WE21: { title: 'IDoc Ports (WE21)', reason: 'IDocs/ALE need a message runtime that the training system does not include.', alternative: 'SE37' },
  WE20: { title: 'IDoc Partner Profiles (WE20)', reason: 'IDocs/ALE need a message runtime that the training system does not include.', alternative: 'SE37' },
  BD64: { title: 'ALE Distribution Model (BD64)', reason: 'IDocs/ALE need a message runtime that the training system does not include.', alternative: 'SE37' },
  WE19: { title: 'IDoc Test Tool (WE19)', reason: 'IDocs/ALE need a message runtime that the training system does not include.', alternative: 'SE37' },
  WE02: { title: 'IDoc List (WE02)', reason: 'IDocs/ALE need a message runtime that the training system does not include.', alternative: 'SE37' },
  WE05: { title: 'IDoc List (WE05)', reason: 'IDocs/ALE need a message runtime that the training system does not include.', alternative: 'SE37' },
  BD87: { title: 'IDoc Reprocessing (BD87)', reason: 'IDocs/ALE need a message runtime that the training system does not include.', alternative: 'SE37' },
  CMOD: { title: 'Customer Exit Projects (CMOD)', reason: 'The enhancement framework hooks into real SAP application code, which this training system does not ship. Classic BAdIs/exits are covered conceptually in the curriculum.', alternative: 'SE38' },
  SMOD: { title: 'SAP Enhancements (SMOD)', reason: 'The enhancement framework hooks into real SAP application code, which this training system does not ship.', alternative: 'SE38' },
  SE18: { title: 'BAdI Definition (SE18)', reason: 'BAdIs hook into real SAP application code, which this training system does not ship. ABAP Objects events/interfaces are available in SE24.', alternative: 'SE24' },
  SE19: { title: 'BAdI Implementation (SE19)', reason: 'BAdIs hook into real SAP application code, which this training system does not ship.', alternative: 'SE24' },
  FIBF: { title: 'Business Transaction Events (FIBF)', reason: 'BTEs belong to Financial Accounting, which is not part of this training system.', alternative: 'SE37' },
  SPAU: { title: 'Modification Adjustment — Repository (SPAU)', reason: 'SPAU compares modifications after an upgrade; there is no upgrade flow in the training system.', alternative: 'SE38' },
  SPDD: { title: 'Modification Adjustment — Dictionary (SPDD)', reason: 'SPDD compares dictionary modifications after an upgrade; there is no upgrade flow in the training system.', alternative: 'SE11' },
  FILE: { title: 'Logical File Names (FILE)', reason: 'Logical file paths resolve on a real application server; use direct paths in AL11 instead.', alternative: 'AL11' },
  ABAPDOCU: { title: 'ABAP Keyword Documentation', reason: '', alternative: 'SYLLABUS' },
  ST05: { title: 'Performance Trace (ST05)', reason: 'SQL/buffer/enqueue traces need a real database and kernel buffers. This engine reports execution statistics (rows read, selects, duration) on every run instead.', alternative: 'SAT' },
  SAT: { title: 'Runtime Analysis (SAT / SE30)', reason: 'Statement-level profilers instrument the real ABAP kernel. Here every execution returns its duration, select count and lines written in the result statistics.', alternative: 'SE38' },
  SE30: { title: 'Runtime Analysis — old (SE30)', reason: 'Use SAT/SE38: the simulated engine reports execution statistics with every run.', alternative: 'SAT' },
  SM12: { title: 'Lock Entries (SM12)', reason: 'SAP enqueue locks protect records across users. This single-session training system has no concurrent users, so no lock entries can appear.', alternative: 'SE11' },
  SM13: { title: 'Update Requests (SM13)', reason: 'V1/V2 update task queues belong to the real SAP LUW; this engine applies changes immediately in the run snapshot.', alternative: 'SE38' },
  SU53: { title: 'Authorization Check (SU53)', reason: 'The simulator grants every authorization check (AUTHORITY-CHECK always returns sy-subrc = 0), so there are no failed checks to display.', alternative: 'SE38' },
  SU20: { title: 'Authorization Fields (SU20)', reason: 'Authorization fields/objects only matter with user profiles and role assignments, which this training system does not model.', alternative: 'SU53' },
  SU21: { title: 'Authorization Objects (SU21)', reason: 'Authorization objects need roles and profiles; the simulator grants all checks.', alternative: 'SU53' },
  SQ03: { title: 'ABAP Query User Groups (SQ03)', reason: 'User groups scope queries to end-user areas; the training system has a single shared workspace. Queries and infosets are in SQ01/SQ02.', alternative: 'SQ01' },
  SLG0: { title: 'Application Log Objects (SLG0)', reason: 'Log object definitions are optional here — BAL_LOG_CREATE creates the log with its object name directly. View logs in SLG1.', alternative: 'SLG1' },
  SCC1: { title: 'Client Copy by Transport (SCC1)', reason: 'Client copies need multiple clients and a real database; this system runs one client (105).', alternative: 'STMS' },
}

export function BoundaryView({ tcode }: { tcode: string }) {
  const navigate = useWorkbench((s) => s.navigate)
  const info = TCODE_BOUNDARIES[tcode]
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#ebf1f7]">
      <div className="flex items-center gap-3 border-b border-[#c6d7e6] bg-white px-4 py-2.5">
        <FileText className="h-5 w-5 text-[#8a6d1a]" />
        <div>
          <h1 className="text-[14px] font-bold text-[#17324a]">{info?.title ?? `Transaction ${tcode}`}</h1>
          <p className="text-[11.5px] text-[#55677a]">Transaction code {tcode}</p>
        </div>
        <button type="button" className="sap-btn ml-auto" onClick={() => navigate('home')}>
          <ArrowLeft className="h-3.5 w-3.5" />
          SAP Easy Access
        </button>
      </div>
      <div className="wb-scroll flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-[720px] space-y-4">
          <div className="rounded-none border border-[#e0d2a8] bg-[#fdf8e8] px-4 py-3 text-[12.5px] text-[#6b5410]">
            <strong>Simulation boundary.</strong>{' '}
            {info?.reason ?? 'This transaction is not part of the simulated training system.'}
          </div>
          <p className="text-[12.5px] text-[#44586c]">
            This workbench simulates the parts of the classic workbench that can run real ABAP:
            SE38/SA38 (reports), SE37 (function modules), SE24 (classes), SE11/SM30 (dictionary),
            SE16/SE16N (data browser), SE91 (message classes), SE93 (transaction codes), SNRO
            (number ranges), AL11/CG3Y/CG3Z (application server files) and SM59 (RFC destinations).
            Everything else is documented honestly rather than faked.
          </p>
          {info?.alternative && info.alternative !== 'SYLLABUS' && (
            <button
              type="button"
              className="sap-btn sap-btn-primary"
              onClick={() => {
                const st = useWorkbench.getState()
                // reuse the command field dispatch for the suggested alternative
                st.addMessage('S', `Suggested alternative: ${info.alternative}`)
                window.dispatchEvent(new CustomEvent('abap-command', { detail: info.alternative }))
              }}
            >
              Open {info.alternative}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── SE91 Message Classes ───────────────────────────────────────────────
interface MsgEntry { number: string; text: string }
interface MessageClassDto { name: string; description: string; messages: MsgEntry[] }

export function MessagesView() {
  const [classes, setClasses] = useState<MessageClassDto[] | null>(null)
  const [sel, setSel] = useState<MessageClassDto | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [msgs, setMsgs] = useState<MsgEntry[]>([{ number: '001', text: '' }])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const owner = useWorkbench((s) => s.session.owner)

  const refresh = useCallback(() => {
    api<{ classes: MessageClassDto[] }>('/api/messages')
      .then((r) => setClasses(r.classes))
      .catch(() => setClasses([]))
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const open = (c: MessageClassDto) => {
    setSel(c)
    setName(c.name)
    setDesc(c.description)
    setMsgs(c.messages.length ? c.messages : [{ number: '001', text: '' }])
    setMsg(null)
  }

  const save = async () => {
    setBusy(true)
    try {
      await api('/api/messages', { method: 'POST', body: JSON.stringify({ name, description: desc, messages: msgs }) })
      setMsg({ kind: 'ok', text: `Message class ${name.toUpperCase()} saved` })
      refresh()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (n: string) => {
    if (!window.confirm(`Delete message class ${n}?`)) return
    await api(`/api/messages?name=${encodeURIComponent(n)}`, { method: 'DELETE' }).catch(() => null)
    setSel(null)
    refresh()
  }

  return (
    <ViewShell
      title="Message Class Maintenance (SE91)"
      subtitle="Store message texts with &1..&4 placeholders — MESSAGE e001(ZCLASS) WITH ... resolves them at runtime"
      onBack={() => setSel(null)}
      action={owner && !sel && <button type="button" className="sap-btn sap-btn-primary" onClick={() => { setSel({ name: '', description: '', messages: [] }); setName(''); setDesc(''); setMsgs([{ number: '001', text: '' }]) }}><Plus className="h-3.5 w-3.5" />Create Class</button>}
      msg={msg}
    >
      {!sel ? (
        <TableList
          empty="No message classes yet — create one to use MESSAGE e001(ZCLASS) in ABAP."
          rows={(classes ?? []).map((c) => ({ key: c.name, cells: [c.name, c.description, String(c.messages.length)] }))}
          headers={['Class', 'Description', 'Messages']}
          onOpen={(key) => open((classes ?? []).find((c) => c.name === key)!)}
          onDelete={owner ? (key) => void remove(key) : undefined}
        />
      ) : (
        <div className="space-y-3">
          <div className="rounded-none border border-[#c6d7e6] bg-white px-4 py-3">
            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="msgclass-name">Class name</label>
              <input id="msgclass-name" value={name} disabled={!!classes?.some((c) => c.name === name)} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="ZMSG_TRAINING" className="h-[26px] w-full max-w-[280px] rounded-none border border-[#c6d7e6] px-2 font-mono text-[12px] uppercase outline-none focus:border-[#0a6ed1] disabled:bg-[#f0f4f8]" />
              <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="msgclass-desc">Description</label>
              <input id="msgclass-desc" value={desc} onChange={(e) => setDesc(e.target.value)} className="h-[26px] w-full max-w-[520px] rounded-none border border-[#c6d7e6] px-2 text-[12px] outline-none focus:border-[#0a6ed1]" />
            </div>
          </div>
          <div className="overflow-hidden rounded-none border border-[#c6d7e6] bg-white">
            <div className="border-b border-[#dce6f0] bg-[#edf3fa] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">Messages</div>
            {msgs.map((m, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-[#eef3f8] px-2 py-1.5">
                <input value={m.number} onChange={(e) => setMsgs(msgs.map((x, j) => (j === i ? { ...x, number: e.target.value.replace(/\D/g, '').slice(0, 3) } : x)))} className="h-[24px] w-16 rounded-none border border-[#c6d7e6] px-1.5 text-center font-mono text-[12px]" aria-label={`Message ${i + 1} number`} placeholder="001" />
                <input value={m.text} onChange={(e) => setMsgs(msgs.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className="h-[24px] w-full rounded-none border border-[#c6d7e6] px-2 text-[12px]" aria-label={`Message ${i + 1} text`} placeholder="Text with &1 &2 placeholders" />
                <button type="button" className="text-[#a33] hover:text-[#c33]" onClick={() => setMsgs(msgs.filter((_, j) => j !== i))} aria-label={`Remove message ${i + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <div className="flex gap-2 border-t border-[#dce6f0] px-2 py-1.5">
              <button type="button" className="sap-btn" onClick={() => setMsgs([...msgs, { number: String(msgs.length + 1).padStart(3, '0'), text: '' }])}><Plus className="h-3 w-3" />Add message</button>
              {owner && <button type="button" className="sap-btn sap-btn-primary ml-auto" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>}
            </div>
          </div>
          <p className="text-[11.5px] text-[#55677a]">Use in ABAP: <code className="rounded-sm bg-[#eef2f7] px-1 font-mono">MESSAGE e001({name.toUpperCase() || 'ZCLASS'}) WITH 'v1' 'v2'.</code></p>
        </div>
      )}
    </ViewShell>
  )
}

// ── SE93 Transaction registry ──────────────────────────────────────────
interface TxDto { code: string; program: string; description: string }

export function TransactionsView() {
  const [items, setItems] = useState<TxDto[] | null>(null)
  const [code, setCode] = useState('')
  const [program, setProgram] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const owner = useWorkbench((s) => s.session.owner)

  const refresh = useCallback(() => {
    api<{ transactions: TxDto[] }>('/api/transactions')
      .then((r) => setItems(r.transactions))
      .catch(() => setItems([]))
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const save = async () => {
    setBusy(true)
    try {
      await api('/api/transactions', { method: 'POST', body: JSON.stringify({ code, program, description: desc }) })
      setMsg({ kind: 'ok', text: `Transaction ${code.toUpperCase()} registered — type it in the command field to run ${program.toUpperCase()}` })
      setCode(''); setProgram(''); setDesc('')
      refresh()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (c: string) => {
    await api(`/api/transactions?code=${encodeURIComponent(c)}`, { method: 'DELETE' }).catch(() => null)
    refresh()
  }

  return (
    <ViewShell
      title="Transaction Code Registry (SE93)"
      subtitle="Register a transaction that starts a customer report — then run it from the command field"
      msg={msg}
    >
      <div className="mb-3 rounded-none border border-[#c6d7e6] bg-white px-4 py-3">
        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="tx-code">Transaction code</label>
          <input id="tx-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ZRUN_REPORT" className="h-[26px] w-full max-w-[280px] rounded-none border border-[#c6d7e6] px-2 font-mono text-[12px] uppercase outline-none focus:border-[#0a6ed1]" />
          <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="tx-program">Report</label>
          <input id="tx-program" value={program} onChange={(e) => setProgram(e.target.value.toUpperCase())} placeholder="Z_MY_REPORT (must exist in SE38)" className="h-[26px] w-full max-w-[280px] rounded-none border border-[#c6d7e6] px-2 font-mono text-[12px] uppercase outline-none focus:border-[#0a6ed1]" />
          <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="tx-desc">Description</label>
          <input id="tx-desc" value={desc} onChange={(e) => setDesc(e.target.value)} className="h-[26px] w-full max-w-[520px] rounded-none border border-[#c6d7e6] px-2 text-[12px] outline-none focus:border-[#0a6ed1]" />
        </div>
        {owner && <button type="button" className="sap-btn sap-btn-primary mt-2" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Register'}</button>}
      </div>
      <TableList
        empty="No customer transactions registered yet."
        rows={(items ?? []).map((t) => ({ key: t.code, cells: [t.code, t.program, t.description] }))}
        headers={['Code', 'Report', 'Description']}
        onDelete={owner ? (key) => void remove(key) : undefined}
      />
    </ViewShell>
  )
}

// ── SNRO Number ranges ─────────────────────────────────────────────────
interface RangeDto { object: string; shortText: string; fromNumber: number; toNumber: number; currentNumber: number; remaining: number }

export function NumberRangesView() {
  const [items, setItems] = useState<RangeDto[] | null>(null)
  const [object, setObject] = useState('')
  const [shortText, setShortText] = useState('')
  const [from, setFrom] = useState('1')
  const [to, setTo] = useState('1000')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const owner = useWorkbench((s) => s.session.owner)

  const refresh = useCallback(() => {
    api<{ ranges: RangeDto[] }>('/api/number-ranges')
      .then((r) => setItems(r.ranges))
      .catch(() => setItems([]))
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const save = async () => {
    setBusy(true)
    try {
      await api('/api/number-ranges', { method: 'POST', body: JSON.stringify({ object, shortText, fromNumber: Number(from), toNumber: Number(to) }) })
      setMsg({ kind: 'ok', text: `Number range ${object.toUpperCase()} saved — get numbers with CALL FUNCTION 'NUMBER_GET_NEXT'` })
      refresh()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (o: string) => {
    await api(`/api/number-ranges?object=${encodeURIComponent(o)}`, { method: 'DELETE' }).catch(() => null)
    refresh()
  }

  return (
    <ViewShell
      title="Number Range Objects (SNRO)"
      subtitle="ABAP draws numbers with CALL FUNCTION 'NUMBER_GET_NEXT' EXPORTING object = '…' nr_range_nr = '01'"
      msg={msg}
    >
      <div className="mb-3 rounded-none border border-[#c6d7e6] bg-white px-4 py-3">
        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="nr-object">Object</label>
          <input id="nr-object" value={object} onChange={(e) => setObject(e.target.value.toUpperCase())} placeholder="ZTRAIN_ORDER" className="h-[26px] w-full max-w-[280px] rounded-none border border-[#c6d7e6] px-2 font-mono text-[12px] uppercase outline-none focus:border-[#0a6ed1]" />
          <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="nr-text">Short text</label>
          <input id="nr-text" value={shortText} onChange={(e) => setShortText(e.target.value)} className="h-[26px] w-full max-w-[520px] rounded-none border border-[#c6d7e6] px-2 text-[12px] outline-none focus:border-[#0a6ed1]" />
          <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="nr-from">Interval from</label>
          <input id="nr-from" value={from} onChange={(e) => setFrom(e.target.value)} className="h-[26px] w-24 rounded-none border border-[#c6d7e6] px-2 text-right font-mono text-[12px] outline-none focus:border-[#0a6ed1]" />
          <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="nr-to">to</label>
          <input id="nr-to" value={to} onChange={(e) => setTo(e.target.value)} className="h-[26px] w-24 rounded-none border border-[#c6d7e6] px-2 text-right font-mono text-[12px] outline-none focus:border-[#0a6ed1]" />
        </div>
        {owner && <button type="button" className="sap-btn sap-btn-primary mt-2" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save interval'}</button>}
      </div>
      <TableList
        empty="No number range objects yet."
        rows={(items ?? []).map((r) => ({ key: r.object, cells: [r.object, r.shortText, `${r.fromNumber}–${r.toNumber}`, String(r.currentNumber), String(r.remaining)] }))}
        headers={['Object', 'Short text', 'Interval', 'Current', 'Free']}
        onDelete={owner ? (key) => void remove(key) : undefined}
      />
    </ViewShell>
  )
}

// ── AL11 Application server files ──────────────────────────────────────
interface FileDto { path: string; size: number; updatedAt: string }

export function Al11View() {
  const [files, setFiles] = useState<FileDto[] | null>(null)
  const [content, setContent] = useState<{ path: string; content: string } | null>(null)
  const [newPath, setNewPath] = useState('/tmp/training/demo.txt')
  const [newContent, setNewContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const owner = useWorkbench((s) => s.session.owner)

  const refresh = useCallback(() => {
    api<{ files: FileDto[] }>('/api/appserver/files')
      .then((r) => setFiles(r.files))
      .catch(() => setFiles([]))
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const openFile = async (path: string) => {
    try {
      const r = await api<{ path: string; content: string }>(`/api/appserver/files?path=${encodeURIComponent(path)}`)
      setContent(r)
    } catch {
      setContent(null)
    }
  }

  const upload = async () => {
    setBusy(true)
    try {
      await api('/api/appserver/files', { method: 'POST', body: JSON.stringify({ path: newPath, content: newContent }) })
      setMsg({ kind: 'ok', text: `File ${newPath} written — ABAP can read it with OPEN DATASET / READ DATASET` })
      setNewContent('')
      refresh()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Upload failed' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (path: string) => {
    await api(`/api/appserver/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' }).catch(() => null)
    setContent(null)
    refresh()
  }

  return (
    <ViewShell
      title="Application Server Directory (AL11)"
      subtitle="Files ABAP reads with OPEN DATASET / READ DATASET. Owner uploads via CG3Z, downloads via CG3Y."
      onBack={content ? () => setContent(null) : undefined}
      msg={msg}
    >
      {content ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-none border border-[#c6d7e6] bg-white px-3 py-2 font-mono text-[12px] font-bold text-[#17324a]">
            {content.path}
            {owner && <button type="button" className="sap-btn ml-auto" onClick={() => void remove(content.path)}><Trash2 className="h-3.5 w-3.5" />Delete</button>}
          </div>
          <pre className="wb-scroll max-h-[50vh] overflow-auto rounded-none border border-[#c6d7e6] bg-white p-3 font-mono text-[12px] text-[#17324a]">{content.content || '(empty file)'}</pre>
        </div>
      ) : (
        <div className="space-y-3">
          <TableList
            empty="No application server files yet — upload one below (CG3Z) or have ABAP write one."
            rows={(files ?? []).map((f) => ({ key: f.path, cells: [f.path, `${f.size} bytes`, new Date(f.updatedAt).toLocaleString()] }))}
            headers={['Path', 'Size', 'Changed']}
            onOpen={(key) => void openFile(key)}
            onDelete={owner ? (key) => void remove(key) : undefined}
          />
          {owner && (
            <div className="rounded-none border border-[#c6d7e6] bg-white px-4 py-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#44586c]">Upload file to the application server (CG3Z)</div>
              <input value={newPath} onChange={(e) => setNewPath(e.target.value)} className="h-[26px] w-full max-w-[420px] rounded-none border border-[#c6d7e6] px-2 font-mono text-[12px] outline-none focus:border-[#0a6ed1]" aria-label="Target path" placeholder="/tmp/training/demo.txt" />
              <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={4} className="mt-2 w-full rounded-none border border-[#c6d7e6] p-2 font-mono text-[12px] outline-none focus:border-[#0a6ed1]" aria-label="File content" placeholder="one line per ABAP READ DATASET" />
              <button type="button" className="sap-btn sap-btn-primary mt-2" disabled={busy} onClick={() => void upload()}>{busy ? 'Uploading…' : 'Write file'}</button>
            </div>
          )}
        </div>
      )}
    </ViewShell>
  )
}

// ── SM59 RFC destinations ──────────────────────────────────────────────
interface RfcDto { name: string; description: string; target: string }

export function RfcView() {
  const [items, setItems] = useState<RfcDto[] | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const owner = useWorkbench((s) => s.session.owner)

  const refresh = useCallback(() => {
    api<{ destinations: RfcDto[] }>('/api/rfc-destinations')
      .then((r) => setItems(r.destinations))
      .catch(() => setItems([]))
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const save = async () => {
    setBusy(true)
    try {
      await api('/api/rfc-destinations', { method: 'POST', body: JSON.stringify({ name, description: desc, target }) })
      setMsg({ kind: 'ok', text: `RFC destination ${name.toUpperCase()} saved — CALL FUNCTION ... DESTINATION '${name.toUpperCase()}' validates against it` })
      refresh()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (n: string) => {
    await api(`/api/rfc-destinations?name=${encodeURIComponent(n)}`, { method: 'DELETE' }).catch(() => null)
    refresh()
  }

  const test = async (n: string) => {
    try {
      const r = await api<{ test: { message: string } }>(`/api/rfc-destinations?name=${encodeURIComponent(n)}`)
      setMsg({ kind: 'ok', text: `${n}: ${r.test.message}` })
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Test failed' })
    }
  }

  return (
    <ViewShell
      title="RFC Destinations (SM59)"
      subtitle="Register logical destinations; CALL FUNCTION '…' DESTINATION '…' checks them at runtime (simulated connection)"
      msg={msg}
    >
      <div className="mb-3 rounded-none border border-[#c6d7e6] bg-white px-4 py-3">
        <div className="grid grid-cols-[140px_1fr] items-center gap-2">
          <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="rfc-name">Destination</label>
          <input id="rfc-name" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="PRODSYS" className="h-[26px] w-full max-w-[280px] rounded-none border border-[#c6d7e6] px-2 font-mono text-[12px] uppercase outline-none focus:border-[#0a6ed1]" />
          <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="rfc-desc">Description</label>
          <input id="rfc-desc" value={desc} onChange={(e) => setDesc(e.target.value)} className="h-[26px] w-full max-w-[520px] rounded-none border border-[#c6d7e6] px-2 text-[12px] outline-none focus:border-[#0a6ed1]" />
          <label className="text-[12px] font-semibold text-[#44586c]" htmlFor="rfc-target">Target</label>
          <input id="rfc-target" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="logical target (simulated)" className="h-[26px] w-full max-w-[420px] rounded-none border border-[#c6d7e6] px-2 text-[12px] outline-none focus:border-[#0a6ed1]" />
        </div>
        {owner && <button type="button" className="sap-btn sap-btn-primary mt-2" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>}
      </div>
      <TableList
        empty="No RFC destinations registered yet."
        rows={(items ?? []).map((d) => ({ key: d.name, cells: [d.name, d.description, d.target] }))}
        headers={['Destination', 'Description', 'Target']}
        onOpen={undefined}
        onDelete={owner ? (key) => void remove(key) : undefined}
        extraAction={(key) => (
          <button type="button" className="sap-btn" onClick={() => void test(key)}>Test</button>
        )}
      />
    </ViewShell>
  )
}

// ── shared list + shell helpers ────────────────────────────────────────
export function ViewShell(props: { title: string; subtitle: string; onBack?: () => void; action?: React.ReactNode; msg?: { kind: 'ok' | 'err'; text: string } | null; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#ebf1f7]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#c6d7e6] bg-white px-4 py-2.5">
        {props.title.includes('SE91') && <FileText className="h-5 w-5 text-[#8a6d1a]" />}
        {props.title.includes('SE93') && <Hash className="h-5 w-5 text-[#8a6d1a]" />}
        {props.title.includes('AL11') && <RefreshCw className="h-5 w-5 text-[#8a6d1a]" />}
        {props.title.includes('Number Range') && <Hash className="h-5 w-5 text-[#8a6d1a]" />}
        {props.title.includes('RFC') && <RefreshCw className="h-5 w-5 text-[#8a6d1a]" />}
        <div>
          <h1 className="text-[14px] font-bold text-[#17324a]">{props.title}</h1>
          <p className="text-[11.5px] text-[#55677a]">{props.subtitle}</p>
        </div>
        {props.action && <div className="ml-auto">{props.action}</div>}
      </div>
      {props.msg && (
        <div className={`px-4 py-1.5 text-[12px] ${props.msg.kind === 'ok' ? 'border-b border-[#cfe3cf] bg-[#eef7ee] text-[#22632a]' : 'border-b border-[#e6c9c9] bg-[#f9eeee] text-[#8a2222]'}`} role="status">
          {props.msg.text}
        </div>
      )}
      <div className="wb-scroll min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-[1000px]">
          {props.children}
        </div>
      </div>
    </div>
  )
}

export function TableList(props: {
  headers: string[]
  rows: { key: string; cells: string[] }[]
  empty: string
  onOpen?: (key: string) => void
  onDelete?: (key: string) => void
  extraAction?: (key: string) => React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-none border border-[#c6d7e6] bg-white">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="alv-grid">
            {props.headers.map((h) => (
              <th key={h} className="px-3 py-1.5 text-left text-[11.5px]">{h}</th>
            ))}
            <th className="w-24 px-2 py-1.5 text-right text-[11.5px]" />
          </tr>
        </thead>
        <tbody>
          {props.rows.length === 0 && (
            <tr><td colSpan={props.headers.length + 1} className="px-4 py-6 text-center text-[12.5px] text-[#55677a]">{props.empty}</td></tr>
          )}
          {props.rows.map((r) => (
            <tr key={r.key} className={`border-b border-[#eef3f8] ${props.onOpen ? 'cursor-pointer hover:bg-[#e8f1fa]' : ''}`} onClick={() => props.onOpen?.(r.key)}>
              {r.cells.map((c, i) => (
                <td key={i} className={`px-3 py-1.5 ${i === 0 ? 'font-mono font-bold text-[#0a3d73]' : 'text-[#44586c]'}`}>{c}</td>
              ))}
              <td className="px-2 py-1.5 text-right">
                <span className="inline-flex items-center gap-1.5">
                  {props.extraAction?.(r.key)}
                  {props.onDelete && (
                    <button type="button" className="text-[#a33] hover:text-[#c33]" onClick={(e) => { e.stopPropagation(); props.onDelete?.(r.key) }} aria-label={`Delete ${r.key}`} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
