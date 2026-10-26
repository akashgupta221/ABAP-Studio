import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSessionUser, isOwner } from '@/lib/session'
import { AdminDashboard } from '@/components/admin/admin-dashboard'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'System Administration — ABAP-Studio' }

// Server-side gate: non-owners are redirected before any dashboard markup is
// sent. Individual admin APIs enforce the same rule independently.
export default async function AdminPage() {
  const user = await getSessionUser()
  if (!user || !isOwner(user)) redirect('/')

  return <AdminDashboard ownerName={user.username} />
}
