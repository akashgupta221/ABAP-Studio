import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser, isOwner } from '@/lib/session'
import { DashboardApp } from '@/components/dashboard/dashboard-app'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Administrator Dashboard — ABAP Atelier',
  description: 'Owner-only overview: programs, curriculum and environment access at a glance.',
}

// Owner-only surface. Anonymous visitors go to sign-in; signed-in trainees go
// straight to the workbench — the dashboard is the administrator's home.
export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/sign-in')
  if (!isOwner(user)) redirect('/workbench')
  return <DashboardApp username={user.username} role={user.role} owner={true} />
}
