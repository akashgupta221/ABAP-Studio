// Attach an owner-verified email address to an existing SAP user so the next
// Clerk sign-in can link by verified email. This does not set a Clerk id and
// does not change roles, programs or the legacy password.
//
// Usage (after the owner has verified the address out-of-band):
//   CONFIRM_SET_USER_EMAIL=YES OWNER_USERNAME=AKASH TARGET_USERNAME=USER1 \
//     TARGET_EMAIL="user1@example.com" bun run user:email
//
// Remote databases additionally require TURSO_DATABASE_URL/TURSO_AUTH_TOKEN.
import { db, ensureSchema } from '../src/lib/db'
import { normalizeUsername } from '../src/lib/username'
import { writeAudit } from '../src/lib/admin'

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  const visible = local.slice(0, 1)
  return `${visible}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`
}

async function main() {
  if (process.env.CONFIRM_SET_USER_EMAIL !== 'YES') {
    fail('Re-run with CONFIRM_SET_USER_EMAIL=YES. Only map an address the owner has verified out-of-band.')
  }

  const ownerName = normalizeUsername(process.env.OWNER_USERNAME ?? '')
  const targetName = normalizeUsername(process.env.TARGET_USERNAME ?? '')
  const email = (process.env.TARGET_EMAIL ?? '').trim().toLowerCase()
  if (!ownerName) fail('Set OWNER_USERNAME to the acting owner account')
  if (!targetName) fail('Set TARGET_USERNAME to the SAP user being mapped')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('TARGET_EMAIL is not a valid email address')

  await ensureSchema()
  const owner = await db.user.findUnique({ where: { username: ownerName } })
  if (!owner || owner.role !== 'OWNER' || owner.suspended) {
    fail('OWNER_USERNAME must identify an active OWNER account')
  }
  const target = await db.user.findUnique({ where: { username: targetName } })
  if (!target) fail(`SAP user ${targetName} was not found`)
  if (target.role === 'OWNER') fail('Use owner:provision for the owner account')
  if (target.clerkId) fail('That SAP user is already linked to a Clerk account')

  const existing = await db.user.findUnique({ where: { email } })
  if (existing && existing.id !== target.id) {
    fail(`That email is already attached to another SAP user (${existing.username})`)
  }
  const caseMatches = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "User" WHERE lower("email") = ${email} AND "id" <> ${target.id} LIMIT 2
  `
  if (caseMatches.length) fail('That email is already attached to another SAP user (case-insensitive match)')

  await db.user.update({ where: { id: target.id }, data: { email } })
  await writeAudit(owner, 'USER_EMAIL_MAP', 'USER', target.id, `mapped verified email for ${target.username}`)

  console.log(`✓ ${target.username} now has a verified-email mapping (${maskEmail(email)}).`)
  console.log('  The next Clerk sign-in with that verified address will link the existing account.')
  process.exit(0)
}

main().catch((error) => {
  console.error('✗ Email mapping failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
