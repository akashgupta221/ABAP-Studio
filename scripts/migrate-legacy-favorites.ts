// Copy pre-ownership global favorites into the designated owner's per-user
// favorites. The old table had no user column, so assigning it to anyone other
// than the owner would leak one person's choices to every user.
//
// Dry run (default):
//   OWNER_USERNAME=AKASH bun run scripts/migrate-legacy-favorites.ts
//
// Apply locally:
//   OWNER_USERNAME=AKASH APPLY=YES bun run scripts/migrate-legacy-favorites.ts
//
// Apply to Turso (after a verified backup):
//   CONFIRM_LEGACY_FAVORITES=YES APPLY=YES OWNER_USERNAME=AKASH \
//   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" \
//   bun run scripts/migrate-legacy-favorites.ts
//
// The old Favorite table is left intact; this script only adds UserFavorite
// rows for the owner. Re-running is safe (upsert on user/type/name).
import { db, ensureSchema } from '../src/lib/db'
import { normalizeUsername } from '../src/lib/auth'

interface LegacyFavorite {
  objectType: string
  objectName: string
  label: string | null
}

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

async function main() {
  const username = normalizeUsername(process.env.OWNER_USERNAME ?? '')
  if (!username) fail('Set OWNER_USERNAME')
  if (process.env.TURSO_DATABASE_URL && process.env.CONFIRM_LEGACY_FAVORITES !== 'YES') {
    fail('Remote database detected. Re-run with CONFIRM_LEGACY_FAVORITES=YES after a backup.')
  }

  const tables = await db.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='Favorite'",
  )
  if (tables.length === 0) {
    console.log('✓ No legacy Favorite table exists — nothing to migrate.')
    process.exit(0)
  }

  await ensureSchema()
  const owner = await db.user.findUnique({ where: { username } })
  if (!owner) fail(`Owner ${username} does not exist — run owner:provision first`)

  const legacy = await db.$queryRawUnsafe<LegacyFavorite[]>(
    'SELECT objectType, objectName, label FROM Favorite ORDER BY id',
  )
  if (legacy.length === 0) {
    console.log('✓ Legacy Favorite table is empty — nothing to migrate.')
    process.exit(0)
  }

  console.log(`Found ${legacy.length} legacy global favorite(s); target owner: ${username}`)
  for (const f of legacy.slice(0, 10)) {
    console.log(`  · ${f.objectType} ${f.objectName}`)
  }
  if (legacy.length > 10) console.log(`  … ${legacy.length - 10} more`)

  if (process.env.APPLY !== 'YES') {
    console.log('Dry run only. Re-run with APPLY=YES to copy these rows to the owner.')
    process.exit(0)
  }

  let copied = 0
  for (const f of legacy) {
    const objectType = String(f.objectType || 'PROGRAM').toUpperCase().slice(0, 30)
    const objectName = String(f.objectName || '').toUpperCase().slice(0, 120)
    if (!objectName) continue
    await db.userFavorite.upsert({
      where: {
        userId_objectType_objectName: {
          userId: owner.id,
          objectType,
          objectName,
        },
      },
      update: { label: String(f.label ?? '').slice(0, 200) },
      create: {
        userId: owner.id,
        objectType,
        objectName,
        label: String(f.label ?? '').slice(0, 200),
      },
    })
    copied += 1
  }

  console.log(`✓ Copied ${copied} legacy favorite(s) to owner ${username}. The old table was left intact.`)
  process.exit(0)
}

main().catch((error) => {
  console.error('✗ Legacy favorite migration failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
