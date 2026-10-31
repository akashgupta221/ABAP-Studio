'use client'

// ── Public landing page ────────────────────────────────────────────────
// Dynamic marketing surface. Motion vocabulary per section (impeccable):
// hero = GradientWaves canvas + parallax, capabilities = scroll-linked
// ScrollVelocity bands, features = SpotlightCard bento, headings = GSAP
// ScrollFloat, CTA = Aurora. Collapses under prefers-reduced-motion.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import {
  ArrowRight, BookOpen, Bug, Check, CheckCircle2, ChevronRight, Database, FileCode2,
  FunctionSquare, Layers, Menu, ShieldCheck, Sparkles, Table2, TerminalSquare, X,
} from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { CodeWindow } from './code-window'
import { PreviewWindow } from './preview-window'
import GradientWaves from '@/components/GradientWaves'
import GradientText from '@/components/GradientText'
import ScrollVelocity from '@/components/ScrollVelocity'
import ScrollFloat from '@/components/ScrollFloat'
import ScrollReveal from '@/components/ScrollReveal'
import SpotlightCard from '@/components/SpotlightCard'
import Aurora from '@/components/Aurora'

// ── motion primitives ──────────────────────────────────────────────────

function Reveal({
  children, delay = 0, y = 26, className,
}: {
  children: ReactNode; delay?: number; y?: number; className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

function Parallax({ children, distance = 56, className }: { children: ReactNode; distance?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance])
  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }}>{children}</motion.div>
    </div>
  )
}

function InlineStat({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[20px] font-extrabold tabular-nums text-white">{value}</span>
      <span className="text-[13px] text-[#a8c4e4]">{label}</span>
    </span>
  )
}

// ── header ─────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: '#top', label: 'Home' },
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#preview', label: 'Workspace' },
  { href: '#about', label: 'About' },
]

function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { scrollY, scrollYProgress } = useScroll()
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 24))
  // Anchor jumps (e.g. /#preview) can land past the hero before hydration, so
  // sync once on mount after layout settles instead of relying only on events.
  useEffect(() => {
    const id = requestAnimationFrame(() => setScrolled(window.scrollY > 24))
    return () => cancelAnimationFrame(id)
  }, [])
  const solid = scrolled || menuOpen

  return (
    <>
      {/* scroll progress */}
      <motion.div
        aria-hidden
        style={{ scaleX: scrollYProgress }}
        className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-[#0a6ed1] via-[#22b8cf] to-[#6cb6f5]"
      />
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          solid
            ? 'border-b border-[#e1e9f1] bg-white/90 text-[#16283b] shadow-[0_10px_30px_-18px_rgba(4,22,39,0.35)] backdrop-blur-md'
            : 'border-b border-transparent bg-transparent text-white'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="#top" className="flex min-w-0 items-center gap-2.5">
            <BrandMark size={30} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-tight tracking-tight">
                ABAP Atelier
              </span>
              <span
                className={`block font-mono text-[8px] uppercase tracking-[0.16em] ${
                  solid ? 'text-[#5b6d80]' : 'text-[#a8c4e4]'
                }`}
              >
                Modern ABAP Studio
              </span>
            </span>
          </Link>

          <nav aria-label="Landing" className="ml-6 hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors ${
                  solid ? 'text-[#3d5068] hover:bg-[#eef3f8] hover:text-[#0a4d8c]' : 'text-[#d5e6f7] hover:bg-white/10 hover:text-white'
                }`}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <Link
              href="/sign-in"
              className={`rounded-lg px-4 py-2 text-[13.5px] font-semibold transition-colors ${
                solid
                  ? 'text-[#0a4d8c] hover:bg-[#e8f1fa]'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              Log In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-[#0a6ed1] px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm transition-all hover:bg-[#0a4d8c] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6ed1]"
            >
              Sign Up
            </Link>
          </div>

          <button
            type="button"
            className={`ml-auto flex h-10 w-10 items-center justify-center rounded-lg sm:hidden ${
              solid ? 'hover:bg-[#eef3f8]' : 'hover:bg-white/10'
            }`}
            aria-expanded={menuOpen}
            aria-controls="lp-mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <nav
            id="lp-mobile-nav"
            aria-label="Landing mobile"
            className="border-t border-[#e1e9f1] bg-white px-4 pb-4 pt-2 text-[#16283b] shadow-lg sm:hidden"
          >
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#3d5068] hover:bg-[#eef3f8]"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2 border-t border-[#eef3f8] pt-3">
              <Link
                href="/sign-in"
                className="flex-1 rounded-lg border border-[#c9d4e0] px-4 py-2.5 text-center text-[13.5px] font-semibold text-[#0a4d8c]"
              >
                Log In
              </Link>
              <Link
                href="/sign-up"
                className="flex-1 rounded-lg bg-[#0a6ed1] px-4 py-2.5 text-center text-[13.5px] font-semibold text-white"
              >
                Sign Up
              </Link>
            </div>
          </nav>
        )}
      </header>
    </>
  )
}

// ── hero ───────────────────────────────────────────────────────────────

function Hero() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 60])
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0.2])

  return (
    <section ref={ref} id="top" className="relative overflow-hidden bg-[#041627]">
      {/* living background: gradient waves (mouse-reactive) */}
      {!reduce && (
        <div aria-hidden className="absolute inset-0">
          <GradientWaves
            horizonColor="#0a6ed1"
            crestColor="#22b8cf"
            backgroundColor="#041627"
            lightMode={false}
            speed={0.45}
            amplitude={0.55}
            zoom={0.9}
            tilt={4}
            quality="low"
            mouseInteraction
            parallaxStrength={0.15}
            opacity={0.9}
          />
        </div>
      )}
      <div aria-hidden className="lp-grid-bg absolute inset-0 opacity-40" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#041627]" />

      <motion.div
        style={reduce ? undefined : { y: contentY, opacity: fade }}
        className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-32 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-40"
      >
        <div>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-[#2a5580] bg-[#0c2c4e]/80 px-3.5 py-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#6cb6f5]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b9d3ee]">
              Free · In your browser · No SAP system required
            </span>
          </motion.div>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 text-[clamp(38px,6vw,64px)] font-extrabold leading-[1.02] tracking-[-0.04em] text-white"
          >
            Build Smarter.
            <br />
            Code Faster.
            <br />
            <GradientText
              colors={['#6cb6f5', '#22b8cf', '#8f9dff', '#6cb6f5']}
              variant="flow"
              animationSpeed={7}
              glow={0.6}
              className="!text-[clamp(38px,6vw,64px)] !font-extrabold !leading-[1.02] !tracking-[-0.04em]"
            >
              Master ABAP.
            </GradientText>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 max-w-lg text-[16.5px] leading-relaxed text-[#b9d3ee]"
          >
            Your modern workspace for learning, writing, managing, and improving ABAP programs in
            one place — with a real ABAP runtime, an SE38 editor, a debugger and a full training
            curriculum.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/sign-up"
              className="group inline-flex items-center gap-2 rounded-xl bg-[#0a6ed1] px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[#0a6ed1]/30 transition-all hover:bg-[#0a4d8c] hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6cb6f5]"
            >
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#preview"
              className="inline-flex items-center gap-2 rounded-xl border border-[#2a5580] bg-white/5 px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              Explore Workspace
              <ChevronRight className="h-4 w-4" />
            </a>
          </motion.div>

          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="mt-12 flex max-w-md flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[#1c4a7c] pt-6"
          >
            <InlineStat value={41} label="runnable examples" />
            <span aria-hidden className="text-[#2a5580]">·</span>
            <InlineStat value={10} label="topics" />
            <span aria-hidden className="text-[#2a5580]">·</span>
            <InlineStat value={11} label="demo tables" />
            <span aria-hidden className="text-[#2a5580]">·</span>
            <span className="text-[13px] text-[#a8c4e4]">zero setup</span>
          </motion.p>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 34, rotate: 1.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <CodeWindow />
        </motion.div>
      </motion.div>
    </section>
  )
}

// ── scroll-linked capability bands ─────────────────────────────────────

function VelocityBands() {
  return (
    <div className="space-y-1 border-y border-[#e1e9f1] bg-white py-6">
      <ScrollVelocity
        texts={[
          'SE38 ABAP Editor — ABAP Debugger — SE37 Function Builder — SE11 Dictionary — ',
          'SE16N Data Browser — SE24 Class Builder — ST22 Dump Analysis — Pretty Printer — ',
        ]}
        velocity={60}
        numCopies={4}
        pauseOnHover
        fadeEdges
        className="font-semibold uppercase tracking-[0.14em] text-[#5b6d80]"
        fontSize="13px"
      />
      <ScrollVelocity
        texts={[
          'ALV Grids — Selection Screens — Syntax Check — Modern 7.40 Syntax — CDS · RAP · AMDP — ',
          'SFLIGHT Demo Data — Private Programs — Function Module Tests — Number Ranges — ',
        ]}
        velocity={-60}
        numCopies={4}
        pauseOnHover
        fadeEdges
        className="font-semibold uppercase tracking-[0.14em] text-[#5b6d80]"
        fontSize="13px"
      />
    </div>
  )
}

// ── features (bento + spotlight) ───────────────────────────────────────

const FEATURES = [
  {
    icon: TerminalSquare,
    title: 'A real ABAP runtime',
    tag: 'Interpreter',
    body: 'A purpose-built TypeScript interpreter executes your code — reports, classes, includes and function groups — against demo tables, in memory, safely. Not a screencast, not a mock: your statements actually run.',
    span: 'lg:col-span-2 lg:row-span-2',
    titleClass: 'text-[17px]',
    bodyClass: 'lg:text-[15px]',
  },
  {
    icon: FileCode2,
    title: 'SE38 ABAP Editor',
    tag: 'Edit + run',
    body: 'Syntax highlighting, find/replace, undo, Pretty Printer formatting and an instant syntax check.',
    span: 'lg:col-span-2',
    titleClass: 'text-[15.5px]',
    bodyClass: 'text-[13px]',
  },
  {
    icon: Bug,
    title: 'ABAP Debugger',
    tag: 'Breakpoints',
    body: 'Line breakpoints, /h or the Debug button, then step into, step over and continue while watching variables.',
    span: '',
    titleClass: 'text-[15.5px]',
    bodyClass: 'text-[13px]',
  },
  {
    icon: Layers,
    title: 'Program management',
    tag: 'Private + shared',
    body: 'Your programs stay private; 41 shared curriculum examples are read-only reference material.',
    span: '',
    titleClass: 'text-[15.5px]',
    bodyClass: 'text-[13px]',
  },
  {
    icon: Database,
    title: 'Dictionary & data browser',
    tag: 'SE11 · SE16N',
    body: 'Browse 11 demo tables — SFLIGHT and friends — with per-field selection criteria and wildcards.',
    span: '',
    titleClass: 'text-[15.5px]',
    bodyClass: 'text-[13px]',
  },
  {
    icon: FunctionSquare,
    title: 'Function Builder',
    tag: 'SE37',
    body: 'Create function groups and modules, then test them in isolation before calling them from reports.',
    span: '',
    titleClass: 'text-[15.5px]',
    bodyClass: 'text-[13px]',
  },
  {
    icon: Table2,
    title: 'Lists & ALV output',
    tag: 'Selection screens',
    body: 'Parameterize reports with selection screens, then read results as lists or ALV-style grids.',
    span: '',
    titleClass: 'text-[15.5px]',
    bodyClass: 'text-[13px]',
  },
  {
    icon: ShieldCheck,
    title: 'Modern ABAP workspace',
    tag: '7.40 · CDS · RAP',
    body: 'Run 7.40 constructor expressions for real; author CDS, RAP and AMDP artefacts with structural validation — boundaries always labelled.',
    span: 'lg:col-span-2',
    titleClass: 'text-[15.5px]',
    bodyClass: 'text-[13px]',
  },
]

function Features() {
  return (
    <section id="features" className="relative scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ScrollFloat
          containerClassName="max-w-2xl !my-0"
          textClassName="!text-[clamp(28px,3.6vw,40px)] !leading-[1.1] !font-extrabold !tracking-[-0.03em] !text-[#16283b] !text-left"
          effect="blur"
          splitBy="words"
          scrollStart="top bottom-=120"
          scrollEnd="center 55%"
        >
          A complete ABAP workbench, zero setup
        </ScrollFloat>
        <Reveal className="mt-5 max-w-2xl">
          <p className="text-[15.5px] leading-relaxed text-[#5b6d80]">
            Every transaction below is implemented in the product — not a screenshot, not a mock.
            Sign in and each one is a click away.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.07} className={f.span}>
              <SpotlightCard
                theme="light"
                spotlightColor="rgba(10, 110, 209, 0.16)"
                className="group h-full rounded-2xl border border-[#e1e9f1] bg-white !p-5 transition-colors duration-300 hover:border-[#b9d3ee]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f1fa] text-[#0a4d8c] transition-colors group-hover:bg-[#0a6ed1] group-hover:text-white">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className={`mt-4 font-bold text-[#16283b] ${f.titleClass}`}>{f.title}</h3>
                <p className={`mt-2 leading-relaxed text-[#5b6d80] ${f.bodyClass}`}>{f.body}</p>
                <p className="mt-3 inline-block rounded border border-[#e1e9f1] bg-[#f4f7fa] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#3d5068]">
                  {f.tag}
                </p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── how it works (scroll-drawn timeline) ───────────────────────────────

const STEPS = [
  {
    title: 'Create your free account',
    body: 'Sign up with a verified email one-time code or Google. No credit card, no installation, nothing to download.',
  },
  {
    title: 'Receive your SAP user',
    body: 'Your ABAP user name is assigned from your verified email — the same way a user master works in a real SAP client.',
  },
  {
    title: 'Enter the workbench',
    body: 'Log on to the workbench at client 105: SAP Easy Access, the command field, transaction codes and your private repository.',
  },
  {
    title: 'Write, run, debug, save',
    body: 'Create programs in SE38, execute them against demo tables, chase bugs in the debugger and keep everything in your private workspace.',
  },
]

function HowItWorks() {
  const lineRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: lineRef,
    offset: ['start 78%', 'end 55%'],
  })
  const scaleY = useSpring(scrollYProgress, { stiffness: 90, damping: 26 })

  return (
    <section id="how" className="scroll-mt-20 border-y border-[#e1e9f1] bg-[#f4f7fa] py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <ScrollFloat
            containerClassName="!my-0"
            textClassName="!text-[clamp(28px,3.6vw,40px)] !leading-[1.1] !font-extrabold !tracking-[-0.03em] !text-[#16283b] !text-left"
            effect="blur"
            splitBy="words"
            scrollStart="top bottom-=120"
            scrollEnd="center 55%"
          >
            From visitor to first program in four steps
          </ScrollFloat>
        </div>

        <div ref={lineRef} className="relative mt-12 lg:pl-2">
          {/* rail */}
          <div aria-hidden className="absolute bottom-3 left-[19px] top-3 w-px bg-[#d5e0ec] lg:left-[27px]" />
          <motion.div
            aria-hidden
            style={reduce ? { scaleY: 1 } : { scaleY }}
            className="absolute bottom-3 left-[19px] top-3 w-px origin-top bg-gradient-to-b from-[#0a6ed1] to-[#22b8cf] lg:left-[27px]"
          />

          <ol className="space-y-9">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Reveal delay={0.05}>
                  <div className="flex gap-5">
                    <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#c9d4e0] bg-white font-mono text-[12px] font-bold text-[#0a4d8c] shadow-sm lg:h-[26px] lg:w-[26px] lg:rounded-md">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 rounded-2xl border border-[#e1e9f1] bg-white p-5 shadow-sm lg:max-w-xl lg:border-none lg:bg-transparent lg:p-1 lg:shadow-none">
                      <h3 className="text-[16px] font-bold text-[#16283b]">{s.title}</h3>
                      <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-[#5b6d80]">
                        {s.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>

        <Reveal delay={0.1} className="mt-12">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0a6ed1] px-6 py-3.5 text-[15px] font-semibold text-white shadow-md transition-all hover:bg-[#0a4d8c]"
          >
            Start with step one
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

// ── workspace preview ──────────────────────────────────────────────────

function WorkspacePreview() {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] })
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1])
  const rotate = useTransform(scrollYProgress, [0, 1], [1.2, 0])

  return (
    <section
      ref={ref}
      id="preview"
      className="relative scroll-mt-20 overflow-hidden bg-[#0b2b52] py-20 sm:py-24"
    >
      <div aria-hidden className="lp-grid-bg absolute inset-0 opacity-60" />
      <div aria-hidden className="lp-glow absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-[#0a6ed1]/25 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <ScrollFloat
          containerClassName="mx-auto max-w-2xl !my-0"
          textClassName="!text-[clamp(28px,3.6vw,40px)] !leading-[1.1] !font-extrabold !tracking-[-0.03em] !text-white !text-center"
          effect="blur"
          splitBy="words"
          scrollStart="top bottom-=120"
          scrollEnd="center 55%"
        >
          A dashboard that keeps your work organized
        </ScrollFloat>
        <Reveal className="mx-auto mt-5 max-w-2xl">
          <p className="text-center text-[15.5px] leading-relaxed text-[#a8c4e4]">
            Programs, curriculum progress and one-click access to the workbench — and behind it,
            the full SAP-style transaction surface.
          </p>
        </Reveal>

        <motion.div
          style={reduce ? undefined : { scale, rotate }}
          className="mx-auto mt-12 max-w-4xl"
        >
          <PreviewWindow />
        </motion.div>

        <Reveal delay={0.1} className="mt-10 text-center">
          <Link
            href="/workbench"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[15px] font-semibold text-[#0a4d8c] shadow-lg transition-all hover:bg-[#e8f1fa]"
          >
            Open the workbench
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

// ── benefits ───────────────────────────────────────────────────────────

const BENEFITS = [
  {
    title: 'A clean, guided workflow',
    body: 'Easy Access, transactions and editors behave the way SAP GUI trained you — no new mental model to unlearn.',
  },
  {
    title: 'Learn with a curriculum, not a blank page',
    body: 'Ten syllabus topics with 41 runnable examples walk you from first SELECT to object-oriented design and Modern ABAP.',
  },
  {
    title: 'Organized, private by default',
    body: 'Your programs and function modules belong to your account alone; shared examples stay read-only for everyone.',
  },
  {
    title: 'Beginner-friendly, expert-honest',
    body: 'Simulated boundaries are labelled in the product — what runs, what is validated and what is out of scope is never implied.',
  },
]

function Benefits() {
  return (
    <section id="benefits" className="bg-white py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <Reveal>
          <h2 className="text-[clamp(28px,3.6vw,40px)] font-extrabold leading-tight tracking-[-0.03em] text-[#16283b]">
            Practice the real workflow — safely, freely
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-[#5b6d80]">
            ABAP Atelier is a training simulator, not a thin wrapper around a real SAP backend. It
            gives learners an authentic daily-driver experience and gives educators a safe,
            free-to-run environment.
          </p>
          <div className="mt-8 rounded-2xl border border-[#e1e9f1] bg-[#f4f7fa] p-5">
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-[#0a6ed1]" />
              <p className="text-[13.5px] leading-relaxed text-[#3d5068]">
                The curriculum starts at <span className="font-mono font-semibold">SELECT</span> and
                ends at CDS, RAP and AMDP — with the ABAP Debugger and ST22 dump analysis in
                between, so real mistakes become teachable moments.
              </p>
            </div>
          </div>
        </Reveal>

        <ul className="space-y-5">
          {BENEFITS.map((b, i) => (
            <li key={b.title}>
              <Reveal delay={i * 0.06}>
                <div className="flex gap-4 rounded-2xl border border-[#e1e9f1] p-5 transition-colors hover:border-[#b9d3ee]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eaf5ea] text-[#1c7a1c]">
                    <Check className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-[15.5px] font-bold text-[#16283b]">{b.title}</h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-[#5b6d80]">{b.body}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ── CTA ────────────────────────────────────────────────────────────────

function CtaSection() {
  const reduce = useReducedMotion()
  return (
    <section className="bg-white pb-20 sm:pb-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-[#081f38] px-6 py-14 text-center shadow-[0_30px_80px_-30px_rgba(4,22,39,0.5)] sm:px-12 sm:py-16">
            {!reduce && (
              <div aria-hidden className="absolute inset-0 opacity-70">
                <Aurora
                  colorStops={['#0a6ed1', '#22b8cf', '#0a4d8c']}
                  amplitude={1.1}
                  blend={0.4}
                  speed={0.4}
                  glow={0.5}
                  opacity={0.8}
                />
              </div>
            )}

            <div className="relative">
              <motion.div
                animate={reduce ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#6cb6f5]"
              >
                <CheckCircle2 className="h-6 w-6" />
              </motion.div>
              <h2 className="mx-auto mt-6 max-w-xl text-[clamp(26px,3.4vw,36px)] font-extrabold leading-tight tracking-[-0.03em] text-white">
                Ready to write your first line of ABAP?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[#a8c4e4]">
                Create a free account and you are one logon away from SE38, the debugger and 41
                runnable examples.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/sign-up"
                  className="rounded-xl bg-white px-6 py-3.5 text-[15px] font-semibold text-[#0a4d8c] shadow-lg transition-all hover:bg-[#e8f1fa]"
                >
                  Create free account
                </Link>
                <Link
                  href="/sign-in"
                  className="rounded-xl border border-[#2a5580] bg-white/5 px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
                >
                  I already have one
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ── footer ─────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer id="about" className="scroll-mt-20 bg-[#041627] py-14 text-[#a8c4e4]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark size={30} />
              <span>
                <span className="block text-[15px] font-bold text-white">ABAP Atelier</span>
                <span className="block font-mono text-[8px] uppercase tracking-[0.16em] text-[#7ba3cc]">
                  Modern ABAP Studio
                </span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed">
              A browser-based SAP NetWeaver-style training workbench: write, run, debug and manage
              real ABAP without an SAP system. Free to learn, free to teach.
            </p>
          </div>

          <nav aria-label="Product">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#7ba3cc]">Product</p>
            <ul className="mt-3.5 space-y-2.5 text-[13.5px]">
              <li><a href="#features" className="hover:text-white">Features</a></li>
              <li><a href="#how" className="hover:text-white">How it works</a></li>
              <li><a href="#preview" className="hover:text-white">Workspace preview</a></li>
              <li><Link href="/workbench" className="hover:text-white">Open the workbench</Link></li>
            </ul>
          </nav>

          <nav aria-label="Account">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#7ba3cc]">Account</p>
            <ul className="mt-3.5 space-y-2.5 text-[13.5px]">
              <li><Link href="/sign-up" className="hover:text-white">Create an account</Link></li>
              <li><Link href="/sign-in" className="hover:text-white">Log in</Link></li>
              <li><Link href="/dashboard" className="hover:text-white">Owner dashboard</Link></li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-[#12335a] pt-6 text-[12px] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ABAP Atelier. All rights reserved.</p>
          <p className="text-[#7ba3cc]">
            Independent training simulator — not affiliated with or endorsed by SAP SE.
          </p>
        </div>
      </div>
    </footer>
  )
}

// ── page ───────────────────────────────────────────────────────────────

export function Landing() {
  return (
    <div data-lp className="scroll-smooth bg-white text-[#16283b]">
      <LandingHeader />
      <main>
        <Hero />
        <VelocityBands />
        <Features />
        <HowItWorks />
        <WorkspacePreview />
        <Benefits />
        <CtaSection />
      </main>
      <Footer />
    </div>
  )
}
