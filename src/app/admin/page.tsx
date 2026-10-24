import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { SESSION_COOKIE } from '@/lib/auth'
import { getSessionUserFromToken, isOwner } from '@/lib/session'
import { AdminDashboard } from '@/components/admin/admin-dashboard'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'System Administration — ABAP-Studio' }

// Server-side gate: non-owners are redirected before any dashboard markup is
// sent. Individual admin APIs enforce the same rule independently.
export default async function AdminPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = await getSessionUserFromToken(token)
  if (!user || !isOwner(user)) redirect('/')

  return <AdminDashboard ownerName={user.username} />
}
