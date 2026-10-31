import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser, isOwner } from '@/lib/session'
import { Landing } from '@/components/landing/landing'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ABAP Atelier — Build Smarter. Code Faster. Master ABAP.',
  description:
    'Your modern workspace for learning, writing, managing and improving ABAP programs in one place. A free, browser-based SAP-style workbench with a real ABAP runtime — no setup, no cost.',
  keywords: [
    'ABAP Atelier', 'ABAP', 'SAP', 'ABAP IDE', 'ABAP editor', 'SE38', 'SE80', 'SE11',
    'SE16', 'SE24', 'SE37', 'ALV', 'ABAP training', 'free ABAP editor', 'online ABAP compiler',
  ],
  openGraph: {
    title: 'ABAP Atelier — The Modern ABAP Studio',
    description:
      'Write, run and master ABAP in your browser — a real interpreter, SE38 editor, debugger, ALV grids and 41 runnable examples. Free forever.',
    type: 'website',
  },
}

export default async function Home() {
  // Signed-in visitors land by role: the owner gets the administrator
  // dashboard, everyone else goes to the workbench. Anonymous visitors see
  // the public landing page.
  const user = await getSessionUser()
  if (user) redirect(isOwner(user) ? '/dashboard' : '/workbench')
  return <Landing />
}
