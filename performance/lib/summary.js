/**
 * Human-readable stdout summary. The machine-readable per-flow table is the
 * --summary-export JSON (k6 writes it natively); this only mirrors it so a
 * terminal run is self-explanatory.
 */
import { FLOW_NAMES } from './metrics.js'

function metricValue(data, key, field) {
  const metric = data.metrics[key]
  if (!metric || !metric.values) return undefined
  return metric.values[field]
}

function formatNumber(value, digits = 2) {
  return value === undefined || value === null || Number.isNaN(value) ? '-' : Number(value).toFixed(digits)
}

export function summarize(data, context) {
  const { label, profile, shape, fixture } = context
  const lines = []
  lines.push('')
  lines.push(`Polycheck load test — ${label}`)
  lines.push(
    `profile=${profile} shape=${shape} runId=${fixture.runId} students=${fixture.studentCount}/${fixture.students.length} sections=${fixture.sections.length}`,
  )
  lines.push('')
  lines.push('flow                 attempts  success%  throttled%  failures   p95(ms)')
  for (const flow of FLOW_NAMES) {
    const attempts = metricValue(data, `flow_attempts{flow:${flow}}`, 'count')
    if (attempts === undefined) continue
    const successRate = metricValue(data, `flow_success{flow:${flow}}`, 'rate')
    const throttledRate = metricValue(data, `flow_throttled{flow:${flow}}`, 'rate')
    const failures = metricValue(data, `flow_failures{flow:${flow}}`, 'count')
    const p95 = metricValue(data, `flow_duration{flow:${flow}}`, 'p(95)')
    lines.push(
      `${flow.padEnd(20)} ${String(attempts).padStart(8)}  ${formatNumber(successRate !== undefined ? successRate * 100 : undefined).padStart(8)}  ${formatNumber(throttledRate !== undefined ? throttledRate * 100 : undefined).padStart(10)}  ${String(failures ?? 0).padStart(8)}  ${formatNumber(p95, 1).padStart(8)}`,
    )
  }
  const throttledAny = FLOW_NAMES.some((flow) => (metricValue(data, `flow_throttled{flow:${flow}}`, 'rate') ?? 0) > 0)
  if (throttledAny) lines.push('note: HTTP 429 is reported as throttled, never as a failed flow.')

  const syncP95 = metricValue(data, 'sync_confirmation_ms', 'p(95)')
  if (syncP95 !== undefined) lines.push(`sync confirmation p95: ${formatNumber(syncP95, 0)} ms`)
  const loginP95 = metricValue(data, 'login_admitted_duration', 'p(95)')
  if (loginP95 !== undefined) lines.push(`login (admitted only) p95: ${formatNumber(loginP95, 0)} ms`)

  const requests = metricValue(data, 'http_reqs', 'count')
  const httpP95 = metricValue(data, 'http_req_duration', 'p(95)')
  const httpP99 = metricValue(data, 'http_req_duration', 'p(99)')
  lines.push('')
  lines.push(
    `http requests=${requests ?? '-'} p95=${formatNumber(httpP95, 1)}ms p99=${formatNumber(httpP99, 1)}ms`,
  )
  const checksRate = metricValue(data, 'checks', 'rate')
  if (checksRate !== undefined) lines.push(`checks passed: ${formatNumber(checksRate * 100)}%`)
  lines.push('')
  return `${lines.join('\n')}\n`
}
