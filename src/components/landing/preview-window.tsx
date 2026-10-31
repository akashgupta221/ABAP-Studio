'use client'

// Static miniature of the signed-in dashboard used in the landing "workspace
// preview" section — same layout language as the real dashboard, drawn with
// plain markup so the marketing page stays dependency-light.

import { BrandMark } from '@/components/brand-mark'

const NAV = ['Dashboard', 'My Programs', 'Curriculum', 'Modern ABAP', 'Workbench']
const ROWS = [
  { name: 'Z_SALES_REPORT', type: 'REPORT', when: '2 h ago' },
  { name: 'Z_CLS_INVENTORY', type: 'CLASS', when: 'yesterday' },
  { name: 'Z_FLIGHT_UPDATE', type: 'REPORT', when: '3 d ago' },
]

export function PreviewWindow() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-2xl border border-[#1c4a7c] bg-white text-left shadow-2xl shadow-black/40"
    >
      {/* window bar */}
      <div className="flex items-center gap-2.5 border-b border-[#123a63] bg-[#0b2b52] px-4 py-2.5">
        <BrandMark size={24} rounded="rounded-md" />
        <span className="text-[12px] font-semibold text-[#e8f1fa]">ABAP Atelier — Dashboard</span>
        <span className="ml-auto hidden font-mono text-[9px] uppercase tracking-[0.14em] text-[#9dbde0] sm:inline">
          System MER · Client 105
        </span>
        <span className="h-6 w-6 rounded-full bg-[#6cb6f5]" />
      </div>

      <div className="flex">
        {/* sidebar */}
        <div className="hidden w-36 shrink-0 flex-col gap-0.5 border-r border-[#123a63] bg-[#0e3358] p-2.5 sm:flex">
          {NAV.map((item, i) => (
            <span
              key={item}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium ${
                i === 0 ? 'bg-[#0a6ed1] text-white' : 'text-[#a8c4e4]'
              }`}
            >
              {item}
            </span>
          ))}
        </div>

        {/* main */}
        <div className="min-w-0 flex-1 space-y-3 bg-[#f7fafc] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-bold text-[#16283b]">Welcome back, TRAINEE01</p>
              <p className="text-[10.5px] text-[#5b6d80]">Ready to build something?</p>
            </div>
            <span className="rounded-md bg-[#0a6ed1] px-2.5 py-1.5 text-[10.5px] font-semibold text-white">
              + New Program
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              ['My programs', '3'],
              ['Examples', '41'],
              ['Recent runs', '12'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-[#e1e9f1] bg-white p-2.5">
                <p className="truncate font-mono text-[8px] uppercase tracking-[0.13em] text-[#5b6d80]">
                  {label}
                </p>
                <p className="mt-0.5 text-[17px] font-bold leading-none text-[#16283b]">{value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-[#e1e9f1] bg-white">
            <div className="flex items-center gap-3 border-b border-[#eef3f8] bg-[#f4f7fa] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.13em] text-[#5b6d80]">
              <span className="flex-1">Program</span>
              <span className="hidden w-16 sm:inline">Type</span>
              <span className="w-14 text-right sm:w-16">Updated</span>
            </div>
            {ROWS.map((r) => (
              <div
                key={r.name}
                className="flex items-center gap-3 border-b border-[#f1f5fa] px-3 py-2 last:border-0"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2ea52e]" />
                  <span className="truncate font-mono text-[10.5px] font-semibold text-[#16283b]">
                    {r.name}
                  </span>
                </span>
                <span className="hidden w-16 font-mono text-[9.5px] text-[#5b6d80] sm:inline">
                  {r.type}
                </span>
                <span className="w-14 text-right text-[10px] text-[#5b6d80] sm:w-16">{r.when}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
