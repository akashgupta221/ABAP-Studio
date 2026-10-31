// ── Shared split-screen layout for the Clerk auth surfaces ────────────
// Left: navy brand panel with real product facts. Right: white form column
// hosting the Clerk card. Server component — motion stays on the landing
// page; these surfaces use CSS-only animation.

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft, Bug, CheckCircle2, ShieldCheck } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import Aurora from '@/components/Aurora'

const COPY = {
  'sign-in': {
    lead: 'Welcome back.',
    tail: 'Your workbench is waiting.',
    description:
      'Log on to the ABAP workbench at client 105 — your programs, favorites and curriculum progress are exactly where you left them.',
    bullets: [
      'One-tap Email code or Google sign-in, verified by Clerk',
      'Every session is validated server-side and recorded',
      'SE38, the debugger and SE16N are ready the moment you log on',
    ],
    stamp: 'Secure gate',
  },
  'sign-up': {
    lead: 'Join the studio.',
    tail: 'Free for learners.',
    description:
      'Create a verified account and get your SAP user name, a private program repository and the full 10-topic ABAP curriculum.',
    bullets: [
      'Verified email one-time code or Google registration',
      '41 runnable examples and 11 demo tables from day one',
      'Your programs stay private to your account by default',
    ],
    stamp: 'New line',
  },
} as const

export function AuthSplit({
  mode,
  children,
}: {
  mode: keyof typeof COPY
  children: ReactNode
}) {
  const copy = COPY[mode]
  return (
    <div data-auth className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      {/* brand panel */}
      <aside className="relative hidden overflow-hidden bg-[#081f38] lg:flex lg:flex-col" aria-label="About ABAP Atelier">
        <div aria-hidden className="lp-grid-bg absolute inset-0 opacity-60" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[46%] opacity-60">
          <Aurora
            colorStops={['#0a6ed1', '#22b8cf', '#0a4d8c']}
            amplitude={1}
            blend={0.35}
            speed={0.35}
            glow={0.4}
            opacity={0.85}
          />
        </div>

        <div className="relative flex items-center gap-2.5 p-10">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark size={34} />
            <span>
              <span className="block text-[16px] font-bold leading-tight text-white">ABAP Atelier</span>
              <span className="block font-mono text-[8px] uppercase tracking-[0.16em] text-[#a8c4e4]">
                Modern ABAP Studio
              </span>
            </span>
          </Link>
        </div>

        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-10 pb-10">
          <h2 className="text-[clamp(32px,3.4vw,44px)] font-extrabold leading-[1.04] tracking-[-0.03em] text-white">
            {copy.lead}
            <br />
            <span className="bg-gradient-to-r from-[#6cb6f5] to-[#b9d3ee] bg-clip-text text-transparent">
              {copy.tail}
            </span>
          </h2>
          <p className="mt-5 text-[14.5px] leading-relaxed text-[#a8c4e4]">{copy.description}</p>

          <ul className="mt-8 space-y-3.5">
            {copy.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-[13.5px] leading-relaxed text-[#d5e6f7]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6cb6f5]" />
                {b}
              </li>
            ))}
          </ul>

          {/* mini editor strip */}
          <div className="mt-10 overflow-hidden rounded-xl border border-[#1c4a7c] bg-[#0b2b52]/80 shadow-lg" aria-hidden>
            <div className="flex items-center gap-2 border-b border-[#1c4a7c] px-3.5 py-2">
              <span className="h-2 w-2 rounded-full bg-[#c0392b]" />
              <span className="h-2 w-2 rounded-full bg-[#b0600b]" />
              <span className="h-2 w-2 rounded-full bg-[#2ea52e]" />
              <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#7ba3cc]">
                SE38 — Z_HELLO_WORLD
              </span>
            </div>
            <pre className="px-3.5 py-3 font-mono text-[11px] leading-relaxed">
              <code>
                <span className="text-[#6cb6f5] font-semibold">REPORT</span>
                {' z_hello_world.\n'}
                <span className="text-[#6cb6f5] font-semibold">WRITE</span>
                <span className="text-[#d5e6f7]"> / </span>
                <span className="text-[#7dd087]">&apos;Hello, ABAP world!&apos;</span>
                <span className="text-[#d5e6f7]">.</span>
              </code>
            </pre>
          </div>

          <div className="mt-10 flex items-center justify-between border-t border-[#1c4a7c] pt-6">
            <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#7ba3cc]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure identity by Clerk
            </span>
            <span className="rounded border border-[#2a5580] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#b9d3ee]">
              {copy.stamp}
            </span>
          </div>
        </div>
      </aside>

      {/* form column */}
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Link href="/" className="flex items-center gap-2.5 lg:hidden">
            <BrandMark size={30} />
            <span className="text-[15px] font-bold text-[#16283b]">ABAP Atelier</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[#5b6d80] transition-colors hover:bg-[#f4f7fa] hover:text-[#0a4d8c]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to home
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-10">
          <div className="mb-7 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f1fa] text-[#0a4d8c]">
              {mode === 'sign-in' ? <ShieldCheck className="h-5 w-5" /> : <Bug className="h-5 w-5" />}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#5b6d80]">
              System MER · Client 105
            </span>
          </div>
          {children}
        </div>

        <p className="mx-auto w-full max-w-[440px] text-center text-[11.5px] leading-relaxed text-[#5b6d80]">
          Protected by server-side session checks. ABAP Atelier is an independent training simulator
          and is not affiliated with SAP SE.
        </p>
      </main>
    </div>
  )
}
