/**
 * Shared metric contract for every Polycheck k6 script.
 *
 * Exported custom metrics (all tagged per flow):
 *   flow_success   Rate     { flow, shape [, phase] }  true = the flow did its job
 *   flow_attempts  Counter  { flow, shape [, phase] }
 *   flow_failures  Counter  { flow, shape [, phase] }
 *   flow_throttled Rate     { flow, shape [, phase] }  true = HTTP 429 (admission control)
 *   flow_duration  Trend    { flow, shape [, phase] }  wall time of the flow's final request
 *   sync_confirmation_ms Trend  enqueue -> receipt completed
 *   login_admitted_duration Trend  login latency excluding 429 responses
 *
 * 429 is a capacity signal, not a failure: a throttled attempt records
 * `flow_throttled` only, never a false `flow_success` sample.
 */
import { check } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

export const FLOW_NAMES = [
  'login',
  'scan',
  'sync_enqueue',
  'sync_receipt',
  'dispute',
  'excuse',
  'faculty_read',
  'admin_read',
  'proof_upload',
  'session_lifecycle',
]

export const flowSuccess = new Rate('flow_success')
export const flowAttempts = new Counter('flow_attempts')
export const flowFailures = new Counter('flow_failures')
export const flowThrottled = new Rate('flow_throttled')
export const flowDuration = new Trend('flow_duration', true)
export const syncConfirmation = new Trend('sync_confirmation_ms', true)
export const loginAdmittedDuration = new Trend('login_admitted_duration', true)

export function shapeOf() {
  const shape = (__ENV.K6_SHAPE || 'arrival').toLowerCase()
  if (shape !== 'burst' && shape !== 'arrival') throw new Error('K6_SHAPE must be burst or arrival')
  return shape === 'burst' ? 'burst' : 'paced'
}

export function profileOf() {
  const profile = (__ENV.K6_PROFILE || 'smoke').toLowerCase()
  if (!['smoke', 'full', 'burst'].includes(profile)) throw new Error('K6_PROFILE must be smoke, full or burst')
  return profile
}

function safeCheck(response, label, ok) {
  if (!response) return
  check(response, { [label]: () => ok })
}

/**
 * Records one flow attempt.
 * @param {string} flow one of FLOW_NAMES
 * @param {string} shape 'burst' | 'paced'
 * @param {object|null} response the response that decides the outcome (k6 response)
 * @param {boolean} ok
 * @param {{ tags?: object, durationMs?: number }} [options]
 */
export function recordFlow(flow, shape, response, ok, options = {}) {
  const tags = { flow, shape, ...(options.tags || {}) }
  flowAttempts.add(1, tags)
  if (response && response.status === 429) {
    flowThrottled.add(1, tags)
    return { throttled: true, ok: false }
  }
  // Non-throttled attempts add a false sample so `flow_throttled{flow}` reads
  // as "share of attempts throttled" instead of "share of 429s that were 429".
  flowThrottled.add(0, tags)
  flowSuccess.add(ok, tags)
  if (!ok) {
    flowFailures.add(1, tags)
    // Failure-only diagnostic: the status + a short body prefix make a failed
    // run debuggable without shipping a per-request debug log.
    const body = response && typeof response.body === 'string' ? response.body.slice(0, 180).replace(/\s+/g, ' ') : ''
    console.warn(`[flow] ${flow} failed status=${response ? response.status : 'no-response'} ${body}`)
  }
  const durationMs = options.durationMs ?? (response ? response.timings.duration : undefined)
  if (durationMs !== undefined) flowDuration.add(durationMs, tags)
  safeCheck(response, `${flow} succeeded`, ok)
  return { throttled: false, ok }
}
