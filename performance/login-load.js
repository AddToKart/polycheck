/**
 * Polycheck — student login capacity (flow: `login`).
 *
 * Measures POST /api/auth/mobile/login/student for every student in the
 * fixture. The login path is deliberately isolated from attendance so bcrypt +
 * session creation never contaminate the bell-rush numbers.
 *
 * ── Invocation matrix ─────────────────────────────────────────────────────
 *   K6_FIXTURE_FILE            required. performance/.local-fixture-<runId>.json
 *   K6_SHAPE                   burst | arrival (default arrival)
 *                                arrival -> constant-arrival-rate @ K6_LOGIN_RATE_PER_SECOND
 *                                burst   -> per-vu-iterations, one login per VU
 *   K6_LOGIN_RATE_PER_SECOND   default 4 (logins/s). The backend admits 1,000
 *                              logins per IP per 60 s; a burst above that is
 *                              expected to throttle and is reported as such.
 *   K6_PROFILE                 smoke | full | burst (threshold set only)
 *   K6_USER_COUNT              cap students used (default: every student)
 *   K6_LOGIN_VUS               burst VU cap (default: student count)
 *   K6_SUMMARY_EXPORT          path for k6's native summary JSON
 *                              (also accepted as the --summary-export flag)
 *
 * ── Running (k6 v2.3.0) ───────────────────────────────────────────────────
 *   This build does not forward the process environment to __ENV, so pass
 *   every variable with -e/--env. The fixture path may be absolute (most
 *   robust) or repo-root relative (performance/.local-fixture-<runId>.json).
 *   --summary-export writes the machine-readable per-flow JSON.
 *
 * ── 429 semantics ─────────────────────────────────────────────────────────
 *   429 is admission control, not failure: it increments `flow_throttled`
 *   only. `flow_success`, `login_admitted_duration` and the latency SLOs cover
 *   admitted requests exclusively, so "paced" (all admitted) and "burst"
 *   (throttle visible) runs are directly comparable.
 *
 * Examples
 *   K6_FIXTURE_FILE=performance/.local-fixture-x.json K6_USER_COUNT=10 \
 *     K6_SHAPE=arrival k6 run performance/login-load.js
 *   K6_FIXTURE_FILE=... K6_SHAPE=burst K6_PROFILE=burst \
 *     k6 run --summary-export performance/results/login-burst.json performance/login-load.js
 */
import exec from 'k6/execution'
import { loadFixture } from './lib/fixture.js'
import { measureClockOffset, runLogin } from './lib/flows.js'
import { shapeOf, profileOf } from './lib/metrics.js'
import { loginScenario } from './lib/scenarios.js'
import { buildThresholds } from './lib/thresholds.js'
import { summarize } from './lib/summary.js'

const fixture = loadFixture()
const shape = shapeOf()
const profile = profileOf()
const scenario = loginScenario(fixture, shape)

export const options = {
  scenarios: { [scenario.name]: scenario.options },
  thresholds: buildThresholds(profile, shape, ['login']),
  tags: { harness: 'polycheck', script: 'login-load' },
}

export function setup() {
  return measureClockOffset(fixture)
}

export default function run(data) {
  const index = exec.scenario.iterationInTest
  // Arrival-rate executors can overshoot the scheduled iteration count by a
  // few ticks; never log a student in twice in the same paced run.
  if (index >= fixture.studentCount) return
  runLogin(fixture, shape, data.clockOffsetMs, index)
}

export function handleSummary(data) {
  return {
    stdout: summarize(data, { label: 'login-load', profile, shape, fixture }),
  }
}
