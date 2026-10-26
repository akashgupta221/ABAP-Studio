// End-to-end API authorization and isolation tests.
// Requires a running disposable server; see tests/run-api-tests.sh.
const BASE = process.env.BASE_URL ?? 'http://localhost:3100'
const ORIGIN = BASE
const OWNER_USER = 'TESTOWNER'
const E2E_SECRET = process.env.E2E_TEST_SECRET ?? ''

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
    testAuth?: boolean
  } = {},
): Promise<Result> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  const origin = opts.origin === undefined ? ORIGIN : opts.origin
  if (origin) headers.origin = origin
  if (opts.cookie) headers.cookie = opts.cookie
  if (opts.testAuth) {
    if (!E2E_SECRET) throw new Error('E2E_TEST_SECRET is required for test auth')
    headers['x-e2e-secret'] = E2E_SECRET
  }

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

async function createTestUser(username: string, extra: Record<string, unknown> = {}) {
  return call('/api/test/users', {
    method: 'POST',
    testAuth: true,
    body: { username, ...extra },
  })
}

async function testSession(username: string) {
  return call('/api/test/session', {
    method: 'POST',
    testAuth: true,
    body: { username },
  })
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
  check('test-session broker is hidden without its secret', (await call('/api/test/session', {
    method: 'POST',
    body: { username: OWNER_USER },
  })).status === 404)
  check('password logon is permanently retired', (await call('/api/auth/login', {
    method: 'POST',
    body: { username: OWNER_USER, password: 'anything' },
  })).status === 403)
  check('password registration is permanently retired', (await call('/api/auth/register', {
    method: 'POST',
    body: { username: `S${suffix}X`, password: 'anything' },
  })).status === 410)

  const ownerLogin = await testSession(OWNER_USER)
  check('owner test session is available', ownerLogin.status === 200, `status ${ownerLogin.status}`)
  check('owner session flag is returned for the dashboard UI', ownerLogin.data.user?.owner === true)
  const owner = ownerLogin.cookie

  const createA = await createTestUser(userA, { role: 'OWNER' })
  check('a test user can be created', createA.status === 201, JSON.stringify(createA.data))
  check('test users can never choose the OWNER role', createA.data.user?.role === 'USER')
  const sessionA = await testSession(userA)
  check('user A can establish a test session', sessionA.status === 200)
  const cookieA = sessionA.cookie

  const createB = await createTestUser(userB)
  check('second test user can be created', createB.status === 201)
  const sessionB = await testSession(userB)
  check('user B can establish a test session', sessionB.status === 200)
  const cookieB = sessionB.cookie

  check('invalid SAP user names are rejected by the test broker', (await createTestUser(`1${suffix}`)).status === 400)
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

  console.log('\nModern ABAP workspace')
  check('Modern workspace rejects anonymous callers', (await call('/api/modern')).status === 401)
  check('Modern validation rejects anonymous callers', (await call('/api/modern/validate', {
    method: 'POST',
    body: { kind: 'CDS', source: 'define view entity ZI_X as select from sflight { key carrid }' },
  })).status === 401)
  const modernOwner = await call('/api/modern', { cookie: owner })
  check('owner can list the Modern workspace', modernOwner.status === 200)
  const modernExamples = (modernOwner.data.programs ?? []).filter((p: any) => p.isExample)
  check('four Modern examples are seeded', modernExamples.length === 4, JSON.stringify(modernExamples.map((p: any) => p.name)))
  check(
    'the Modern examples cover ABAP, CDS, RAP and AMDP',
    new Set(modernExamples.map((p: any) => p.modernKind)).size === 4,
  )
  check(
    'the classic program list never contains Modern artefacts',
    !(await call('/api/programs', { cookie: cookieA })).data.programs?.some((p: any) => p.environment === 'MODERN'),
  )
  const constructors = modernExamples.find((p: any) => p.name === 'Z_MD_CONSTRUCTORS')
  const constructorDetail = constructors
    ? await call(`/api/modern/${constructors.id}`, { cookie: cookieA })
    : null
  check('a Modern ABAP example can be opened', constructorDetail?.status === 200)
  const modernRun = await call('/api/execute', {
    method: 'POST',
    cookie: cookieA,
    body: { name: 'Z_MD_CONSTRUCTORS', source: constructorDetail?.data.program.source ?? '' },
  })
  check(
    'the executable Modern ABAP example runs in the engine',
    modernRun.status === 200 && modernRun.data.status === 'SUCCESS' && modernRun.data.list.length > 0,
    JSON.stringify(modernRun.data?.error ?? {}),
  )

  const cdsExample = modernExamples.find((p: any) => p.name === 'ZI_MD_FLIGHT')
  const cdsDetail = cdsExample ? await call(`/api/modern/${cdsExample.id}`, { cookie: cookieA }) : null
  const cdsValidation = await call('/api/modern/validate', {
    method: 'POST',
    cookie: cookieA,
    body: { kind: 'CDS', source: cdsDetail?.data.program.source ?? '' },
  })
  check('the CDS example validates', cdsValidation.status === 200 && cdsValidation.data.validation?.status === 'VALID', JSON.stringify(cdsValidation.data))
  const badCds = await call('/api/modern/validate', {
    method: 'POST',
    cookie: cookieA,
    body: { kind: 'CDS', source: 'define view entity ZI_BAD as select from sflight' },
  })
  check('invalid CDS DDL is rejected', badCds.data.validation?.status === 'INVALID')
  const amdpExample = modernExamples.find((p: any) => p.name === 'ZCL_MD_AMDP')
  const amdpDetail = amdpExample ? await call(`/api/modern/${amdpExample.id}`, { cookie: cookieA }) : null
  const amdpValidation = await call('/api/modern/validate', {
    method: 'POST',
    cookie: cookieA,
    body: { kind: 'AMDP', source: amdpDetail?.data.program.source ?? '' },
  })
  check('the AMDP example validates structurally', amdpValidation.data.validation?.status === 'VALID')

  const modernName = `Z_MDMOD_${suffix}`
  const modernCreate = await call('/api/modern', {
    method: 'POST',
    cookie: cookieA,
    body: { name: modernName, modernKind: 'ABAP' },
  })
  check('a user can create a private Modern object', modernCreate.status === 201, JSON.stringify(modernCreate.data))
  const modernId = modernCreate.data?.program?.id
  check('private Modern objects record STANDARD/MODERN ownership fields',
    modernCreate.data?.program?.environment === 'MODERN' &&
    modernCreate.data?.program?.modernKind === 'ABAP' &&
    modernCreate.data?.program?.ownerId != null)
  check('invalid Modern kinds are rejected', (await call('/api/modern', {
    method: 'POST',
    cookie: cookieA,
    body: { name: `Z_MDMOD_BAD_${suffix}`, modernKind: 'DYNPRO' },
  })).status === 400)
  check('duplicate Modern names are rejected', (await call('/api/modern', {
    method: 'POST',
    cookie: cookieA,
    body: { name: modernName, modernKind: 'ABAP' },
  })).status === 409)
  const modernB = await call('/api/modern', { cookie: cookieB })
  check('user B does not see user A private Modern object', !(modernB.data.programs ?? []).some((p: any) => p.id === modernId))
  check('user B cannot open user A private Modern object', (await call(`/api/modern/${modernId}`, { cookie: cookieB })).status === 404)
  check('user B cannot save user A private Modern object', (await call(`/api/modern/${modernId}`, {
    method: 'PUT',
    cookie: cookieB,
    body: { source: "WRITE 'stolen'." },
  })).status === 404)
  check('user B cannot delete user A private Modern object', (await call(`/api/modern/${modernId}`, {
    method: 'DELETE',
    cookie: cookieB,
  })).status === 404)
  const modernOwnerSave = await call(`/api/modern/${modernId}`, {
    method: 'PUT',
    cookie: owner,
    body: { source: "WRITE 'owner reviewed modern'." },
  })
  check('the owner can edit a private Modern object', modernOwnerSave.status === 200)
  check('a Modern object kind is immutable', (await call(`/api/modern/${modernId}`, {
    method: 'PUT',
    cookie: cookieA,
    body: { modernKind: 'CDS' },
  })).status === 400)
  check('the owner can delete a private Modern object', (await call(`/api/modern/${modernId}`, {
    method: 'DELETE',
    cookie: owner,
  })).status === 200)

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

  const programName = created.data?.program?.name
  const exampleProgram = (overview.data.programs ?? []).find((p: any) => p.isExample)
  check('an example program is available for the protection test', !!exampleProgram)
  check('ordinary user cannot use owner program deletion', (await call(`/api/admin/programs/${programId}`, {
    method: 'DELETE',
    cookie: cookieA,
    body: { confirmName: programName },
  })).status === 403)
  check('example programs cannot be deleted by the owner', exampleProgram
    ? (await call(`/api/admin/programs/${exampleProgram.id}`, {
        method: 'DELETE',
        cookie: owner,
        body: { confirmName: exampleProgram.name },
      })).status === 403
    : false)
  check('owner program deletion requires the exact name', (await call(`/api/admin/programs/${programId}`, {
    method: 'DELETE',
    cookie: owner,
    body: { confirmName: 'WRONG' },
  })).status === 400)
  check('owner can delete another user private program', (await call(`/api/admin/programs/${programId}`, {
    method: 'DELETE',
    cookie: owner,
    body: { confirmName: programName },
  })).status === 200)
  check('deleted private program is gone', (await call(`/api/programs/${programId}`, { cookie: cookieA })).status === 404)
  const overviewAfterDelete = await call('/api/admin/overview', { cookie: owner })
  check('owner program deletion is audited', (overviewAfterDelete.data.audit ?? []).some((a: any) => a.action === 'PROGRAM_DELETE' && a.targetId === programId))

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
  check('suspended user cannot mint a test session', (await testSession(userB)).status === 403)
  check('suspended user cannot use the retired password endpoint', (await call('/api/auth/login', {
    method: 'POST',
    body: { username: userB, password: 'anything' },
  })).status === 403)
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
