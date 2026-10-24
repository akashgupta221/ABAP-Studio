// Set an owner password interactively without echoing it to the terminal or
// storing it in shell history. Run:
//   OWNER_USERNAME=AKASH bun run scripts/set-owner-password.ts
//
// The account must already exist. The new password is scrypt-hashed locally and
// every existing session is revoked. Works against local SQLite or Turso (set
// TURSO_DATABASE_URL + TURSO_AUTH_TOKEN and CONFIRM_OWNER_PASSWORD=YES).
import { db } from '../src/lib/db'
import { hashPassword, normalizeUsername } from '../src/lib/auth'

function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    if (!stdin.isTTY) {
      // Piped input (CI) — still avoid echoing the value ourselves.
      let data = ''
      stdin.setEncoding('utf8')
      stdin.resume()
      stdin.on('data', (chunk) => {
        data += chunk
      })
      stdin.on('end', () => resolve(data.split(/\r?\n/)[0] ?? ''))
      return
    }

    process.stdout.write(question)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let value = ''
    const cleanup = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.off('data', onData)
    }
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          cleanup()
          process.stdout.write('\n')
          resolve(value)
          return
        }
        if (ch === '\u0003') {
          cleanup()
          process.stdout.write('\n')
          reject(new Error('cancelled'))
          return
        }
        if (ch === '\u007f' || ch === '\b') {
          if (value) {
            value = value.slice(0, -1)
            process.stdout.write('\b \b')
          }
          continue
        }
        value += ch
        process.stdout.write('*')
      }
    }
    stdin.on('data', onData)
  })
}

async function main() {
  const username = normalizeUsername(process.env.OWNER_USERNAME ?? '')
  if (!username) {
    console.error('✗ Set OWNER_USERNAME')
    process.exit(1)
  }
  if (process.env.TURSO_DATABASE_URL && process.env.CONFIRM_OWNER_PASSWORD !== 'YES') {
    console.error('✗ Remote database detected. Re-run with CONFIRM_OWNER_PASSWORD=YES.')
    process.exit(1)
  }

  const user = await db.user.findUnique({ where: { username } })
  if (!user) {
    console.error(`✗ User ${username} does not exist — run scripts/provision-owner.ts first`)
    process.exit(1)
  }

  const password = await askHidden(`New password for ${username}: `)
  if (password.length < 8) {
    console.error('✗ Password must have at least 8 characters')
    process.exit(1)
  }
  const confirm = await askHidden('Repeat password: ')
  if (password !== confirm) {
    console.error('✗ Passwords do not match')
    process.exit(1)
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } },
  })
  console.log(`✓ Password updated for ${username}. All previous sessions were revoked.`)
  process.exit(0)
}

main().catch((error) => {
  console.error('✗ Password update failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
