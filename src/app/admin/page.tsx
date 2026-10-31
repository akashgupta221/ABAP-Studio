import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSessionUser, isOwner } from '@/lib/session'
import { AdminDashboard } from '@/components/admin/admin-dashboard'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'System Administration — ABAP Atelier' }

// Server-side gate: non-owners are redirected to their dashboard before any
// admin markup is sent. Individual admin APIs enforce the same rule
// independently.
export default async function AdminPage() {
  const user = await getSessionUser()
  if (!user || !isOwner(user)) redirect('/workbench')

  return <AdminDashboard ownerName={user.username} />
}
