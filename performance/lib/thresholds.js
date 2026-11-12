/**
 * Profile-selectable thresholds.
 *
 * k6 thresholds never abort by default; every entry is written with an
 * explicit `abortOnFail: false` so a burst run is *reported* rather than
 * failed fast. Profiles only change the bounds that are evaluated.
 *
 * Profiles
 *   smoke : report-only (all bounds `>= 0`). Use for harness smoke runs.
 *   full  : LOAD_TESTING.md SLOs (scan p95 < 1 s, p99 < 2 s; sync confirmation
 *           p95 < 30 s; login p95 < 3 s) plus per-flow success-rate floors.
 *   burst : latency SLOs still enforced; success-rate floors are report-only
 *           because peak-shape runs are expected to hit IP admission control.
 */
import { FLOW_NAMES } from './metrics.js'

const LATENCY_SLO_MS = {
  login: { p95: 3000 },
  scan: { p95: 1000, p99: 2000 },
  sync_enqueue: { p95: 1000 },
  sync_receipt: { p95: 30000 },
  dispute: { p95: 3000 },
  excuse: { p95: 3000 },
  faculty_read: { p95: 3000 },
  admin_read: { p95: 3000 },
  proof_upload: { p95: 5000 },
  session_lifecycle: { p95: 5000 },
}

const SUCCESS_FLOOR = {
  login: 0.99,
  scan: 0.99,
  sync_enqueue: 0.99,
  sync_receipt: 0.95,
  dispute: 0.95,
  excuse: 0.95,
  faculty_read: 0.99,
  admin_read: 0.99,
  proof_upload: 0.95,
  session_lifecycle: 0.95,
}

function latencyEntries(flow, profile) {
  if (profile === 'smoke') return [{ threshold: 'p(95)>=0', abortOnFail: false }]
  const slo = LATENCY_SLO_MS[flow] || { p95: 3000 }
  const entries = [{ threshold: `p(95)<${slo.p95}`, abortOnFail: false }]
  if (slo.p99) entries.push({ threshold: `p(99)<${slo.p99}`, abortOnFail: false })
  return entries
}

function successEntries(flow, profile) {
  // `smoke` and `burst` are report-only for success rates: peak-shaped runs are
  // expected to cross them (IP admission control) and k6 exits 99 on any
  // crossed threshold, so enforcing a floor there would break orchestration
  // without adding signal. `full` carries the SLO verdict.
  if (profile === 'smoke' || profile === 'burst') return [{ threshold: 'rate>=0', abortOnFail: false }]
  return [{ threshold: `rate>=${SUCCESS_FLOOR[flow] ?? 0.95}`, abortOnFail: false }]
}

/**
 * @param {string} profile smoke|full|burst
 * @param {string} shape burst|paced (only the active shape gets a submetric)
 * @param {string[]} [flows] flows this script emits (so absent flows don't warn)
 */
export function buildThresholds(profile, shape, flows = FLOW_NAMES) {
  const thresholds = {
    checks: [{ threshold: 'rate>=0', abortOnFail: false }],
  }
  for (const flow of flows) {
    thresholds[`flow_success{flow:${flow}}`] = successEntries(flow, profile)
    thresholds[`flow_success{flow:${flow},shape:${shape}}`] = successEntries(flow, profile)
    thresholds[`flow_attempts{flow:${flow}}`] = [{ threshold: 'count>=0', abortOnFail: false }]
    thresholds[`flow_failures{flow:${flow}}`] = [{ threshold: 'count>=0', abortOnFail: false }]
    thresholds[`flow_throttled{flow:${flow}}`] = [{ threshold: 'rate>=0', abortOnFail: false }]
    thresholds[`flow_throttled{flow:${flow},shape:${shape}}`] = [{ threshold: 'rate>=0', abortOnFail: false }]
    thresholds[`flow_duration{flow:${flow}}`] = latencyEntries(flow, profile)
    thresholds[`flow_duration{flow:${flow},shape:${shape}}`] = latencyEntries(flow, profile)
    thresholds[`http_req_duration{operation:${flow}}`] = latencyEntries(flow, profile)
  }
  // The durable-sync confirmation SLO spans enqueue -> receipt, so it is
  // measured as its own trend rather than per-request latency.
  thresholds['sync_confirmation_ms'] =
    profile === 'smoke' ? [{ threshold: 'p(95)>=0', abortOnFail: false }] : [{ threshold: 'p(95)<30000', abortOnFail: false }]
  thresholds['login_admitted_duration'] =
    profile === 'smoke' ? [{ threshold: 'p(95)>=0', abortOnFail: false }] : [{ threshold: 'p(95)<3000', abortOnFail: false }]
  return thresholds
}
