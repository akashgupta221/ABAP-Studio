'use client'

// ── Firefox-style WebGUI frame ────────────────────────────────────────
// The SAP workbench is presented as a browser page, matching the classic
// WebGUI training reference. This is chrome only: navigation still runs
// through the existing workbench store, auth and APIs.
import { ArrowLeft, ArrowRight, Home, Plus, RotateCw, ShieldCheck } from 'lucide-react'

export function BrowserFrame({
  title,
  onBack,
  onHome,
  onReload,
}: {
  title: string
  onBack: () => void
  onHome: () => void
  onReload: () => void
}) {
  return (
    <div
      className="hidden shrink-0 flex-col bg-[#1c1b22] text-[#e7e7ee] md:flex"
      data-testid="browser-frame"
      aria-label="Simulated WebGUI browser frame"
    >
      {/* Firefox-style menu strip */}
      <div className="flex h-[25px] items-center gap-3 px-3 text-[10.5px] text-[#b9b8c4]">
        <span className="flex items-center gap-1.5 font-semibold text-[#e7e7ee]">
          <span className="inline-flex h-[13px] w-[13px] items-center justify-center rounded-full bg-[#ff7a1a] text-[8px] font-black text-white">F</span>
          Firefox
        </span>
        <span className="hidden lg:inline">File</span>
        <span className="hidden lg:inline">Edit</span>
        <span className="hidden lg:inline">View</span>
        <span className="hidden lg:inline">History</span>
        <span className="hidden lg:inline">Bookmarks</span>
        <span className="hidden lg:inline">Tools</span>
        <span className="hidden lg:inline">Help</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="rounded-[2px] bg-[#33323c] px-1.5 py-[1px] text-[9px] uppercase tracking-wide text-[#a9a8b5]">Simulated</span>
          <span className="hidden sm:inline">SAP WebGUI training system</span>
        </span>
      </div>

      {/* tab strip + navigation */}
      <div className="bg-[#2b2a33] px-2 pt-1">
        <div className="flex items-end gap-1">
          <div className="flex h-[30px] max-w-[310px] items-center gap-2 rounded-t-[5px] bg-[#f9f9fb] px-3 text-[#24232b] shadow-[0_-1px_0_rgba(255,255,255,0.1)]">
            <span className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[2px] bg-[#0a6ed1] text-[7px] font-black leading-none text-white">SAP</span>
            <span className="truncate text-[11.5px] font-medium">{title || 'SAP Easy Access'}</span>
            <span className="ml-1 h-2 w-2 shrink-0 rounded-full bg-[#8a8996]" aria-hidden />
          </div>
          <button
            type="button"
            onClick={() => window.open('/', '_blank', 'noopener,noreferrer')}
            className="mb-[5px] flex h-[24px] w-[24px] items-center justify-center rounded-[4px] text-[#c7c6d2] hover:bg-[#3b3a44] hover:text-white"
            title="Open a new SAP session in a browser tab"
            aria-label="Open a new SAP session"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex h-[38px] items-center gap-1.5 bg-[#f9f9fb] px-3 text-[#3b3a44] shadow-[0_1px_0_rgba(0,0,0,0.12)]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-[27px] w-[27px] items-center justify-center rounded-full hover:bg-[#e5e5eb]"
          title="Back (F3)"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled
          className="flex h-[27px] w-[27px] items-center justify-center rounded-full opacity-35"
          title="Forward"
          aria-label="Forward"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onReload}
          className="flex h-[27px] w-[27px] items-center justify-center rounded-full hover:bg-[#e5e5eb]"
          title="Reload the workbench"
          aria-label="Reload"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onHome}
          className="flex h-[27px] w-[27px] items-center justify-center rounded-full hover:bg-[#e5e5eb]"
          title="SAP Easy Access"
          aria-label="SAP Easy Access"
        >
          <Home className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1 flex h-[27px] min-w-0 flex-1 items-center gap-2 rounded-[5px] border border-[#d2d1da] bg-white px-2 text-[11.5px] text-[#4a4954]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#287a3b]" aria-hidden />
          <span className="truncate font-mono text-[10.5px] text-[#6a6975]" title="Simulated SAP WebGUI address">
            merida.cob.csuchico.edu:8038/sap/bc/gui/sap/its/webgui?~transaction=SESSION_MANAGER
          </span>
          <span className="ml-auto hidden shrink-0 rounded-[2px] bg-[#edf6ee] px-1 text-[9px] font-semibold text-[#287a3b] lg:inline">secure</span>
        </div>

        <span className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-[#0a6ed1] text-[10px] font-bold text-white" title="SAP WebGUI session" aria-hidden>
          S
        </span>
      </div>
    </div>
  )
}
