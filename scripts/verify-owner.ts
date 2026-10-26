// Read-only owner provisioning check. Prints no secrets and no email address.
// Exits non-zero if the owner is missing or any legacy non-example program is
// still unclaimed, so CI can fail loudly.
import { db } from '../src/lib/db'

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

async function main() {
  const owners = await db.user.findMany({
    where: { role: 'OWNER' },
    select: { id: true, username: true, email: true, suspended: true },
  })
  if (owners.length === 0) fail('No OWNER account exists')
  if (owners.length > 1) fail(`Expected exactly one OWNER account, found ${owners.length}`)
  const owner = owners[0]
  if (!owner) fail('No OWNER account exists')
  if (owner.suspended) fail('The OWNER account is suspended')

  const configuredEmail = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase()
  const isProduction = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production')
  if (isProduction && !configuredEmail) {
    fail('OWNER_EMAIL is required in production; the owner gate fails closed without it')
  }
  if (configuredEmail) {
    if (!owner.email || owner.email.trim().toLowerCase() !== configuredEmail) {
      fail('The OWNER account email does not match OWNER_EMAIL')
    }
  }

  const [legacy, owned, examples] = await Promise.all([
    db.program.count({ where: { isExample: false, ownerId: null } }),
    db.program.count({ where: { isExample: false, ownerId: owner.id } }),
    db.program.count({ where: { isExample: true } }),
  ])

  console.log(`✓ Owner account: ${owner.username}`)
  console.log(`✓ Owner email stored: ${owner.email ? 'yes' : 'no'}`)
  console.log(`✓ Owner-owned non-example programs: ${owned}`)
  console.log(`✓ Unclaimed legacy programs: ${legacy}`)
  console.log(`✓ Shared examples: ${examples}`)

  if (legacy !== 0) fail(`${legacy} legacy program(s) are still unclaimed`)
  process.exit(0)
}

main().catch((error) => {
  console.error('✗ Owner verification failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
