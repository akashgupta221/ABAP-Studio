'use client'

// ── SAP status bar (bottom, always visible) ───────────────────────────
import { AlertOctagon, AlertTriangle, CircleCheck, Info, OctagonAlert } from 'lucide-react'
import { useWorkbench } from './use-workbench'
import type { MessageType } from './types'

function msgIcon(type: MessageType) {
  switch (type) {
    case 'S':
      return <CircleCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />
    case 'E':
      return <AlertOctagon className="h-3.5 w-3.5 shrink-0 text-red-600" />
    case 'W':
      return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-600" />
    case 'A':
      return <OctagonAlert className="h-3.5 w-3.5 shrink-0 text-red-700" />
    default:
      return <Info className="h-3.5 w-3.5 shrink-0 text-sky-600" />
  }
}

export function StatusBar() {
  const messages = useWorkbench((s) => s.messages)
  const lastTcode = useWorkbench((s) => s.lastTcode)
  const outputs = useWorkbench((s) => s.outputs)
  const running = useWorkbench((s) =>
    Object.values(s.programs).some((p) => p.running),
  )

  const last = messages[messages.length - 1]
  const lastDuration = Object.values(outputs).at(-1)?.durationMs

  return (
    <footer
      className="sap-statusbar flex h-7 shrink-0 items-center justify-between gap-2 px-2 text-[11.5px] text-[#2c3f53]"
      role="status"
      aria-label="Status bar"
    >
      {/* message area */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {running && (
          <span className="flex items-center gap-1.5 text-[#0a6ed1]">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#0a6ed1] border-t-transparent" />
            Running…
          </span>
        )}
        {!running && last && (
          <>
            {msgIcon(last.msgType)}
            <span
              className={`truncate ${
                last.msgType === 'E' || last.msgType === 'A'
                  ? 'text-red-700'
                  : last.msgType === 'W'
                    ? 'text-yellow-700'
                    : 'text-[#2c3f53]'
              }`}
              title={last.text}
            >
              {last.text}
            </span>
          </>
        )}
        {!running && !last && <span className="truncate text-[#6b7c8f]">Ready</span>}
      </div>

      {/* right: system info */}
      <div className="flex shrink-0 items-center gap-2 font-medium">
        {typeof lastDuration === 'number' && (
          <span className="hidden sm:inline" title="Last response time">
            {lastDuration} ms
          </span>
        )}
        <span className="hidden h-3.5 w-px bg-[#b0c0d4] sm:block" aria-hidden />
        <span title="Insert mode">INS</span>
        <span className="h-3.5 w-px bg-[#b0c0d4]" aria-hidden />
        <span title="Current transaction" className="font-mono">
          {lastTcode}
        </span>
        <span className="h-3.5 w-px bg-[#b0c0d4]" aria-hidden />
        <span title="Client">100</span>
        <span className="h-3.5 w-px bg-[#b0c0d4]" aria-hidden />
        <span title="System">ABF</span>
        <span className="h-3.5 w-px bg-[#b0c0d4]" aria-hidden />
        <span title="User">DEVELOPER</span>
      </div>
    </footer>
  )
}
