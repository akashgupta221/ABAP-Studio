'use client'

// ── SAP selection screen (REQUIRES_INPUT flow) — full dynpro screen ────
import { useEffect, useState } from 'react'
import { useWorkbench } from './use-workbench'
import type { ParamSpec, SelectionScreenItem, SelectOptionSpec } from './types'

/** Build default values for a selection screen (pure function). */
function computeInitialValues(items: SelectionScreenItem[]) {
  const vals: Record<string, string | string[]> = {}
  const radioChecked: Record<string, string> = {}
  for (const it of items) {
    if (it.kind === 'param') {
      if (it.radioGroup) {
        const firstOfGroup =
          items.find(
            (o) => o.kind === 'param' && o.radioGroup === it.radioGroup && o.defaultValue,
          ) ?? null
        if (firstOfGroup && firstOfGroup.name === it.name) {
          vals[it.name] = 'X'
          radioChecked[it.radioGroup] = it.name
        } else {
          vals[it.name] = ''
        }
      } else if (it.asCheckbox) {
        vals[it.name] = it.defaultValue === 'X' ? 'X' : ''
      } else {
        vals[it.name] = it.defaultValue ?? ''
      }
    } else {
      vals[it.name] = [it.defaultValue ?? '', it.defaultValueHigh ?? '']
    }
  }
  return { vals, radioChecked }
}

export function SelectionScreen() {
  const pending = useWorkbench((s) => s.pendingSelection)
  const busy = useWorkbench((s) => s.selectionBusy)
  const submitSelection = useWorkbench((s) => s.submitSelection)
  const cancelSelection = useWorkbench((s) => s.cancelSelection)
  const programTitle = useWorkbench((s) =>
    pending ? s.programs[pending.programName]?.title : undefined,
  )

  const items = pending?.items ?? []
  const currentKey = pending ? `${pending.programName}#${items.map((i) => i.name).join(',')}` : ''

  const [values, setValues] = useState<Record<string, string | string[]>>(() =>
    computeInitialValues(useWorkbench.getState().pendingSelection?.items ?? []).vals,
  )
  const [radioChecked, setRadioChecked] = useState<Record<string, string>>(() =>
    computeInitialValues(useWorkbench.getState().pendingSelection?.items ?? []).radioChecked,
  )
  const [lastKey, setLastKey] = useState(currentKey)

  // adjust state during render when a NEW selection screen arrives
  if (currentKey !== lastKey) {
    setLastKey(currentKey)
    const fresh = computeInitialValues(items)
    setValues(fresh.vals)
    setRadioChecked(fresh.radioChecked)
  }

  const paramString = (p: ParamSpec): string => (values[p.name] as string) ?? ''
  const seloptArray = (s: SelectOptionSpec): string[] => (values[s.name] as string[]) ?? ['', '']

  const setParam = (name: string, v: string) => setValues((old) => ({ ...old, [name]: v }))
  const setSelopt = (name: string, idx: 0 | 1, v: string) =>
    setValues((old) => {
      const arr = [...((old[name] as string[]) ?? ['', ''])]
      arr[idx] = v
      return { ...old, [name]: arr }
    })

  const buildParameters = (): Record<string, string | string[]> => {
    const parameters: Record<string, string | string[]> = {}
    for (const it of items) {
      if (it.kind === 'param') {
        if (it.radioGroup) {
          parameters[it.name] = radioChecked[it.radioGroup] === it.name ? 'X' : ''
        } else {
          parameters[it.name] = paramString(it)
        }
      } else {
        const [lo, hi] = seloptArray(it)
        parameters[it.name] = hi ? [lo, hi] : lo ? [lo] : []
      }
    }
    return parameters
  }

  const submit = () => {
    if (!pending) return
    // obligatory check — SAP refuses execution with a red status message
    const missing = items.filter(
      (it) => it.kind === 'param' && it.obligatory && !it.asCheckbox && !it.radioGroup && !paramString(it).trim(),
    )
    if (missing.length > 0) {
      useWorkbench.getState().addMessage('E', `Fill all required fields (${missing.map((m) => m.name).join(', ')})`)
      return
    }
    void submitSelection(buildParameters())
  }

  // F8 = Execute · F12 = Cancel (SAP keyboard semantics)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F8' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        submit()
      } else if (e.key === 'F12') {
        e.preventDefault()
        e.stopPropagation()
        cancelSelection()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  })

  if (!pending) return null

  return (
    <div className="sap-screen flex h-full min-h-0 flex-col overflow-auto">
      <div className="w-full max-w-[980px] px-8 py-5">
        {/* screen caption: program + program title */}
        <div className="font-mono text-[12px] text-[#44586c]">{pending.programName}</div>
        <h2 className="mt-0.5 text-[15px] font-bold text-[#17324a]">
          {programTitle || `${pending.programName} — Selection Screen`}
        </h2>

        {/* SAP places the action buttons at the TOP of selection screens */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="sap-btn sap-btn-default min-w-[130px]"
            onClick={submit}
            disabled={busy}
          >
            {busy ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#4d7398] border-t-transparent" />
            ) : null}
            Execute (F8)
          </button>
          <button type="button" className="sap-btn" onClick={cancelSelection} disabled={busy}>
            Cancel (F12)
          </button>
        </div>

        {/* parameter block */}
        <div className="mt-5">
          {items.map((it) => {
            if (it.kind === 'param') {
              const p = it as ParamSpec
              if (p.radioGroup) {
                return (
                  <div key={p.name} className="mb-[3px] flex items-center">
                    <div className="w-[300px] shrink-0 pr-2 text-right text-[12.5px] text-[#17324a]">
                      {p.label || p.name}
                    </div>
                    <input
                      type="radio"
                      name={`rad-${p.radioGroup}`}
                      id={`rad-${p.name}`}
                      className="sap-radio"
                      checked={radioChecked[p.radioGroup] === p.name}
                      onChange={() => setRadioChecked((old) => ({ ...old, [p.radioGroup as string]: p.name }))}
                    />
                    <span className="pl-1.5 font-mono text-[12.5px] text-[#22364b]">{p.name}</span>
                  </div>
                )
              }
              if (p.asCheckbox) {
                return (
                  <div key={p.name} className="mb-[3px] flex items-center">
                    <div className="w-[300px] shrink-0 pr-2 text-right text-[12.5px] text-[#17324a]">
                      {p.label || p.name}
                    </div>
                    <input
                      type="checkbox"
                      id={`chk-${p.name}`}
                      className="sap-checkbox"
                      checked={paramString(p) === 'X'}
                      onChange={(e) => setParam(p.name, e.target.checked ? 'X' : '')}
                    />
                    <span className="pl-1.5 font-mono text-[12.5px] text-[#22364b]">{p.name}</span>
                  </div>
                )
              }
              return (
                <div key={p.name} className="mb-[3px] flex items-center">
                  <label
                    htmlFor={`par-${p.name}`}
                    className="w-[300px] shrink-0 pr-2 text-right text-[12.5px] text-[#17324a]"
                  >
                    {p.obligatory && <span className="pr-1 text-[#b00000]">*</span>}
                    {p.label || p.name}
                  </label>
                  <input
                    id={`par-${p.name}`}
                    value={paramString(p)}
                    onChange={(e) => setParam(p.name, e.target.value)}
                    className="sap-field w-[180px] font-mono"
                    spellCheck={false}
                  />
                </div>
              )
            }
            const so = it as SelectOptionSpec
            const [lo, hi] = seloptArray(so)
            return (
              <div key={so.name} className="mb-[3px] flex items-center">
                <label
                  htmlFor={`so-lo-${so.name}`}
                  className="w-[300px] shrink-0 pr-2 text-right text-[12.5px] text-[#17324a]"
                >
                  {so.label || so.name}
                </label>
                <input
                  id={`so-lo-${so.name}`}
                  value={lo}
                  onChange={(e) => setSelopt(so.name, 0, e.target.value)}
                  className="sap-field w-[180px] font-mono"
                  placeholder="low"
                  spellCheck={false}
                />
                <span className="px-1.5 text-[12.5px] text-[#44586c]">to</span>
                <input
                  value={hi}
                  onChange={(e) => setSelopt(so.name, 1, e.target.value)}
                  className="sap-field w-[180px] font-mono"
                  placeholder="high"
                  spellCheck={false}
                  aria-label={`${so.name} high value`}
                />
              </div>
            )
          })}
          {items.length === 0 && (
            <p className="py-2 text-[12.5px] text-[#55677a]">No selection parameters.</p>
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-[#c6d7e6] px-6 py-1 font-mono text-[11px] text-[#55677a]">
        Selection screen · {pending.programName} · F8 Execute · F12 Cancel · PARAMETERS / SELECT-OPTIONS
      </div>
    </div>
  )
}
