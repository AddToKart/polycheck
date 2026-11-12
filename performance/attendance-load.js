/**
 * Polycheck — attendance-domain load (flows: scan, sync_enqueue, sync_receipt,
 * dispute, excuse, faculty_read, admin_read, proof_upload, session_lifecycle).
 *
 * `scan` is the bell rush across every section in the fixture (34 sections in
 * the local topology). The other flows run concurrently at realistic small
 * weights so the write path, offline replay, adjudication, cockpit reads and
 * admin console are exercised in the same run.
 *
 * ── Invocation matrix ─────────────────────────────────────────────────────
 *   K6_FIXTURE_FILE           required. performance/.local-fixture-<runId>.json
 *   K6_SHAPE                  burst | arrival (default arrival)
 *                               scan: arrival -> constant-arrival-rate
 *                               scan: burst   -> per-vu-iterations (one scan/VU)
 *   K6_RATE_PER_SECOND        scan arrivals/s. Default = fixture population/900
 *                             (2,000 students / 15 min ≈ 2.22/s).
 *   K6_PROFILE                smoke | full | burst (threshold set only)
 *   K6_USER_COUNT             cap students used by the scan flow
 *   K6_SCAN_VUS               burst-shape VU cap (default: student count)
 *   K6_SYNC_COUNT             offline replay students (default ~3%, cap 200)
 *   K6_DISPUTE_COUNT          disputing students (default ~1%, cap 100)
 *   K6_DISPUTE_RESOLVE_SHARE  fraction the professor resolves (default 0.5)
 *   K6_EXCUSE_COUNT           excused students (default ~1%, cap 100)
 *   K6_ADMIN_READ_ITERATIONS  admin console reads (default 20)
 *   K6_PROOF_UPLOAD_LIMIT     QAC proof uploads (default/cap 20)
 *   K6_PROOF_CANDIDATES       students probed for QAC eligibility (default 60)
 *   K6_LIFECYCLE_ITERATIONS   create/activate/end cycles (default 3, range 2-5)
 *   K6_SYNC_DEADLINE_SECONDS  receipt deadline (default 30)
 *   K6_SYNC_POLL_SECONDS      receipt poll interval (default 0.25)
 *   K6_SUMMARY_EXPORT         path for k6's native summary JSON
 *
 * ── Running (k6 v2.3.0) ───────────────────────────────────────────────────
 *   This build does not forward the process environment to __ENV, so pass
 *   every variable with -e/--env. The fixture path may be absolute (most
 *   robust) or repo-root relative (performance/.local-fixture-<runId>.json).
 *   --summary-export writes the machine-readable per-flow JSON.
 *
 * Examples
 *   K6_FIXTURE_FILE=performance/.local-fixture-x.json K6_USER_COUNT=10 \
 *     K6_SYNC_COUNT=1 K6_DISPUTE_COUNT=1 K6_EXCUSE_COUNT=1 K6_PROOF_UPLOAD_LIMIT=1 \
 *     K6_ADMIN_READ_ITERATIONS=1 K6_LIFECYCLE_ITERATIONS=2 \
 *     k6 run --summary-export performance/results/smoke.json performance/attendance-load.js
 *   K6_FIXTURE_FILE=... K6_SHAPE=burst K6_PROFILE=burst \
 *     k6 run --summary-export performance/results/bell-rush-burst.json performance/attendance-load.js
 *   K6_FIXTURE_FILE=... K6_SHAPE=arrival K6_RATE_PER_SECOND=2.22 \
 *     k6 run --summary-export performance/results/bell-rush-paced.json performance/attendance-load.js
 */
import exec from 'k6/execution'
import { loadFixture } from './lib/fixture.js'
import {
  measureClockOffset,
  runAdminRead,
  runDispute,
  runExcuse,
  runFacultyRead,
  runProofUpload,
  runScan,
  runSessionLifecycle,
  runSync,
} from './lib/flows.js'
import { shapeOf, profileOf } from './lib/metrics.js'
import { fixedScenario, scanScenario, shareCount } from './lib/scenarios.js'
import { buildThresholds } from './lib/thresholds.js'
import { summarize } from './lib/summary.js'

const fixture = loadFixture()
const shape = shapeOf()
const profile = profileOf()

function intEnv(name, fallback, min, max) {
  const raw = __ENV[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer in [${min}, ${max}], got ${raw}`)
  }
  return value
}

// One-shot fixed scenarios: one iteration per VU keeps the flow counts exact.
function oneShot(flow, count, startTime) {
  return fixedScenario(`${flow}_${shape}`, shape, { vus: count, iterations: 1, startTime })
}

const scan = scanScenario(fixture, shape)
const syncCount = shareCount(fixture, 'K6_SYNC_COUNT', 0.03, 200)
const disputeCount = shareCount(fixture, 'K6_DISPUTE_COUNT', 0.01, 100)
const excuseCount = shareCount(fixture, 'K6_EXCUSE_COUNT', 0.01, 100)
const proofCount = Math.min(20, intEnv('K6_PROOF_UPLOAD_LIMIT', 20, 1, 20))
const adminIterations = intEnv('K6_ADMIN_READ_ITERATIONS', 20, 1, 500)
const adminVus = Math.min(5, adminIterations)
const lifecycleIterations = intEnv('K6_LIFECYCLE_ITERATIONS', 3, 2, 5)

const scenarios = {
  [scan.name]: scan.options,
  [`faculty_read_${shape}`]: oneShot('faculty_read', fixture.sections.length, '2s').options,
  [`admin_read_${shape}`]: fixedScenario(`admin_read_${shape}`, shape, {
    vus: adminVus,
    iterations: Math.ceil(adminIterations / adminVus),
    startTime: '2s',
  }).options,
  [`sync_${shape}`]: oneShot('sync', syncCount, '5s').options,
  [`dispute_${shape}`]: oneShot('dispute', disputeCount, '8s').options,
  [`excuse_${shape}`]: oneShot('excuse', excuseCount, '12s').options,
  [`proof_upload_${shape}`]: oneShot('proof_upload', proofCount, '15s').options,
  [`session_lifecycle_${shape}`]: fixedScenario(`session_lifecycle_${shape}`, shape, {
    vus: 1,
    iterations: lifecycleIterations,
    startTime: '20s',
  }).options,
}

const handlers = {
  scan: runScan,
  sync: runSync,
  dispute: runDispute,
  excuse: runExcuse,
  faculty_read: runFacultyRead,
  admin_read: runAdminRead,
  proof_upload: runProofUpload,
  session_lifecycle: runSessionLifecycle,
}

export const options = {
  scenarios,
  thresholds: buildThresholds(profile, shape, [
    'scan',
    'sync_enqueue',
    'sync_receipt',
    'dispute',
    'excuse',
    'faculty_read',
    'admin_read',
    'proof_upload',
    'session_lifecycle',
  ]),
  tags: { harness: 'polycheck', script: 'attendance-load' },
}

export function setup() {
  return measureClockOffset(fixture)
}

export default function run(data) {
  const name = exec.scenario.name
  const flow = name.replace(/_(burst|paced)$/, '')
  const handler = handlers[flow]
  if (!handler) throw new Error(`unknown scenario ${name}`)
  const index = exec.scenario.iterationInTest
  // Paced scan can overshoot by a tick or two; skip instead of double-scanning.
  if (flow === 'scan' && index >= fixture.studentCount) return
  handler(fixture, shape, data.clockOffsetMs, index)
}

export function handleSummary(data) {
  return {
    stdout: summarize(data, { label: 'attendance-load', profile, shape, fixture }),
  }
}
