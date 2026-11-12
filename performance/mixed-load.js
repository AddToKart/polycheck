/**
 * Polycheck — blended load (all 10 flows running at once).
 *
 * One weighted arrival-rate scenario drives scan/login/faculty_read/admin_read/
 * dispute/sync/excuse, while `proof_upload` (≤20 uploads) and
 * `session_lifecycle` (2-5 cycles) run as small dedicated scenarios so they
 * stay bounded inside a long mixed run.
 *
 * Weighted flow mix (deterministic 100-slot round robin):
 *   scan 45 · login 25 · faculty_read 12 · admin_read 6 · dispute 5 · sync 4 · excuse 3
 *
 * ── Invocation matrix ─────────────────────────────────────────────────────
 *   K6_FIXTURE_FILE           required. performance/.local-fixture-<runId>.json
 *   K6_SHAPE                  burst | arrival (default arrival)
 *                               arrival -> mixed_paced   (constant-arrival-rate)
 *                               burst   -> mixed_burst   (per-vu-iterations)
 *   K6_MIX_RATE_PER_SECOND    total blended iterations/s (default 12)
 *   K6_MIX_DURATION           paced duration (default 5m)
 *   K6_MIX_VUS                burst VU count (default 50)
 *   K6_MIX_ITERATIONS_PER_VU  burst iterations per VU (default 6)
 *   K6_LOGIN_RATE_PER_SECOND  unused by the mix itself (login is one weighted
 *                             choice); kept for parity with login-load.js docs
 *   K6_RATE_PER_SECOND        unused by the mix itself; scan pacing emerges
 *                             from the weight table
 *   K6_PROFILE                smoke | full | burst (threshold set only)
 *   K6_PROOF_UPLOAD_LIMIT     proof uploads (default/cap 20)
 *   K6_LIFECYCLE_ITERATIONS   lifecycle cycles (default 3, range 2-5)
 *   K6_SUMMARY_EXPORT         path for k6's native summary JSON
 *
 * ── Running (k6 v2.3.0) ───────────────────────────────────────────────────
 *   This build does not forward the process environment to __ENV, so pass
 *   every variable with -e/--env. The fixture path may be absolute (most
 *   robust) or repo-root relative (performance/.local-fixture-<runId>.json).
 *   --summary-export writes the machine-readable per-flow JSON.
 *
 * Examples
 *   K6_FIXTURE_FILE=performance/.local-fixture-x.json K6_MIX_DURATION=30s \
 *     K6_MIX_RATE_PER_SECOND=3 K6_PROOF_UPLOAD_LIMIT=1 K6_LIFECYCLE_ITERATIONS=2 \
 *     k6 run --summary-export performance/results/mixed-smoke.json performance/mixed-load.js
 *   K6_FIXTURE_FILE=... K6_SHAPE=burst K6_MIX_VUS=100 K6_MIX_ITERATIONS_PER_VU=10 \
 *     k6 run --summary-export performance/results/mixed-burst.json performance/mixed-load.js
 */
import exec from 'k6/execution'
import { loadFixture } from './lib/fixture.js'
import {
  measureClockOffset,
  runAdminRead,
  runDispute,
  runExcuse,
  runFacultyRead,
  runLogin,
  runProofUpload,
  runScan,
  runSessionLifecycle,
  runSync,
} from './lib/flows.js'
import { shapeOf, profileOf, FLOW_NAMES } from './lib/metrics.js'
import { fixedScenario, mixedScenario } from './lib/scenarios.js'
import { buildThresholds } from './lib/thresholds.js'
import { summarize } from './lib/summary.js'

const fixture = loadFixture()
const shape = shapeOf()
const profile = profileOf()

const WEIGHTS = [
  ['scan', 45],
  ['login', 25],
  ['faculty_read', 12],
  ['admin_read', 6],
  ['dispute', 5],
  ['sync', 4],
  ['excuse', 3],
]
const TOTAL_WEIGHT = WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0)

const handlers = {
  scan: runScan,
  login: runLogin,
  faculty_read: runFacultyRead,
  admin_read: runAdminRead,
  dispute: runDispute,
  sync: runSync,
  excuse: runExcuse,
  proof_upload: runProofUpload,
  session_lifecycle: runSessionLifecycle,
}

/**
 * Largest-remainder interleaving: exactly the weighted number of slots per
 * flow, but every flow appears in the first few iterations, so even a short
 * mixed run samples all of them (a block table would start with 45 scans).
 */
function buildSchedule() {
  // Proportional deficit scheduling: at slot n each flow's target count is
  // weight * (n + 1) / total; emit the flow furthest behind target. Produces
  // the exact weighted counts while interleaving every flow from slot 0.
  const emitted = new Map(WEIGHTS.map(([flow]) => [flow, 0]))
  const schedule = []
  for (let slot = 0; slot < TOTAL_WEIGHT; slot++) {
    let pick = WEIGHTS[0][0]
    let bestScore = -Infinity
    for (const [flow, weight] of WEIGHTS) {
      const score = (weight * (slot + 1)) / TOTAL_WEIGHT - emitted.get(flow)
      if (score > bestScore) {
        bestScore = score
        pick = flow
      }
    }
    schedule.push(pick)
    emitted.set(pick, emitted.get(pick) + 1)
  }
  return schedule
}

const SCHEDULE = buildSchedule()

function pickFlow(index) {
  return SCHEDULE[index % SCHEDULE.length]
}

function intEnv(name, fallback, min, max) {
  const raw = __ENV[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer in [${min}, ${max}], got ${raw}`)
  }
  return value
}

const mix = mixedScenario(shape)
const proofIterations = Math.min(20, intEnv('K6_PROOF_UPLOAD_LIMIT', 20, 1, 20))
const lifecycleIterations = intEnv('K6_LIFECYCLE_ITERATIONS', 3, 2, 5)

export const options = {
  scenarios: {
    [mix.name]: mix.options,
    [`proof_upload_${shape}`]: fixedScenario(`proof_upload_${shape}`, shape, {
      vus: 1,
      iterations: proofIterations,
    }).options,
    [`session_lifecycle_${shape}`]: fixedScenario(`session_lifecycle_${shape}`, shape, {
      vus: 1,
      iterations: lifecycleIterations,
    }).options,
  },
  thresholds: buildThresholds(profile, shape, FLOW_NAMES),
  tags: { harness: 'polycheck', script: 'mixed-load' },
}

export function setup() {
  return measureClockOffset(fixture)
}

export default function run(data) {
  const name = exec.scenario.name
  const index = exec.scenario.iterationInTest
  if (name.startsWith('proof_upload_')) {
    runProofUpload(fixture, shape, data.clockOffsetMs, index)
    return
  }
  if (name.startsWith('session_lifecycle_')) {
    runSessionLifecycle(fixture, shape, data.clockOffsetMs, index)
    return
  }
  const flow = pickFlow(index)
  const handler = handlers[flow]
  if (!handler) throw new Error(`unknown mixed flow ${flow}`)
  handler(fixture, shape, data.clockOffsetMs, index)
}

export function handleSummary(data) {
  return {
    stdout: summarize(data, { label: 'mixed-load', profile, shape, fixture }),
  }
}
