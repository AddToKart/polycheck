#!/usr/bin/env node
/**
 * Orchestrates a local load run: server sampler -> k6 -> per-flow table ->
 * DB integrity check -> Markdown report.
 *
 * Exact command lines (from the repo root):
 *
 *   # burst: all users at once (login IP limit will throttle ~1000 logins)
 *   node performance/run-load.mjs \
 *     --run lt5-burst --shape burst --users 2000 \
 *     --fixture performance/.local-fixture-lt5-burst.json \
 *     --script performance/mixed-load.js \
 *     --k6 /c/Users/Cayz/tools/k6/k6-v2.3.0-windows-amd64/k6.exe
 *
 *   # arrival: paced arrivals (no 429 at 2000 students / 900 s)
 *   node performance/run-load.mjs \
 *     --run lt5-arrival --shape arrival --users 2000 --arrival-rate 2.22 \
 *     --fixture performance/.local-fixture-lt5-arrival.json \
 *     --script performance/mixed-load.js \
 *     --k6 /c/Users/Cayz/tools/k6/k6-v2.3.0-windows-amd64/k6.exe
 *
 * Env equivalents: K6_BIN, K6_FIXTURE_FILE, K6_SCRIPT, K6_RUN_ID.
 *
 * Safety bounds: --max-wall-minutes (default 30) kills k6/observer and still
 * writes a partial report; --observer-timeout-seconds (default 30) bounds the
 * wait for the sampler's first sample and falls back to no server sampling.
 * --duration <k6 duration> is forwarded to k6 itself and is a hard cap; in this
 * k6 build that replaces the script's scenario with the default executor, so
 * use it for bounded smoke/validation runs (omit it for script-shaped arrival
 * pacing, which otherwise derives its duration from users/rate).
 *
 * Note: the k6 scripts take BASE_URL and K6_RUN_ID from the fixture (K6_RUN_ID
 * scopes clientAttemptIds), so --run-id only names our output files and the
 * value we pass; it does not re-scope a run. Use a fresh Prepare fixture for
 * that. Arrival runs are tagged {shape:paced} by the scripts; burst runs
 * {shape:burst}. k6 exits 99 on a threshold/SLO breach (latency SLOs stay
 * enforced in burst/full); that is still a valid data set and the report says so.
 *
 * What it does, in order:
 *   1. spawns observe.mjs and waits for its first sample (OBSERVER_READY or the
 *      first NDJSON line)
 *   2. runs k6 with --summary-export results/<name>.json and
 *      K6_SHAPE / K6_RATE_PER_SECOND / K6_USER_COUNT / K6_FIXTURE_FILE passed
 *      as `-e KEY=VALUE` (this k6 build does not forward process env to __ENV).
 *      mixed-load.js burst gets K6_MIX_VUS=users and
 *      K6_MIX_ITERATIONS_PER_VU=1 (override via env). mixed-load.js arrival gets
 *      K6_MIX_RATE_PER_SECOND (default = --arrival-rate or users/900) and
 *      K6_MIX_DURATION from --duration. attendance/login arrivals use
 *      K6_RATE_PER_SECOND / K6_LOGIN_RATE_PER_SECOND respectively.
 *   3. stops the sampler and renders flow_success{flow}, flow_throttled{flow},
 *      flow_attempts{flow}, flow_duration{flow} (fallback
 *      http_req_duration{operation}) with one table per shape
 *   4. queries Postgres for the run's sessions (AttendanceRecord by status,
 *      ScanAttempt outcomes) and reports accepted / submitted
 *   5. writes performance/results/<name>.md
 *
 * Truthfulness: zero-attempt flows are "n/a"; 429s get their own column and are
 * excluded from the success denominator; k6 vs DB disagreements are called out
 * loudly. This script deliberately never aggregates across shapes.
 */
import { execFile, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { parseSummary, renderFlowTables, flowRow, fmtInt, fmtPercent, fmtMs, fmtBytes } from './summarize.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

const { values } = parseArgs({
  options: {
    run: { type: 'string' },
    shape: { type: 'string' },
    users: { type: 'string' },
    fixture: { type: 'string' },
    'run-id': { type: 'string' },
    script: { type: 'string' },
    'arrival-rate': { type: 'string' },
    'arrival-window': { type: 'string' },
    'mix-rate': { type: 'string' },
    k6: { type: 'string' },
    profile: { type: 'string' },
    duration: { type: 'string' },
    'out-dir': { type: 'string' },
    'compose-file': { type: 'string' },
    'base-url': { type: 'string' },
    'max-wall-minutes': { type: 'string' },
    'observer-timeout-seconds': { type: 'string' },
    'skip-observer': { type: 'boolean', default: false },
    'skip-integrity': { type: 'boolean', default: false },
  },
  allowPositionals: false,
})

const runName = values.run
if (!runName || !/^[A-Za-z0-9._-]{1,80}$/.test(runName)) {
  console.error('run-load.mjs: --run <name> is required (1-80 safe characters)')
  process.exit(2)
}
const shape = values.shape
if (!['burst', 'arrival'].includes(shape)) {
  console.error('run-load.mjs: --shape must be burst or arrival')
  process.exit(2)
}
const users = Number(values.users)
if (!Number.isInteger(users) || users < 1 || users > 5000) {
  console.error('run-load.mjs: --users must be an integer between 1 and 5000')
  process.exit(2)
}

// Git Bash/MSYS paths like /c/Users/... are not understood by Node on Windows.
const normalizeFsPath = (path) =>
  typeof path === 'string' && /^\/[a-zA-Z]\//.test(path) ? `${path[1].toUpperCase()}:/${path.slice(3)}` : path
const resolvePath = (path) => {
  const normalized = normalizeFsPath(path)
  return isAbsolute(normalized) ? normalized : resolve(repoRoot, normalized)
}
const outDir = resolvePath(values['out-dir'] || join('performance', 'results'))
const summaryPath = join(outDir, `${runName}.json`)
const reportPath = join(outDir, `${runName}.md`)
const ndjsonPath = join(outDir, `${runName}-server.ndjson`)
const serverSummaryPath = join(outDir, `${runName}-server.json`)
const composeFile = resolvePath(values['compose-file'] || 'docker-compose.local.yml')
const compose = ['compose', '-f', composeFile]

const runId = values['run-id'] || process.env.K6_RUN_ID || runName
if (!/^[A-Za-z0-9._-]{1,64}$/.test(runId)) {
  console.error('run-load.mjs: --run-id must be 1-64 safe characters')
  process.exit(2)
}

const fixturePath = resolvePath(values.fixture || process.env.K6_FIXTURE_FILE || join('performance', `.local-fixture-${runId}.json`))
if (!existsSync(fixturePath)) {
  console.error(`run-load.mjs: fixture not found at ${fixturePath}`)
  console.error('Run the Prepare agent (performance/prepare-local.mjs) first, or pass --fixture.')
  process.exit(2)
}
let fixture
try {
  fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
} catch (error) {
  console.error(`run-load.mjs: fixture is not valid JSON: ${error.message}`)
  process.exit(2)
}
const fixtureStudents = Array.isArray(fixture.students) ? fixture.students : []
const fixtureSections = Array.isArray(fixture.sections) ? fixture.sections : []
if (fixtureSections.length === 0) {
  console.warn('run-load.mjs: fixture has no sections[]; integrity check will be skipped')
}
if (fixtureStudents.length > 0 && users > fixtureStudents.length) {
  console.warn(`run-load.mjs: --users ${users} exceeds fixture students ${fixtureStudents.length}`)
}

const scriptPath = resolvePath(values.script || process.env.K6_SCRIPT || join('performance', 'mixed-load.js'))
if (!existsSync(scriptPath)) {
  console.error(`run-load.mjs: k6 script not found at ${scriptPath}`)
  process.exit(2)
}
const k6Bin = normalizeFsPath(values.k6 || process.env.K6_BIN || process.env.K6 || 'k6')
const baseUrl = (values['base-url'] || fixture.BASE_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '').replace(/\/api$/, '')
const observerBaseUrl = baseUrl

const arrivalWindow = Number(values['arrival-window'])
const arrivalRate =
  shape === 'arrival'
    ? Number(
        Number(
          values['arrival-rate'] ?? (Number.isFinite(arrivalWindow) && arrivalWindow > 0 ? users / arrivalWindow : users / 900),
        ).toFixed(3),
      )
    : null
if (shape === 'arrival' && (!Number.isFinite(arrivalRate) || arrivalRate <= 0)) {
  console.error('run-load.mjs: --arrival-rate must be a positive number for arrival runs')
  process.exit(2)
}

mkdirSync(outDir, { recursive: true })

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

const exec = (file, args, timeout = 30000) =>
  new Promise((resolvePromise) => {
    execFile(
      file,
      args,
      { timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (error) resolvePromise({ ok: false, error: `${error.message} ${String(stderr || '').slice(0, 400)}`.trim(), stdout: '' })
        else resolvePromise({ ok: true, stdout })
      },
    )
  })

const psql = (sql) =>
  exec('docker', [...compose, 'exec', '-T', 'postgres', 'psql', '-U', 'polycheck', '-d', 'polycheck', '-tA', '-F', '\t', '-c', sql], 45000)

/* ------------------------------------------------------- lifecycle hardening */

const maxWallMinutes = Number(values['max-wall-minutes'] ?? 30)
if (!Number.isFinite(maxWallMinutes) || maxWallMinutes <= 0) {
  console.error('run-load.mjs: --max-wall-minutes must be a positive number')
  process.exit(2)
}
const maxWallMs = maxWallMinutes * 60 * 1000
const observerReadyTimeoutMs = Math.max(1, Number(values['observer-timeout-seconds'] ?? 30)) * 1000
let wallGuardFired = false
const liveChildren = new Set()

const trackChild = (child) => {
  liveChildren.add(child)
  child.once('exit', () => liveChildren.delete(child))
  return child
}

const killChild = (child, signal = 'SIGTERM') => {
  if (!child || child.exitCode !== null || child.signalCode) return
  try {
    child.kill(signal)
  } catch {
    // already gone
  }
  if (process.platform === 'win32' && child.pid) {
    try {
      // /T also kills grandchildren (docker CLI helpers, if any).
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 5000 })
    } catch {
      // best effort
    }
  }
}

const killAllChildren = () => {
  for (const child of liveChildren) killChild(child)
  liveChildren.clear()
}

const onSignal = (signal) => {
  console.error(`\n[${signal}] killing k6/observer children and exiting`)
  killAllChildren()
  process.exit(signal === 'SIGINT' ? 130 : 143)
}
process.on('SIGINT', () => onSignal('SIGINT'))
process.on('SIGTERM', () => onSignal('SIGTERM'))

/* ------------------------------------------------------------------ observer */

const startObserver = () => {
  if (existsSync(ndjsonPath)) {
    try {
      unlinkSync(ndjsonPath)
    } catch {
      // A stale NDJSON file only means the first-sample wait would return early;
      // the sampler appends, so remove best-effort only.
    }
  }
  const child = spawn(
    process.execPath,
    [join(here, 'observe.mjs'), '--run', runName, '--out-dir', outDir, '--base-url', observerBaseUrl],
    { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, OBSERVE_STDIN_STOP: '1' } },
  )
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => process.stdout.write(chunk))
  child.stderr.on('data', (chunk) => process.stderr.write(chunk))
  child.on('error', (error) => console.error(`observer spawn error: ${error.message}`))
  return trackChild(child)
}

const waitForFirstSample = async (child, timeoutMs = 30000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      console.warn(`[observe] exited before its first sample (code ${child.exitCode}); continuing without server-side sampling`)
      return false
    }
    try {
      if (statSync(ndjsonPath).size > 0) return true
    } catch {
      // not written yet
    }
    await sleep(100)
  }
  console.warn(`[observe] no sample within ${Math.round(timeoutMs / 1000)}s; continuing without server-side sampling`)
  return false
}

const stopObserver = async (child) => {
  if (!child || child.exitCode !== null) return
  try {
    child.stdin.write('stop\n')
    child.stdin.end()
  } catch {
    // stdin may already be closed
  }
  await new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      console.warn('[observe] did not stop within 10s; killing')
      killChild(child)
      resolvePromise()
    }, 10000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolvePromise()
    })
  })
}

/* ------------------------------------------------------------------------ k6 */

// This k6 build does NOT expose process env through __ENV, so every variable
// must be passed as `-e KEY=VALUE`. Unmanaged K6_* variables from the caller
// (K6_MODE, K6_SCAN_VUS, ...) are forwarded as-is; managed ones are set below.
const MANAGED_K6_VARS = new Set([
  'K6_FIXTURE_FILE',
  'K6_RUN_ID',
  'K6_SHAPE',
  'K6_USER_COUNT',
  'K6_SUMMARY_EXPORT',
  'K6_BASE_URL',
  'K6_PROFILE',
  'K6_MIX_DURATION',
  'K6_RATE_PER_SECOND',
  'K6_LOGIN_RATE_PER_SECOND',
])
const k6Vars = new Map()
for (const [key, value] of Object.entries(process.env)) {
  if (/^K6_[A-Za-z0-9_]+$/.test(key) && typeof value === 'string' && value.length > 0 && !MANAGED_K6_VARS.has(key)) {
    k6Vars.set(key, value)
  }
}
const setK6Var = (key, value) => k6Vars.set(key, String(value))
setK6Var('K6_FIXTURE_FILE', fixturePath)
setK6Var('K6_RUN_ID', runId)
setK6Var('K6_SHAPE', shape)
setK6Var('K6_USER_COUNT', users)
setK6Var('K6_SUMMARY_EXPORT', summaryPath)
setK6Var('K6_BASE_URL', baseUrl)
if (values.profile) setK6Var('K6_PROFILE', values.profile)
if (values.duration) setK6Var('K6_MIX_DURATION', values.duration)
if (shape === 'arrival') {
  setK6Var('K6_RATE_PER_SECOND', arrivalRate)
  setK6Var('K6_LOGIN_RATE_PER_SECOND', arrivalRate)
}
// Script-specific knobs (LoadScenarios' contract):
//  - mixed-load.js burst: VUs x iterations, NOT K6_USER_COUNT-as-VUs
//  - mixed-load.js arrival: K6_MIX_RATE_PER_SECOND (blended iterations/s)
//  - attendance-load.js arrival: K6_RATE_PER_SECOND (scans/s)
//  - login-load.js arrival: K6_LOGIN_RATE_PER_SECOND (logins/s)
const scriptBase = basename(scriptPath)
const isMixedScript = scriptBase === 'mixed-load.js'
if (isMixedScript && shape === 'burst') {
  if (!k6Vars.has('K6_MIX_VUS')) setK6Var('K6_MIX_VUS', users)
  if (!k6Vars.has('K6_MIX_ITERATIONS_PER_VU')) setK6Var('K6_MIX_ITERATIONS_PER_VU', 1)
}
if (isMixedScript && shape === 'arrival') {
  if (values['mix-rate'] !== undefined) {
    const mixRate = Number(values['mix-rate'])
    if (!Number.isFinite(mixRate) || mixRate <= 0) {
      console.error('run-load.mjs: --mix-rate must be a positive number for mixed arrival runs')
      process.exit(2)
    }
    setK6Var('K6_MIX_RATE_PER_SECOND', mixRate)
  } else if (!k6Vars.has('K6_MIX_RATE_PER_SECOND')) {
    setK6Var('K6_MIX_RATE_PER_SECOND', arrivalRate)
  }
  if (!k6Vars.has('K6_MIX_DURATION')) {
    // Cover the whole population: at `mixRate` flows/s, `users` flows need
    // users/mixRate seconds. Without this the script's '5m' default silently
    // truncated a 2,000-user run to ~680 flows (Addendum 2, H1).
    const mixRate = Number(k6Vars.get('K6_MIX_RATE_PER_SECOND')) || arrivalRate
    const windowSeconds = Math.max(60, Math.ceil(users / mixRate))
    setK6Var('K6_MIX_DURATION', values.duration ?? `${windowSeconds}s`)
  }
}
const loadModel = isMixedScript
  ? shape === 'burst'
    ? `${k6Vars.get('K6_MIX_VUS')} VUs x ${k6Vars.get('K6_MIX_ITERATIONS_PER_VU')} iterations (mixed flows)`
    : `${k6Vars.get('K6_MIX_RATE_PER_SECOND')}/s blended iterations for ${k6Vars.get('K6_MIX_DURATION')}`
  : shape === 'burst'
    ? scriptBase === 'login-load.js'
      ? `all ${users} students log in once (burst)`
      : `${users} scan VUs, one scan each (burst)`
    : scriptBase === 'login-load.js'
      ? `${arrivalRate} logins/s`
      : `${arrivalRate} scans/s`

const runK6 = () =>
  new Promise((resolvePromise, reject) => {
    const args = ['run']
    for (const [key, value] of k6Vars) args.push('-e', `${key}=${value}`)
    // --duration is deliberately NOT forwarded to the k6 CLI: in this k6 build
    // it replaces the script's scenarios with k6's default executor (1 VU),
    // which silently destroys both arrival and burst runs. It is mapped into the
    // script's own env knob instead (K6_MIX_DURATION, set above); scripts that
    // derive their window from count/rate ignore it.
    if (values.duration) {
      console.warn(
        `[k6] --duration ${values.duration} is applied as K6_MIX_DURATION only; it is not forwarded to the CLI because that would replace the script's scenarios`,
      )
    }
    args.push('--summary-export', summaryPath, '--summary-trend-stats', 'avg,min,med,max,p(90),p(95),p(99)', scriptPath)
    console.log(`\n[k6] ${k6Bin} ${args.join(' ')}`)
    console.log(
      `[k6] shape=${shape} users=${users}${shape === 'arrival' ? ` rate=${arrivalRate}/s` : ''} fixture=${fixturePath}`,
    )
    const child = trackChild(spawn(k6Bin, args, { stdio: 'inherit', env: process.env, windowsHide: true }))
    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error(`k6 binary "${k6Bin}" not found. Pass --k6 /c/Users/Cayz/tools/k6/k6-v2.3.0-windows-amd64/k6.exe`))
      } else {
        reject(error)
      }
    })
    child.on('exit', (code, signal) => resolvePromise({ code, signal }))
  })

/* ----------------------------------------------------------------- integrity */

const quoteIds = (ids) => ids.filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id)).map((id) => `'${id}'`).join(',')

const parseRows = (stdout) =>
  stdout
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.length > 0)
    .map((line) => line.split('\t'))

const collectIntegrity = async (parsed, sinceMs = 0) => {
  const sessionIds = fixtureSections.map((section) => section.sessionId).filter(Boolean)
  const inList = quoteIds(sessionIds)
  // Scope every query to THIS run's window. Session ids are fixture-wide, so
  // without this a re-run on a used fixture — or any script that does not scan,
  // such as login-load.js — compares its own traffic against rows left behind by
  // earlier runs and reports a phantom mismatch (Addendum 2, H3).
  const sinceIso = new Date(Math.max(0, sinceMs)).toISOString()
  const sinceClause = `"createdAt" >= '${sinceIso}'::timestamptz`
  const shapeTag = shape === 'arrival' ? 'paced' : 'burst'
  const scanRow = flowRow(parsed, 'scan', shapeTag) ?? flowRow(parsed, 'scan')
  if (!inList) {
    return { available: false, reason: 'fixture has no session ids', scanRow }
  }
  const [statusResult, disputeResult, attemptResult] = await Promise.all([
    psql(`SELECT status::text, count(*)::text FROM "AttendanceRecord" WHERE "sessionId" IN (${inList}) AND ${sinceClause} GROUP BY status ORDER BY status`),
    psql(
      `SELECT "sessionId", "studentId", coalesce("studentName", ''), coalesce("disputeReason", ''), regexp_replace(coalesce("disputeDescription", ''), '[[:space:]]+', ' ', 'g'), "createdAt"::text FROM "AttendanceRecord" WHERE "sessionId" IN (${inList}) AND ${sinceClause} AND status = 'disputed' ORDER BY "createdAt" LIMIT 100`,
    ),
    psql(`SELECT outcome, count(*)::text FROM "ScanAttempt" WHERE "sessionId" IN (${inList}) AND ${sinceClause} GROUP BY outcome ORDER BY outcome`),
  ])
  if (!statusResult.ok || !disputeResult.ok || !attemptResult.ok) {
    return {
      available: false,
      reason: [statusResult.error, disputeResult.error, attemptResult.error].filter(Boolean).join('; '),
      scanRow,
    }
  }
  const statusCounts = {}
  for (const [status, count] of parseRows(statusResult.stdout)) statusCounts[status] = Number(count) || 0
  const scanOutcomes = {}
  for (const [outcome, count] of parseRows(attemptResult.stdout)) scanOutcomes[outcome] = Number(count) || 0
  const disputedRows = parseRows(disputeResult.stdout).map(
    ([sessionId, studentId, studentName, reason, description, createdAt]) => ({
      sessionId,
      studentId,
      studentName,
      reason,
      description,
      createdAt,
    }),
  )

  const accepted = (statusCounts.present ?? 0) + (statusCounts.late ?? 0)
  const disputed = statusCounts.disputed ?? 0
  const absent = statusCounts.absent ?? 0
  const dbSubmitted = Object.values(scanOutcomes).reduce((total, count) => total + count, 0)
  const submitted = scanRow?.attempts ?? null
  const denominator = submitted ?? dbSubmitted
  const acceptedOverSubmitted = denominator > 0 ? accepted / denominator : null
  const acceptedOverDbSubmitted = dbSubmitted > 0 ? accepted / dbSubmitted : null
  const successes = scanRow?.successes ?? null
  const throttled = scanRow?.throttled ?? 0
  const tolerance = Math.max(5, Math.ceil((successes ?? 0) * 0.005))
  const accounted = accepted + disputed
  // dispute and excuse call ensureRecord(), which mints its own record via
  // POST /attendance/scan for students who had not scanned yet; sync replays
  // write rows for the same reason. Those rows are legitimate but were never
  // counted under flow:scan, so the DB may legitimately EXCEED the k6 success
  // count by up to that many rows. Only a shortfall is loss (Addendum 2, H2).
  const mintedUpperBound = ['dispute', 'excuse', 'sync_enqueue'].reduce(
    (total, flow) => total + (flowRow(parsed, flow, shapeTag)?.attempts ?? 0),
    0,
  )
  const shortfall = successes !== null && accounted < successes - tolerance
  const unexplainedExcess = successes !== null && accounted > successes + mintedUpperBound + tolerance
  const acceptedMismatch = shortfall || unexplainedExcess
  const missingAttempts = submitted !== null && submitted - throttled - dbSubmitted > tolerance

  return {
    available: true,
    sessions: sessionIds.length,
    statusCounts,
    scanOutcomes,
    submitted,
    dbSubmitted,
    accepted,
    disputed,
    absent,
    acceptedOverSubmitted,
    acceptedOverDbSubmitted,
    successes,
    throttled,
    accounted,
    tolerance,
    mintedUpperBound,
    acceptedMismatch,
    missingAttempts,
    disputedRows,
    scanRow,
  }
}

/* ------------------------------------------------------------------- report */

const mdTable = (headers, rows) => {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`]
  for (const row of rows) lines.push(`| ${row.map((cell) => String(cell).replace(/\|/g, '\\|')).join(' | ')} |`)
  return lines.join('\n')
}

const serverSummaryTable = (server) => {
  if (!server) return '_Server-side summary unavailable._'
  const rows = [
    ['Postgres peak waiters (active + wait_event)', fmtInt(server.postgres?.peakWaiters)],
    ['Postgres peak active / idle / idle-in-transaction', `${fmtInt(server.postgres?.peakActive)} / ${fmtInt(server.postgres?.peakIdle)} / ${fmtInt(server.postgres?.peakIdleInTransaction)}`],
    ['Postgres max wait', fmtMs((server.postgres?.peakMaxWaitSeconds ?? 0) * 1000)],
    ['Postgres >1s queries (peak)', fmtInt(server.postgres?.peakLongQueries)],
    ['Postgres longest query', fmtMs((server.postgres?.peakLongQueryMaxSeconds ?? 0) * 1000)],
    ['Postgres ungranted locks (peak)', fmtInt(server.postgres?.peakLockWaits)],
    ['Postgres connections / max_connections', `${fmtInt(server.postgres?.peakTotal)} / ${fmtInt(server.postgres?.maxConnections)}`],
    ['Redis connected clients (peak)', fmtInt(server.redis?.peakConnectedClients)],
    ['Redis ops/sec (peak)', fmtInt(server.redis?.peakOpsPerSecond)],
    ['Redis memory (peak)', server.redis?.peakUsedMemoryHuman ?? 'n/a'],
    ['Redis rejected connections (during run)', fmtInt(server.redis?.rejectedConnectionsDelta ?? server.redis?.rejectedConnections)],
    ['Backend event-loop lag p95 (of p99 samples)', fmtMs(server.backend?.eventLoopLagP95Ms)],
    ['Backend event-loop lag peak (p99 / max)', `${fmtMs(server.backend?.eventLoopLagPeakP99Ms)} / ${fmtMs(server.backend?.eventLoopLagMaxMs)}`],
    ['Backend RSS peak (growth)', `${fmtBytes(server.backend?.peakRssBytes)} (${fmtBytes(server.backend?.rssGrowthBytes)})`],
    ['Backend container CPU (peak)', server.docker?.peakCpuPercent === null || server.docker?.peakCpuPercent === undefined ? 'n/a' : `${server.docker.peakCpuPercent}%`],
    ['Backend container memory (peak)', server.docker?.peakMemPercent === null || server.docker?.peakMemPercent === undefined ? 'n/a' : `${fmtBytes(server.docker.peakMemBytes)} (${server.docker.peakMemPercent}%)`],
    ['Backend 5xx (logs)', `${fmtInt(server.http5xx?.total)} (${server.http5xx?.perMinute ?? 'n/a'}/min)`],
    ['Backend 5xx (metrics delta, cross-check)', fmtInt(server.backend?.http5xxFromMetrics)],
    ['Server-side 429 (metrics delta, cross-check)', fmtInt(server.backend?.http429FromMetrics)],
    ['Observer samples / probe errors', `${fmtInt(server.samples)} / ${fmtInt(server.probeErrors)}`],
  ]
  return mdTable(['signal', 'value'], rows)
}

const integrityText = (integrity) => {
  if (!integrity.available) {
    return `_Integrity check unavailable: ${integrity.reason}._`
  }
  const lines = [
    `- submitted (k6 scan flow attempts): ${fmtInt(integrity.submitted)}`,
    `- submitted (DB ScanAttempt rows): ${fmtInt(integrity.dbSubmitted)}`,
    `- accepted (present + late): ${fmtInt(integrity.accepted)}`,
    `- **accepted / submitted: ${fmtPercent(integrity.acceptedOverSubmitted)}** (denominator: ${integrity.submitted !== null ? 'k6 scan attempts' : 'DB ScanAttempt rows'})`,
    `- accepted / DB submissions: ${fmtPercent(integrity.acceptedOverDbSubmitted)}`,
    `- k6 scan successes (non-throttled): ${fmtInt(integrity.successes)}; throttled: ${fmtInt(integrity.throttled)}`,
    `- disputed: ${fmtInt(integrity.disputed)}; absent: ${fmtInt(integrity.absent)}`,
    `- status breakdown: ${Object.entries(integrity.statusCounts).map(([status, count]) => `${status}=${count}`).join(', ') || 'no rows'}`,
    `- ScanAttempt outcomes: ${Object.entries(integrity.scanOutcomes).map(([outcome, count]) => `${outcome}=${count}`).join(', ') || 'no rows'}`,
  ]
  if (integrity.acceptedMismatch) {
    lines.push(
      '',
      `> **STOP — MISMATCH between k6 and the database.** k6 reports ${fmtInt(integrity.successes)} successful scans; the DB accounts for ${fmtInt(integrity.accounted)} (${fmtInt(integrity.accepted)} accepted + ${fmtInt(integrity.disputed)} disputed). Tolerance was ${fmtInt(integrity.tolerance)}, and up to ${fmtInt(integrity.mintedUpperBound)} extra rows are expected from the dispute/excuse/sync flows minting their own records. A DB count BELOW k6 means scans were lost; an excess beyond that bound is unexplained.`,
    )
  }
  if (integrity.missingAttempts) {
    lines.push(
      '',
      `> **STOP — LOST SUBMISSIONS.** k6 attempted ${fmtInt(integrity.submitted)} scans (${fmtInt(integrity.throttled)} throttled) but Postgres only has ${fmtInt(integrity.dbSubmitted)} ScanAttempt rows. The backend dropped requests it appeared to accept.`,
    )
  }
  if (integrity.disputedRows.length > 0) {
    lines.push('', 'Disputed rows on this run\'s sessions:', '')
    lines.push(
      mdTable(
        ['session', 'studentId', 'studentName', 'reason', 'description', 'createdAt'],
        integrity.disputedRows.map((row) => [row.sessionId, row.studentId, row.studentName, row.reason, row.description.slice(0, 120), row.createdAt]),
      ),
    )
  }
  return lines.join('\n')
}

const loginRateLimitLine = (parsed) => {
  const loginRow = flowRow(parsed, 'login')
  if (!loginRow || loginRow.attempts === 0) {
    return 'login IP limit: 1000/60s → no login flow traffic observed in this run.'
  }
  const admitted = loginRow.attempts - loginRow.throttled
  const cap = Math.min(users, 1000)
  const expectation =
    shape === 'burst'
      ? `expected ~${fmtInt(cap)} of ${fmtInt(users)} admitted and ~${fmtInt(users - cap)} throttled`
      : `expected all ${fmtInt(users)} admitted at ${arrivalRate}/s`
  return `login IP limit: 1000/60s → paced run admits all, burst run admits ~${fmtInt(cap)}. This ${shape === 'arrival' ? 'arrival (paced)' : 'burst'} run: ${expectation}; observed ${fmtInt(loginRow.attempts)} attempts, ${fmtInt(loginRow.throttled)} throttled (429), ${fmtInt(admitted)} admitted (adjusted success ${fmtPercent(loginRow.adjustedRate)}).`
}

const buildReport = ({ parsed, integrity, server, k6Result, startedAt, finishedAt, terminationNote }) => {
  const durationSeconds = ((finishedAt - startedAt) / 1000).toFixed(1)
  const sections = []
  sections.push(`# Load run — ${runName}`)
  sections.push('')
  sections.push(
    mdTable(
      ['field', 'value'],
      [
        ['shape (input)', shape],
        ['users', fmtInt(users)],
        ['run id (K6_RUN_ID)', runId],
        ['k6 script', scriptPath],
        ['fixture', fixturePath],
        ['k6 summary', summaryPath],
        ['started', new Date(startedAt).toISOString()],
        ['finished', new Date(finishedAt).toISOString()],
        ['wall duration', `${durationSeconds}s`],
        ['k6 exit code', k6Result.code === null ? `signal ${k6Result.signal}` : String(k6Result.code)],
        ['metric shape tag(s)', parsed.shapes.join(', ') || 'unknown'],
        ['load model', loadModel],
        ['k6 duration cap', values.duration ?? 'script default'],
        ['fixture run id', fixture.K6_RUN_ID ?? runId],
      ],
    ),
  )
  if (terminationNote) {
    sections.push('', `> **PARTIAL RUN:** ${terminationNote}`)
  }
  if (k6Result.code === 99) {
    sections.push(
      '',
      '> **k6 exit 99 = threshold/SLO breach**, not a crash. Latency SLOs are enforced in burst/full profiles (success floors are report-only), so the run data below is still valid; inspect the p95/p99 columns for the breached flow.',
    )
  }
  sections.push('')
  sections.push('## Login rate-limit behavior')
  sections.push('')
  sections.push(loginRateLimitLine(parsed))
  sections.push('')
  sections.push('## Flow results')
  sections.push('')
  sections.push(renderFlowTables(parsed))
  sections.push('')
  sections.push(
    'Success % (excl. 429) = successes / (attempts − throttled). Success % (raw) = successes / attempts. A flow with zero attempts is `n/a`. A flow with throttled > 0 and failed = 0 passes with admission control; 429s are never counted as failures.',
  )
  sections.push('')
  sections.push('## Server-side summary')
  sections.push('')
  sections.push(serverSummaryTable(server))
  if (server?.probeErrors > 0) {
    sections.push('')
    sections.push(`Observer probe errors (${server.probeErrors}): ${(server.probeErrorDetails || []).join(' | ')}`)
  }
  sections.push('')
  sections.push('## Integrity check')
  sections.push('')
  sections.push(integrityText(integrity))
  sections.push('')
  sections.push('---')
  sections.push(`Generated by performance/run-load.mjs at ${new Date().toISOString()}.`)
  return `${sections.join('\n')}\n`
}

/* --------------------------------------------------------------------- main */

const main = async () => {
  console.log(`run=${runName} shape=${shape} users=${users} runId=${runId}`)
  console.log(`fixture=${fixturePath}`)
  console.log(`script=${scriptPath}`)
  console.log(`load model: ${loadModel}`)
  console.log(`results=${summaryPath}`)

  const startedAt = Date.now()
  let observer = null
  const fallbackShape = shape === 'arrival' ? 'paced' : 'burst'
  const wallTimer = setTimeout(() => {
    wallGuardFired = true
    console.error(
      `\n[wall-guard] ${maxWallMinutes} minute wall clock exceeded — killing k6/observer and writing a partial report`,
    )
    killAllChildren()
  }, maxWallMs)
  try {
    if (!values['skip-observer']) {
      observer = startObserver()
      const ready = await waitForFirstSample(observer, observerReadyTimeoutMs)
      if (!ready) {
        await stopObserver(observer)
        observer = null
      } else {
        console.log('[observe] first sample captured; starting k6')
      }
    } else {
      console.log('[observe] skipped (--skip-observer)')
    }

    let k6Result
    if (wallGuardFired) {
      k6Result = { code: null, signal: 'WALL_GUARD' }
      console.warn('[wall-guard] fired before k6 started; skipping k6')
    } else {
      k6Result = await runK6()
    }
    console.log(`\n[k6] exited code=${k6Result.code} signal=${k6Result.signal ?? 'none'}${k6Result.code === 99 ? ' (SLO threshold breach, not a crash; data still valid)' : ''}`)
    await stopObserver(observer)
    observer = null
    const finishedAt = Date.now()

    const summaryAvailable = existsSync(summaryPath)
    let parsed = null
    if (summaryAvailable) {
      try {
        parsed = parseSummary(JSON.parse(readFileSync(summaryPath, 'utf8')), { shape: fallbackShape })
      } catch (error) {
        console.warn(`could not parse summary export: ${error.message}`)
      }
    }
    if (!parsed) {
      console.warn('WARNING: k6 did not write a usable summary export - reporting partial results (all flows n/a)')
      parsed = parseSummary({ metrics: {} }, { shape: fallbackShape })
      parsed.warnings.push('k6 did not finish/write a summary export; per-flow metrics are unavailable.')
    }

    console.log('')
    console.log(renderFlowTables(parsed))
    console.log('')
    console.log(loginRateLimitLine(parsed))
    console.log('')
    console.log(
      `totals: http_reqs=${fmtInt(parsed.totals.httpRequests)} http_failed=${fmtPercent(parsed.totals.httpFailedRate)} (includes 429s — see per-flow throttled column) iterations=${fmtInt(parsed.totals.iterations)} vus_max=${fmtInt(parsed.totals.vusMax)}`,
    )

    let server = null
    if (existsSync(serverSummaryPath)) {
      try {
        server = JSON.parse(readFileSync(serverSummaryPath, 'utf8'))
      } catch (error) {
        console.warn(`could not parse ${serverSummaryPath}: ${error.message}`)
      }
    } else {
      console.warn(`observer summary missing at ${serverSummaryPath}`)
    }

    let integrity = { available: false, reason: 'skipped with --skip-integrity' }
    if (!values['skip-integrity']) {
      integrity = await collectIntegrity(parsed, startedAt)
    }
    console.log('')
    console.log('Integrity check:')
    console.log(integrityText(integrity))

    const terminationNote = wallGuardFired
      ? `Wall-clock guard (${maxWallMinutes} min) terminated the run; this report is partial.`
      : !summaryAvailable
        ? 'k6 exited without writing a summary export; per-flow metrics are unavailable.'
        : k6Result.signal
          ? `k6 was terminated by signal ${k6Result.signal}; this report is partial.`
          : null
    const report = buildReport({ parsed, integrity, server, k6Result, startedAt, finishedAt, terminationNote })
    writeFileSync(reportPath, report)
    console.log('')
    console.log(`Report: ${reportPath}`)
    console.log(`NDJSON: ${ndjsonPath}`)
    console.log(`Summary JSON: ${summaryPath}`)

    if (wallGuardFired) {
      console.error('\n*** WALL-GUARD TERMINATED THE RUN — partial report written. ***')
      process.exitCode = 124
    } else if (!summaryAvailable) {
      process.exitCode = 1
    } else if (integrity.available && (integrity.acceptedMismatch || integrity.missingAttempts)) {
      console.error('\n*** INTEGRITY MISMATCH — k6 numbers do not match the database. See the report. ***')
      process.exitCode = 1
    }
  } finally {
    clearTimeout(wallTimer)
    if (observer) await stopObserver(observer)
    killAllChildren()
  }
}

main().catch((error) => {
  console.error(`run-load.mjs fatal: ${error.stack || error.message}`)
  process.exit(1)
})
