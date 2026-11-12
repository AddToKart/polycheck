#!/usr/bin/env node
/**
 * Per-flow table for a k6 `--summary-export` JSON.
 *
 * k6 only exports a tagged submetric when a threshold references it, so the
 * script must declare thresholds such as `flow_success{flow:scan}`. The export
 * then contains flat keys `flow_success{flow:scan,shape:paced}` plus (in our
 * scripts) the aggregate `flow_success{flow:scan}`. This module prefers the
 * shape-specific entry so aggregate + shaped samples are never summed twice.
 *
 * Truthfulness rules enforced here:
 *   - zero attempts -> "n/a", never 0% or 100%
 *   - 429s -> own `throttled` column, never merged into failed/success
 *   - success rate shown both adjusted (success / (attempts - throttled)) and
 *     raw (success / attempts)
 *   - one table per shape; shapes are never aggregated together
 *
 * CLI: node performance/summarize.mjs <summary.json> [--shape <name>] [--json]
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const FLOWS = [
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
  // service-matrix.js — student, professor and admin surfaces
  'auth_session',
  'student_schedule',
  'student_history',
  'student_standing',
  'notifications',
  'subject_browse',
  'system_reports',
  'attendance_timeline',
  'qr_activate',
  'qr_online_checkpoints',
  'session_bulk',
  'session_reads',
  'teacher_dashboard',
  'attendance_report',
  'attendance_lists',
  'manual_attendance',
  'dispute_read',
  'proof_read',
  'docs_master_list',
  'docs_class_record',
  'docs_session_attendance',
  'export_csv',
  'at_risk',
  'section_reads',
  'class_compose',
  'section_roles',
  'session_permissions',
  'users_read',
  'audit_read',
  'settings_read',
  'health',
]

export const FLOW_DESCRIPTIONS = {
  login: 'student/faculty login',
  scan: 'attendance scan submit',
  sync_enqueue: 'offline queue flush',
  sync_receipt: 'offline sync receipt',
  dispute: 'file/resolve dispute',
  excuse: 'file/review excuse',
  faculty_read: 'faculty dashboard/roster reads',
  admin_read: 'super-admin reads',
  proof_upload: 'proof-of-class upload',
  session_lifecycle: 'session create/activate/end',
}

const numberFormat = new Intl.NumberFormat('en-US')

export const fmtInt = (value) => (value === null || value === undefined || !Number.isFinite(value) ? 'n/a' : numberFormat.format(value))

export const fmtPercent = (value) => (value === null || value === undefined || !Number.isFinite(value) ? 'n/a' : `${(value * 100).toFixed(1)}%`)

export const fmtMs = (value) => (value === null || value === undefined || !Number.isFinite(value) ? 'n/a' : `${Math.round(value)} ms`)

export const fmtBytes = (value) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let scaled = value
  let unit = 0
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024
    unit += 1
  }
  return `${scaled.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

const sumValues = (entries, key) => entries.reduce((total, entry) => total + (Number(entry.values?.[key]) || 0), 0)
const maxValues = (entries, key) => {
  const values = entries.map((entry) => entry.values?.[key]).filter((value) => Number.isFinite(value))
  return values.length > 0 ? Math.max(...values) : null
}

/** Parse a k6 metric key such as `flow_success{flow:scan,shape:paced}`. */
export const parseMetricKey = (key) => {
  const match = String(key).match(/^([^{]+)\{([^}]*)\}$/)
  if (!match) return { name: String(key), tags: {} }
  const tags = {}
  for (const pair of match[2].split(',')) {
    const separator = pair.indexOf(':')
    if (separator <= 0) continue
    tags[pair.slice(0, separator).trim()] = pair
      .slice(separator + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1')
  }
  return { name: match[1].trim(), tags }
}

const indexMetrics = (summary) => {
  const metrics = summary?.metrics ?? summary ?? {}
  const entries = []
  for (const [key, raw] of Object.entries(metrics)) {
    if (!raw || typeof raw !== 'object') continue
    const { name, tags } = parseMetricKey(key)
    // k6's --summary-export writes metric values directly on the metric object
    // ({passes,fails,value}); handleSummary output may wrap them in `values`.
    const values = raw.values && typeof raw.values === 'object' ? raw.values : raw
    entries.push({ key, name, tags, values, type: raw.type ?? null, raw })
  }
  const byName = new Map()
  for (const entry of entries) {
    if (!byName.has(entry.name)) byName.set(entry.name, [])
    byName.get(entry.name).push(entry)
  }
  return { entries, byName }
}

/**
 * Entries for a flow in a shape. Shape-specific entries win; aggregate entries
 * (no shape tag) are used only when the flow emitted no shape-specific entry,
 * which prevents double counting when both exist.
 */
const entriesFor = (byName, metricName, flow, shape, allowAggregate) => {
  const all = byName.get(metricName) ?? []
  const forFlow = all.filter((entry) => entry.tags.flow === flow)
  if (shape) {
    const shaped = forFlow.filter((entry) => entry.tags.shape === shape)
    if (shaped.length > 0) return shaped
  }
  if (!allowAggregate && shape) return []
  return forFlow.filter((entry) => !entry.tags.shape)
}

const httpDurationFor = (byName, flow, shape, allowAggregate) => {
  const all = byName.get('http_req_duration') ?? []
  const forOperation = all.filter((entry) => entry.tags.operation === flow)
  if (forOperation.length === 0) return []
  if (shape) {
    const shaped = forOperation.filter((entry) => entry.tags.shape === shape)
    if (shaped.length > 0) return shaped
  }
  if (!allowAggregate && shape) return []
  return forOperation
}

const rowForFlow = (byName, flow, shape, allowAggregate) => {
  const successEntries = entriesFor(byName, 'flow_success', flow, shape, allowAggregate)
  const throttledEntries = entriesFor(byName, 'flow_throttled', flow, shape, allowAggregate)
  const attemptsEntries = entriesFor(byName, 'flow_attempts', flow, shape, allowAggregate)
  const failureEntries = entriesFor(byName, 'flow_failures', flow, shape, allowAggregate)

  const successes = sumValues(successEntries, 'passes')
  const failedFromRate = sumValues(successEntries, 'fails')
  const failedFromCounter = sumValues(failureEntries, 'count')
  const failed = failedFromRate > 0 ? failedFromRate : failedFromCounter
  const throttled = sumValues(throttledEntries, 'passes')
  const attemptsMetric = attemptsEntries.length > 0 ? sumValues(attemptsEntries, 'count') || sumValues(attemptsEntries, 'value') : null
  const successSamples = successes + failedFromRate
  const attempts = attemptsMetric !== null && attemptsMetric > 0 ? attemptsMetric : successSamples + throttled

  const durationEntries = entriesFor(byName, 'flow_duration', flow, shape, allowAggregate)
  const httpDurationEntries = httpDurationFor(byName, flow, shape, allowAggregate)
  const durationSource = durationEntries.length > 0 ? 'flow_duration' : httpDurationEntries.length > 0 ? 'http_req_duration' : null
  const effectiveDuration = durationEntries.length > 0 ? durationEntries : httpDurationEntries
  const p95 = maxValues(effectiveDuration, 'p(95)')
  const p99 = maxValues(effectiveDuration, 'p(99)')

  const notThrottledAttempts = attempts - throttled
  const adjustedRate = attempts > 0 && notThrottledAttempts > 0 ? successes / notThrottledAttempts : null
  const rawRate = attempts > 0 ? successes / attempts : null

  const notes = []
  const aggregateOnly =
    !allowAggregate &&
    successEntries.length === 0 &&
    (byName.get('flow_success') ?? []).some((entry) => entry.tags.flow === flow && !entry.tags.shape)
  if (attempts === 0 && aggregateOnly) {
    notes.push('n/a — aggregate-only samples cannot be attributed to this shape')
  } else if (attempts === 0) {
    notes.push('n/a — no traffic for this flow in this run')
  } else {
    if (throttled > 0 && failed === 0) notes.push('429 admission control — throttled requests are not failures')
    if (throttled > 0 && flow !== 'login') notes.push('UNEXPECTED 429 on a user-scoped flow — check API_RATE_LIMIT/regression')
    if (throttled === 0 && failed > 0) notes.push(`${failed} non-throttled failure(s)`)
    if (!FLOWS.includes(flow)) notes.push('unknown flow tag')
    if (durationEntries.length > 1) notes.push(`latency = max across ${durationEntries.length} phase submetrics`)
    if (durationSource === 'http_req_duration') notes.push('latency from http_req_duration{operation} fallback')
    if (durationSource === null) notes.push('latency n/a — no duration submetric exported')
  }

  if (flow === 'login' && attempts > 0 && attempts - throttled > 0) {
    const admitted = (byName.get('login_admitted_duration') ?? []).filter((entry) => !shape || !entry.tags.shape || entry.tags.shape === shape)
    const admittedP95 = maxValues(admitted, 'p(95)')
    if (admittedP95 !== null) notes.push(`admitted-only p95 ${Math.round(admittedP95)} ms`)
  }

  return {
    flow,
    shape,
    attempts,
    throttled,
    successes,
    failed,
    adjustedRate,
    rawRate,
    p95Ms: p95,
    p99Ms: p99,
    durationSource,
    notes,
  }
}

/**
 * @param {object} summary parsed k6 summary JSON (`{metrics: ...}`)
 * @param {{shape?: string}} [options]
 */
export const parseSummary = (summary, options = {}) => {
  const { byName } = indexMetrics(summary)
  const shapeFromMetrics = new Set()
  for (const [name, entries] of byName) {
    if (!/^flow_(success|throttled|attempts|duration|failures)$/.test(name)) continue
    for (const entry of entries) if (entry.tags.shape) shapeFromMetrics.add(entry.tags.shape)
  }
  const fallbackShape = options.shape || summary?.shape || null
  const shapes = shapeFromMetrics.size > 0 ? [...shapeFromMetrics].sort() : [fallbackShape || 'unknown']

  const allowAggregate = shapes.length <= 1
  const groups = shapes.map((shape) => {
    const discovered = new Set()
    for (const entry of [...byName.values()].flat()) {
      if (entry.tags.flow && /^flow_/.test(entry.name)) discovered.add(entry.tags.flow)
    }
    const ordered = [
      ...FLOWS,
      ...[...discovered].filter((flow) => !FLOWS.includes(flow)).sort(),
    ]
    const rows = ordered
      .map((flow) => rowForFlow(byName, flow, shape === 'unknown' ? null : shape, allowAggregate))
      .filter((row) => row.attempts > 0 || FLOWS.includes(row.flow))
    return { shape, rows }
  })

  const hasFlowMetrics = [...byName.keys()].some((name) => /^flow_(success|throttled|attempts|duration)$/.test(name))
  const warnings = []
  if (!hasFlowMetrics) {
    warnings.push(
      'k6 export contains no tagged flow submetrics. The k6 script must declare thresholds like `flow_success{flow:scan}` (k6 drops tagged submetrics that no threshold references).',
    )
  }

  const httpReqFailed = byName.get('http_req_failed')?.[0]?.values ?? {}
  const httpReqs = byName.get('http_reqs')?.[0]?.values ?? {}
  // k6 Rate metrics expose `value` (older builds) or `rate`; for
  // http_req_failed, `passes` counts failed requests.
  const failedRate = Number.isFinite(httpReqFailed.rate) ? httpReqFailed.rate : Number.isFinite(httpReqFailed.value) ? httpReqFailed.value : null
  const totals = {
    httpRequests: httpReqs.count ?? null,
    httpFailedRate: failedRate,
    httpFailed: Number.isFinite(httpReqFailed.passes) ? httpReqFailed.passes : null,
    iterations: byName.get('iterations')?.[0]?.values?.count ?? null,
    vusMax: byName.get('vus_max')?.[0]?.values?.max ?? null,
  }

  return {
    shape: fallbackShape,
    profile: summary?.profile ?? null,
    groups,
    warnings,
    totals,
    shapes,
  }
}

const escapeCell = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ')

export const renderFlowTable = (group, options = {}) => {
  const header =
    '| flow | attempts | throttled (429) | success % (excl. 429) | success % (raw) | failed | p95 | p99 | notes |'
  const divider = '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
  const lines = [header, divider]
  for (const row of group.rows) {
    const note = row.notes.length > 0 ? row.notes.join('; ') : ''
    lines.push(
      `| ${escapeCell(row.flow)} | ${fmtInt(row.attempts)} | ${fmtInt(row.throttled)} | ${fmtPercent(row.adjustedRate)} | ${fmtPercent(row.rawRate)} | ${fmtInt(row.failed)} | ${fmtMs(row.p95Ms)} | ${fmtMs(row.p99Ms)} | ${escapeCell(note)} |`,
    )
  }
  const heading = options.heading ?? `flow results — shape: ${group.shape}`
  return `### ${heading}\n\n${lines.join('\n')}`
}

/** One table per shape, never merged. */
export const renderFlowTables = (parsed, options = {}) => {
  const blocks = []
  for (const group of parsed.groups) {
    blocks.push(renderFlowTable(group, options))
  }
  if (parsed.warnings.length > 0) {
    blocks.push(`> **WARNING:** ${parsed.warnings.join(' ')}`)
  }
  return blocks.join('\n\n')
}

export const flowRow = (parsed, flow, shape) => {
  const groups = shape ? parsed.groups.filter((group) => group.shape === shape) : parsed.groups
  for (const group of groups) {
    const row = group.rows.find((candidate) => candidate.flow === flow)
    if (row) return row
  }
  return null
}

const main = () => {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: node performance/summarize.mjs <summary.json> [--shape <name>] [--json]')
    process.exit(2)
  }
  const shapeIndex = process.argv.indexOf('--shape')
  const shape = shapeIndex >= 0 ? process.argv[shapeIndex + 1] : undefined
  const summary = JSON.parse(readFileSync(file, 'utf8'))
  const parsed = parseSummary(summary, { shape })
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(parsed, null, 2))
    return
  }
  console.log(renderFlowTables(parsed))
  console.log('')
  console.log(
    `totals: http_reqs=${fmtInt(parsed.totals.httpRequests)} http_failed=${fmtPercent(parsed.totals.httpFailedRate)} (includes 429s — see per-flow throttled column) iterations=${fmtInt(parsed.totals.iterations)} vus_max=${fmtInt(parsed.totals.vusMax)}`,
  )
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) main()
