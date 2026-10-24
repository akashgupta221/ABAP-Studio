// Provision the single owner administrator and claim pre-ownership legacy data.
//
// Usage (local):
//   OWNER_USERNAME=AKASH bun run scripts/provision-owner.ts
//   OWNER_USERNAME=AKASH bun run scripts/set-owner-password.ts   # hidden input
//
// Production (only after a verified backup and explicit authorization):
//   CONFIRM_OWNER_PROVISION=YES OWNER_USERNAME=... bun run scripts/provision-owner.ts
//
// Do not pass a real password on the command line (shell history). The optional
// OWNER_PASSWORD environment variable exists for automation; prefer
// set-owner-password.ts, which never echoes the value.
import { db, ensureSchema } from '../src/lib/db'
import { hashPassword, normalizeUsername, validateUsername } from '../src/lib/auth'
import { writeAudit } from '../src/lib/admin'
import { SANDBOX_SOURCE, SANDBOX_TAGS, SANDBOX_TITLE, SANDBOX_DESCRIPTION } from '../src/lib/sandbox'
import { randomBytes } from 'node:crypto'

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

async function main() {
  const username = normalizeUsername(process.env.OWNER_USERNAME ?? '')
  const password = process.env.OWNER_PASSWORD ?? ''
  const email = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase() || null

  if (!username) fail('Set OWNER_USERNAME')
  const nameError = validateUsername(username)
  if (nameError) fail(nameError)
  if (password && password.length < 8) fail('OWNER_PASSWORD must have at least 8 characters')

  const remote = Boolean(process.env.TURSO_DATABASE_URL)
  if (remote && process.env.CONFIRM_OWNER_PROVISION !== 'YES') {
    fail('Remote database detected. Re-run with CONFIRM_OWNER_PROVISION=YES after taking a backup.')
  }
  console.log(`Target: ${remote ? 'remote Turso database' : 'local SQLite database'}`)

  await ensureSchema()
  const existing = await db.user.findUnique({ where: { username } })
  const generated = !existing && !password ? randomBytes(24).toString('base64url') : null
  const passwordHash = password
    ? await hashPassword(password)
    : generated
      ? await hashPassword(generated)
      : undefined

  const owner = await db.user.upsert({
    where: { username },
    update: {
      ...(passwordHash ? { passwordHash } : {}),
      email,
      role: 'OWNER',
      suspended: false,
      sessionVersion: { increment: 1 },
    },
    create: {
      username,
      passwordHash: passwordHash ?? '',
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

  await writeAudit(owner, 'OWNER_ASSIGN', 'USER', owner.id, `${existing ? 'updated' : 'created'} owner · claimed ${claimed.count} legacy program(s)`)

  console.log(`✓ Owner ${owner.username} is provisioned (${existing ? 'existing account updated' : 'account created'}).`)
  console.log(`✓ ${claimed.count} legacy program(s) claimed by the owner.`)
  if (generated) {
    console.log('✓ A random temporary password was set and is intentionally not displayed.')
    console.log(`  Run: OWNER_USERNAME=${owner.username} bun run scripts/set-owner-password.ts`)
  }
  console.log('✓ Previous sessions invalidated. Log in with the owner credentials.')
  process.exit(0)
}

main().catch((error) => {
  console.error('✗ Provisioning failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
