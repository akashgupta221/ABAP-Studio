'use client'

// ── SAP Selection Screen dialog (REQUIRES_INPUT flow) ─────────────────
import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
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

export function SelectionScreenDialog() {
  const pending = useWorkbench((s) => s.pendingSelection)
  const busy = useWorkbench((s) => s.selectionBusy)
  const submitSelection = useWorkbench((s) => s.submitSelection)
  const cancelSelection = useWorkbench((s) => s.cancelSelection)

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

  if (!pending) return null

  const paramString = (p: ParamSpec): string => (values[p.name] as string) ?? ''
  const seloptArray = (s: SelectOptionSpec): string[] => (values[s.name] as string[]) ?? ['', '']

  const setParam = (name: string, v: string) => setValues((old) => ({ ...old, [name]: v }))
  const setSelopt = (name: string, idx: 0 | 1, v: string) =>
    setValues((old) => {
      const arr = [...(((old[name] as string[]) ?? ['', '']))]
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

  const onOpenChange = (open: boolean) => {
    if (!open) cancelSelection()
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] gap-0 overflow-hidden border-[#7f9db9] p-0" aria-describedby="sel-desc">
        <DialogHeader className="sap-titlebar px-4 py-2 text-left">
          <DialogTitle className="font-mono text-[14px] font-semibold text-white">
            {pending.programName} — Selection Screen
          </DialogTitle>
          <DialogDescription id="sel-desc" className="text-[11.5px] text-[#cfe2f5]">
            Enter selection parameters and execute
          </DialogDescription>
        </DialogHeader>

        <div className="sap-selscreen max-h-[55vh] overflow-y-auto p-4">
          <div className="space-y-2.5">
            {items.map((it) => {
              if (it.kind === 'param') {
                const p = it as ParamSpec
                if (p.radioGroup) {
                  return (
                    <div key={p.name} className="flex items-center justify-end gap-3">
                      <Label
                        htmlFor={`rad-${p.name}`}
                        className="flex w-[240px] items-center justify-end gap-1 text-right text-[12.5px] font-medium text-[#1c2f43]"
                      >
                        {p.obligatory && <span className="text-red-600">*</span>}
                        {p.label || p.name}
                      </Label>
                      <div className="w-[220px]">
                        <div className="flex h-[28px] items-center gap-2 border border-[#aab8c8] bg-white px-2">
                          <RadioGroup
                            value={radioChecked[p.radioGroup] ?? ''}
                            onValueChange={(v) =>
                              setRadioChecked((old) => ({ ...old, [p.radioGroup as string]: v }))
                            }
                            className="flex"
                          >
                            <div className="flex h-[26px] w-[26px] items-center justify-center">
                              <RadioGroupItem value={p.name} id={`rad-${p.name}`} />
                            </div>
                          </RadioGroup>
                          <span className="font-mono text-[12.5px] text-[#22364b]">{p.name}</span>
                        </div>
                      </div>
                    </div>
                  )
                }
                if (p.asCheckbox) {
                  return (
                    <div key={p.name} className="flex items-center justify-end gap-3">
                      <Label
                        htmlFor={`chk-${p.name}`}
                        className="w-[240px] text-right text-[12.5px] font-medium text-[#1c2f43]"
                      >
                        {p.label || p.name}
                      </Label>
                      <div className="w-[220px] border border-[#aab8c8] bg-white px-2">
                        <div className="flex h-[26px] items-center gap-2">
                          <Checkbox
                            id={`chk-${p.name}`}
                            checked={paramString(p) === 'X'}
                            onCheckedChange={(v) => setParam(p.name, v ? 'X' : '')}
                          />
                          <span className="font-mono text-[12.5px] text-[#22364b]">{p.name}</span>
                        </div>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={p.name} className="flex items-center justify-end gap-3">
                    <Label
                      htmlFor={`par-${p.name}`}
                      className="flex w-[240px] items-center justify-end gap-1 text-right text-[12.5px] font-medium text-[#1c2f43]"
                    >
                      {p.obligatory && <span className="text-red-600">*</span>}
                      {p.label || p.name}
                    </Label>
                    <Input
                      id={`par-${p.name}`}
                      value={paramString(p)}
                      onChange={(e) => setParam(p.name, e.target.value)}
                      className="h-[28px] w-[220px] rounded-[2px] border-[#aab8c8] bg-white font-mono text-[12.5px]"
                    />
                  </div>
                )
              }
              const so = it as SelectOptionSpec
              const [lo, hi] = seloptArray(so)
              return (
                <div key={so.name} className="flex items-center justify-end gap-3">
                  <Label
                    htmlFor={`so-lo-${so.name}`}
                    className="w-[240px] text-right text-[12.5px] font-medium text-[#1c2f43]"
                  >
                    {so.label || so.name}
                  </Label>
                  <div className="flex w-[220px] items-center gap-1">
                    <Input
                      id={`so-lo-${so.name}`}
                      value={lo}
                      onChange={(e) => setSelopt(so.name, 0, e.target.value)}
                      className="h-[28px] w-full rounded-[2px] border-[#aab8c8] bg-white font-mono text-[12.5px]"
                      placeholder="low"
                    />
                    <Input
                      value={hi}
                      onChange={(e) => setSelopt(so.name, 1, e.target.value)}
                      className="h-[28px] w-full rounded-[2px] border-[#aab8c8] bg-white font-mono text-[12.5px]"
                      placeholder="high"
                      aria-label={`${so.name} high value`}
                    />
                  </div>
                </div>
              )
            })}
            {items.length === 0 && (
              <p className="text-center text-sm text-[#5b6d80]">No selection parameters.</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-2 border-t border-[#b8c7da] bg-[#e8eef6] px-4 py-2.5">
          <span className="mr-auto font-mono text-[11px] text-[#5b6d80]">
            PARAMETERS / SELECT-OPTIONS detected
          </span>
          <SelectionF8Shortcut onF8={submit} disabled={busy} />
          <button
            type="button"
            className="sap-btn sap-btn-primary min-w-[130px]"
            onClick={submit}
            disabled={busy}
          >
            {busy ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Execute (F8)
          </button>
          <button type="button" className="sap-btn" onClick={cancelSelection} disabled={busy}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Registers F8 → submit while the selection screen is open. */
function SelectionF8Shortcut({ onF8, disabled }: { onF8: () => void; disabled: boolean }) {
  useEffect(() => {
    if (disabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault()
        e.stopPropagation()
        onF8()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  })
  return null
}
