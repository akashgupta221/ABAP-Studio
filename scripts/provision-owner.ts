// Provision the single owner administrator and claim pre-ownership legacy data.
//
// Usage (local):
//   OWNER_USERNAME=AKASH OWNER_EMAIL=owner@example.com bun run owner:provision
//
// Production (only after a verified backup and explicit authorization):
//   CONFIRM_OWNER_PROVISION=YES OWNER_USERNAME=... OWNER_EMAIL=... \
//     bun run scripts/provision-owner.ts
//
// Identity is Clerk-only. This script never creates or stores a password.
import { db, ensureSchema } from '../src/lib/db'
import { normalizeUsername, validateUsername } from '../src/lib/username'
import { writeAudit } from '../src/lib/admin'
import { SANDBOX_SOURCE, SANDBOX_TAGS, SANDBOX_TITLE, SANDBOX_DESCRIPTION } from '../src/lib/sandbox'

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

async function main() {
  const username = normalizeUsername(process.env.OWNER_USERNAME ?? '')
  const email = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase() || null

  if (!username) fail('Set OWNER_USERNAME')
  const nameError = validateUsername(username)
  if (nameError) fail(nameError)

  const remote = Boolean(process.env.TURSO_DATABASE_URL)
  if (remote && process.env.CONFIRM_OWNER_PROVISION !== 'YES') {
    fail('Remote database detected. Re-run with CONFIRM_OWNER_PROVISION=YES after taking a backup.')
  }
  if (remote && !email) {
    fail('OWNER_EMAIL is required for remote provisioning; production owner access fails closed without it.')
  }
  console.log(`Target: ${remote ? 'remote Turso database' : 'local SQLite database'}`)

  await ensureSchema()
  const existing = await db.user.findUnique({ where: { username } })
  if (email) {
    const emailOwner = await db.user.findUnique({ where: { email } })
    if (emailOwner && emailOwner.username !== username) {
      fail(`OWNER_EMAIL is already linked to another account (${emailOwner.username})`)
    }
  }

  const owner = await db.user.upsert({
    where: { username },
    update: {
      // Do not erase an owner email when provisioning runs without one.
      ...(email ? { email } : {}),
      role: 'OWNER',
      suspended: false,
      sessionVersion: { increment: 1 },
    },
    create: {
      username,
      // Retained for schema compatibility; Clerk is the only identity path.
      passwordHash: '',
      email,
      displayName: username,
      role: 'OWNER',
      suspended: false,
      lastLoginAt: null,
    },
  })

  // Claim pre-ownership objects. Examples stay shared/read-only and are never
  // reassigned. Private programs that already have an owner are untouched.
  const claimed = await db.program.updateMany({
    where: { isExample: false, ownerId: null },
    data: { ownerId: owner.id },
  })

  // Ensure the owner keeps a private sandbox even if the seed did not provide one.
  const ownerSandbox = await db.program.findFirst({
    where: { name: 'Z_MY_PRACTICE', ownerId: owner.id },
  })
  if (!ownerSandbox) {
    const name = `Z_MY_PRACTICE_${owner.username}`.slice(0, 40)
    const exists = await db.program.findUnique({ where: { name } })
    if (!exists) {
      await db.program.create({
        data: {
          name,
          title: SANDBOX_TITLE,
          description: SANDBOX_DESCRIPTION,
          type: 'REPORT',
          paradigm: 'BOTH',
          source: SANDBOX_SOURCE,
          tags: SANDBOX_TAGS,
          ownerId: owner.id,
        },
      })
    }
  }

  await writeAudit(
    owner,
    'OWNER_ASSIGN',
    'USER',
    owner.id,
    `${existing ? 'updated' : 'created'} owner · claimed ${claimed.count} legacy program(s)`,
  )

  console.log(
    `✓ Owner ${owner.username} is provisioned (${existing ? 'existing account updated' : 'account created'}).`,
  )
  console.log(`✓ ${claimed.count} legacy program(s) claimed by the owner.`)
  console.log('✓ Previous sessions invalidated.')
  if (email) {
    console.log(`✓ Owner email is configured; sign in through Clerk with ${email}.`)
  } else {
    console.log('! OWNER_EMAIL is not set. Production owner access will fail closed until it is configured.')
  }
  process.exit(0)
}

main().catch((error) => {
  console.error('✗ Provisioning failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
