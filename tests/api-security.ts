// End-to-end API authorization and isolation tests.
// Requires a running disposable server; see tests/run-api-tests.sh.
const BASE = process.env.BASE_URL ?? 'http://localhost:3100'
const ORIGIN = BASE
const OWNER_USER = 'TESTOWNER'
const OWNER_PASS = 'TestOwnerPass123!'
const USER_PASS = 'UserPass123!'

interface Result {
  status: number
  data: any
  cookie: string | null
}

async function call(
  path: string,
  opts: {
    method?: string
    cookie?: string | null
    body?: unknown
    origin?: string | null
  } = {},
): Promise<Result> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  const origin = opts.origin === undefined ? ORIGIN : opts.origin
  if (origin) headers.origin = origin
  if (opts.cookie) headers.cookie = opts.cookie

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    redirect: 'manual',
  })
  let data: any = null
  const text = await res.text()
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  const setCookie = res.headers.get('set-cookie')
  return {
    status: res.status,
    data,
    cookie: setCookie ? setCookie.split(';')[0] : null,
  }
}

let passed = 0
const failures: string[] = []

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function main() {
  const suffix = Date.now().toString().slice(-7)
  const userA = `T${suffix}A`
  const userB = `T${suffix}B`

  console.log('\nAuthentication and session boundaries')
  check('health is public', (await call('/api/health')).status === 200)
  check('program list rejects anonymous callers', (await call('/api/programs')).status === 401)
  check('favorites reject anonymous callers', (await call('/api/favorites')).status === 401)
  check('execution rejects anonymous callers', (await call('/api/execute', { method: 'POST', body: { source: "WRITE 'x'." } })).status === 401)
  check('admin overview rejects anonymous callers', (await call('/api/admin/overview')).status === 401)
  check('seed endpoint rejects anonymous callers', (await call('/api/seed', { method: 'POST', body: {} })).status === 401)

  const ownerLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { username: OWNER_USER, password: OWNER_PASS },
  })
  check('owner can log on', ownerLogin.status === 200, `status ${ownerLogin.status}`)
  check('owner login flag is returned for the dashboard UI', ownerLogin.data.user?.owner === true)
  const owner = ownerLogin.cookie

  const regA = await call('/api/auth/register', {
    method: 'POST',
    body: { username: userA, password: USER_PASS, role: 'OWNER' },
  })
  check('public registration creates a USER, ignoring a client-supplied role', regA.status === 200 && regA.data.user.role === 'USER')
  check('public registration is never flagged as owner', regA.data.user?.owner !== true)
  const cookieA = regA.cookie

  const regB = await call('/api/auth/register', {
    method: 'POST',
    body: { username: userB, password: USER_PASS },
  })
  check('second public user can register', regB.status === 200)
  const cookieB = regB.cookie

  check('short passwords are rejected', (await call('/api/auth/register', { method: 'POST', body: { username: `S${suffix}X`, password: 'short' } })).status === 400)
  check('cross-origin mutation is rejected', (await call('/api/programs', {
    method: 'POST',
    cookie: cookieA,
    origin: 'https://evil.example',
    body: { name: `Z_CSRF_${suffix}`, source: '' },
  })).status === 403)

  console.log('\nProgram ownership and isolation')
  const created = await call('/api/programs', {
    method: 'POST',
    cookie: cookieA,
    body: {
      name: `Z_API_${suffix}`,
      title: 'API isolation test',
      source: "WRITE 'isolated'.",
    },
  })
  check('user A can create a private program', created.status === 201, JSON.stringify(created.data))
  const programId = created.data?.program?.id
  check('new program records its owner', created.data?.program?.ownerId != null)

  const listB = await call('/api/programs', { cookie: cookieB })
  check('user B does not see user A private program', !(listB.data.programs ?? []).some((p: any) => p.id === programId))
  const topicsA = await call('/api/topics', { cookie: cookieA })
  const topicId = topicsA.data.topics?.[0]?.id
  check('a syllabus topic is available for the isolation test', typeof topicId === 'number')
  await call(`/api/programs/${programId}`, { method: 'PUT', cookie: cookieA, body: { topicId } })
  const topicsB = await call('/api/topics', { cookie: cookieB })
  check('private program topic membership is not leaked', !JSON.stringify(topicsB.data).includes(`Z_API_${suffix}`))
  check('user B cannot open user A program by id', (await call(`/api/programs/${programId}`, { cookie: cookieB })).status === 404)
  check('user B cannot save user A program', (await call(`/api/programs/${programId}`, { method: 'PUT', cookie: cookieB, body: { title: 'stolen' } })).status === 404)
  check('user B cannot delete user A program', (await call(`/api/programs/${programId}`, { method: 'DELETE', cookie: cookieB })).status === 404)

  const ownerOpen = await call(`/api/programs/${programId}`, { cookie: owner })
  check('designated owner can open any private program', ownerOpen.status === 200 && ownerOpen.data.program.name === `Z_API_${suffix}`)
  const ownerEdit = await call(`/api/programs/${programId}`, { method: 'PUT', cookie: owner, body: { title: 'Owner reviewed' } })
  check('designated owner can edit a private program', ownerEdit.status === 200 && ownerEdit.data.program.title === 'Owner reviewed')

  check('reserved sandbox names cannot be created as normal programs', (await call('/api/programs', {
    method: 'POST',
    cookie: cookieA,
    body: { name: 'Z_MY_PRACTICE', source: '' },
  })).status === 409)

  console.log('\nPrivate practice sandboxes')
  const sandboxA = await call('/api/sandbox', { method: 'POST', cookie: cookieA })
  const sandboxB = await call('/api/sandbox', { method: 'POST', cookie: cookieB })
  check('user A gets a sandbox', sandboxA.status === 201 || sandboxA.status === 200)
  check('user B gets a sandbox', sandboxB.status === 201 || sandboxB.status === 200)
  check('sandboxes are distinct rows', sandboxA.data.program.id !== sandboxB.data.program.id)
  await call(`/api/programs/${sandboxA.data.program.id}`, {
    method: 'PUT',
    cookie: cookieA,
    body: { source: "WRITE 'A only'." },
  })
  const bSandbox = await call(`/api/programs/${sandboxB.data.program.id}`, { cookie: cookieB })
  check('editing one sandbox does not affect another user', !String(bSandbox.data.program.source).includes('A only'))

  console.log('\nFavorites, executions and recents')
  check('user A can favorite an object', (await call('/api/favorites', {
    method: 'POST',
    cookie: cookieA,
    body: { objectType: 'REPORT', objectName: `Z_API_${suffix}`, label: 'mine' },
  })).status === 201)
  const favB = await call('/api/favorites', { cookie: cookieB })
  check('favorites do not leak between users', (favB.data.favorites ?? []).length === 0)
  const favA = await call('/api/favorites', { cookie: cookieA })
  check('user A still sees their favorite', (favA.data.favorites ?? []).length === 1)

  const exec = await call('/api/execute', {
    method: 'POST',
    cookie: cookieA,
    body: { name: `Z_API_${suffix}`, source: "WRITE 'hello from A'." },
  })
  check('an authenticated user can execute ABAP', exec.status === 200 && exec.data.status === 'SUCCESS')
  check('execution records the user', (await call('/api/recents', { cookie: cookieA })).data.recents?.length >= 1)
  check('one user cannot see another user recents', (await call('/api/recents', { cookie: cookieB })).data.recents?.length === 0)

  console.log('\nOwner administration')
  check('ordinary user is denied admin overview', (await call('/api/admin/overview', { cookie: cookieA })).status === 403)
  const overview = await call('/api/admin/overview', { cookie: owner })
  check('owner receives administration metrics', overview.status === 200 && overview.data.metrics.totalUsers >= 3)
  check(
    'owner receives a 7-day execution series',
    Array.isArray(overview.data.executionSeries) &&
      overview.data.executionSeries.length === 7 &&
      overview.data.executionSeries.every(
        (day: any) => typeof day.date === 'string' && Number.isInteger(day.executions),
      ),
  )
  check('owner sees every repository program', (overview.data.programs ?? []).some((p: any) => p.id === programId))
  check('owner sees user list without password hashes', !JSON.stringify(overview.data.users).includes('passwordHash'))

  const bUser = (overview.data.users ?? []).find((u: any) => u.username === userB)
  check('owner can identify user B', !!bUser)
  check('ordinary user cannot suspend another account', (await call(`/api/admin/users/${bUser.id}`, {
    method: 'PATCH',
    cookie: cookieA,
    body: { action: 'suspend' },
  })).status === 403)
  check('owner can suspend user B', (await call(`/api/admin/users/${bUser.id}`, {
    method: 'PATCH',
    cookie: owner,
    body: { action: 'suspend' },
  })).status === 200)
  check('suspension invalidates an existing session', (await call('/api/programs', { cookie: cookieB })).status === 401)
  check('suspended user cannot log on', (await call('/api/auth/login', { method: 'POST', body: { username: userB, password: USER_PASS } })).status === 403)
  check('owner can reactivate user B', (await call(`/api/admin/users/${bUser.id}`, {
    method: 'PATCH',
    cookie: owner,
    body: { action: 'reactivate' },
  })).status === 200)

  const ownerId = (overview.data.users ?? []).find((u: any) => u.username === OWNER_USER)?.id
  check('owner cannot suspend themselves', (await call(`/api/admin/users/${ownerId}`, {
    method: 'PATCH',
    cookie: owner,
    body: { action: 'suspend' },
  })).status === 400)
  check('owner cannot delete themselves', (await call(`/api/admin/users/${ownerId}`, {
    method: 'DELETE',
    cookie: owner,
    body: { confirmUsername: OWNER_USER },
  })).status === 403)
  check('deletion requires the exact user name', (await call(`/api/admin/users/${bUser.id}`, {
    method: 'DELETE',
    cookie: owner,
    body: { confirmUsername: 'WRONG' },
  })).status === 400)

  console.log('\nLogout and revocation')
  const replay = cookieA
  check('logout succeeds', (await call('/api/auth/logout', { method: 'POST', cookie: cookieA })).status === 200)
  check('logged-out session cookie is rejected', (await call('/api/programs', { cookie: replay })).status === 401)
  const me = await call('/api/auth/me', { cookie: replay })
  check('/api/auth/me reports no user after logout', me.status === 200 && me.data.user === null)
  check('a logged-out browser does not silently sign back in', (await call('/api/programs')).status === 401)

  console.log(`\n${passed} checks passed, ${failures.length} failed`)
  if (failures.length) {
    for (const f of failures) console.error(`  FAIL: ${f}`)
    process.exit(1)
  }
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
