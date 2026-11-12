#!/usr/bin/env node
/**
 * Server-side sampler for local load runs.
 *
 * Samples every --interval-ms (default 2000) while a k6 run is active and writes
 * NDJSON to performance/results/<run>-server.ndjson, then a compact summary to
 * performance/results/<run>-server.json.
 *
 * It stops gracefully when run-load.mjs writes "stop\n" to stdin (or closes it),
 * on SIGINT/SIGTERM, or after --duration-ms when used standalone.
 *
 * Usage:
 *   node performance/observe.mjs --run <name> [--duration-ms 10000]
 *   (run-load.mjs spawns it and stops it through stdin)
 *
 * Probes (all individually error-tolerant, so one failed probe never kills the run):
 *   - postgres: pg_stat_activity totals/active/idle/idle-in-transaction/waiters,
 *     max wait, >1s queries, ungranted pg_locks
 *   - redis: INFO summary (clients, ops/s, memory, rejected connections)
 *   - backend: GET /api/metrics (event loop lag, RSS/heap, HTTP counters) and
 *     docker stats --no-stream for the backend container
 *   - errors: backend 5xx counted from `docker compose logs backend --since`
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

const argValue = (name) => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}
const hasFlag = (name) => process.argv.includes(`--${name}`)

const runName = argValue('run') || process.env.LOAD_RUN_NAME
if (!runName || !/^[A-Za-z0-9._-]{1,80}$/.test(runName)) {
  console.error('observe.mjs: --run <name> is required (1-80 safe characters)')
  process.exit(2)
}

const outDirArg = argValue('out-dir') || join('performance', 'results')
const outDir = isAbsolute(outDirArg) ? outDirArg : resolve(repoRoot, outDirArg)
const ndjsonPath = join(outDir, `${runName}-server.ndjson`)
const summaryPath = join(outDir, `${runName}-server.json`)
const intervalMs = Number(argValue('interval-ms') ?? 2000)
const durationMs = Number(argValue('duration-ms') ?? 0)
const composeFileArg = argValue('compose-file') || 'docker-compose.local.yml'
const composeFile = isAbsolute(composeFileArg) ? composeFileArg : resolve(repoRoot, composeFileArg)
const baseUrl = (argValue('base-url') || process.env.OBSERVE_BASE_URL || 'http://127.0.0.1:4000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')
const collectLogs = !hasFlag('no-logs')
const collectStats = !hasFlag('no-docker-stats')
if (!Number.isFinite(intervalMs) || intervalMs < 250) {
  console.error('observe.mjs: --interval-ms must be >= 250')
  process.exit(2)
}

mkdirSync(outDir, { recursive: true })

const compose = ['compose', '-f', composeFile]

const exec = (file, args, timeout = 20000) =>
  new Promise((resolvePromise) => {
    execFile(
      file,
      args,
      { timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (error) resolvePromise({ ok: false, error: `${error.message} ${String(stderr || '').slice(0, 300)}`.trim(), stdout: '' })
        else resolvePromise({ ok: true, stdout })
      },
    )
  })

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

const round = (value, digits = 3) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const percentile = (values, p) => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]
}

/* ------------------------------------------------------------------ postgres */

const PG_SQL = `
SELECT
  (SELECT count(*) FROM pg_stat_activity WHERE datname = 'polycheck')::text,
  (SELECT count(*) FROM pg_stat_activity WHERE datname = 'polycheck' AND state = 'active')::text,
  (SELECT count(*) FROM pg_stat_activity WHERE datname = 'polycheck' AND state = 'idle')::text,
  (SELECT count(*) FROM pg_stat_activity WHERE datname = 'polycheck' AND state = 'idle in transaction')::text,
  (SELECT count(*) FROM pg_stat_activity WHERE datname = 'polycheck' AND state = 'active' AND wait_event_type IS NOT NULL)::text,
  (SELECT coalesce(max(extract(epoch FROM (clock_timestamp() - state_change))), 0) FROM pg_stat_activity WHERE datname = 'polycheck' AND state = 'active' AND wait_event_type IS NOT NULL)::text,
  (SELECT count(*) FROM pg_stat_activity WHERE datname = 'polycheck' AND state = 'active' AND query_start IS NOT NULL AND clock_timestamp() - query_start > interval '1 second')::text,
  (SELECT coalesce(max(extract(epoch FROM (clock_timestamp() - query_start))), 0) FROM pg_stat_activity WHERE datname = 'polycheck' AND state = 'active' AND query_start IS NOT NULL AND clock_timestamp() - query_start > interval '1 second')::text,
  (SELECT count(*) FROM pg_locks WHERE NOT granted)::text,
  (SELECT coalesce(max(extract(epoch FROM (clock_timestamp() - state_change))), 0) FROM pg_stat_activity WHERE datname = 'polycheck' AND state = 'idle in transaction')::text,
  (SELECT current_setting('max_connections')::text)
`

const samplePostgres = async () => {
  const result = await exec('docker', [
    ...compose,
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'polycheck',
    '-d',
    'polycheck',
    '-tA',
    '-F',
    '|',
    '-c',
    PG_SQL,
  ])
  if (!result.ok) return { error: result.error }
  const line = result.stdout
    .trim()
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.includes('|'))
    .at(-1)
  if (!line) return { error: 'psql returned no row' }
  const cells = line.split('|').map((cell) => Number(cell.trim()))
  if (cells.length < 11 || cells.some((value) => Number.isNaN(value))) {
    return { error: `psql row not understood: ${line.slice(0, 160)}` }
  }
  return {
    total: cells[0],
    active: cells[1],
    idle: cells[2],
    idleInTransaction: cells[3],
    waiting: cells[4],
    maxWaitSeconds: round(cells[5]),
    longQueries: cells[6],
    longQueryMaxSeconds: round(cells[7]),
    lockWaits: cells[8],
    idleInTransactionMaxSeconds: round(cells[9]),
    maxConnections: cells[10],
  }
}

/* --------------------------------------------------------------------- redis */

const parseRedisInfo = (text) => {
  const info = {}
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf(':')
    if (separator < 0) continue
    info[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }
  return info
}

const sampleRedis = async () => {
  const result = await exec('docker', [...compose, 'exec', '-T', 'redis', 'redis-cli', 'INFO'])
  if (!result.ok) return { error: result.error }
  const info = parseRedisInfo(result.stdout)
  const asNumber = (key, fallback = 0) => {
    const value = Number(info[key])
    return Number.isFinite(value) ? value : fallback
  }
  return {
    connectedClients: asNumber('connected_clients'),
    blockedClients: asNumber('blocked_clients'),
    instantaneousOpsPerSecond: asNumber('instantaneous_ops_per_sec'),
    usedMemoryHuman: info.used_memory_human ?? null,
    usedMemoryBytes: asNumber('used_memory'),
    rejectedConnections: asNumber('rejected_connections'),
    totalConnectionsReceived: asNumber('total_connections_received'),
    totalErrorReplies: asNumber('total_error_replies'),
    opsPerSecond: asNumber('instantaneous_ops_per_sec'),
  }
}

/* ------------------------------------------------------------------- backend */

const parsePrometheus = (text) => {
  const metrics = new Map()
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([0-9eE+.\-]+)\s*$/)
    if (!match) continue
    const name = match[1]
    const value = Number(match[3])
    if (!Number.isFinite(value)) continue
    const labels = {}
    if (match[2]) {
      for (const pair of match[2].slice(1, -1).matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g)) {
        labels[pair[1]] = pair[2]
      }
    }
    if (!metrics.has(name)) metrics.set(name, [])
    metrics.get(name).push({ labels, value })
  }
  return metrics
}

const sumMetric = (metrics, name, predicate) => {
  const entries = metrics.get(name)
  if (!entries) return null
  const filtered = predicate ? entries.filter((entry) => predicate(entry.labels)) : entries
  if (filtered.length === 0) return 0
  return filtered.reduce((total, entry) => total + entry.value, 0)
}

const sampleBackend = async () => {
  let text
  try {
    const response = await fetch(`${baseUrl}/api/metrics`, { signal: AbortSignal.timeout(4000) })
    if (!response.ok) return { error: `metrics HTTP ${response.status}` }
    text = await response.text()
  } catch (error) {
    return { error: `metrics fetch failed: ${error.message}` }
  }
  const metrics = parsePrometheus(text)
  const fiveXx = sumMetric(metrics, 'polycheck_http_requests_total', (labels) => /^5/.test(labels.status_code ?? ''))
  const fourXx = sumMetric(metrics, 'polycheck_http_requests_total', (labels) => /^4/.test(labels.status_code ?? ''))
  const fourTwoNine = sumMetric(metrics, 'polycheck_http_requests_total', (labels) => labels.status_code === '429')
  return {
    eventLoopLagP99Ms: round((sumMetric(metrics, 'polycheck_nodejs_eventloop_lag_p99_seconds') ?? 0) * 1000, 2),
    eventLoopLagMaxMs: round((sumMetric(metrics, 'polycheck_nodejs_eventloop_lag_max_seconds') ?? 0) * 1000, 2),
    rssBytes: sumMetric(metrics, 'polycheck_process_resident_memory_bytes') ?? null,
    heapUsedBytes: sumMetric(metrics, 'polycheck_nodejs_heap_size_used_bytes') ?? null,
    httpInFlight: sumMetric(metrics, 'polycheck_http_requests_in_flight') ?? 0,
    httpRequestsTotal: sumMetric(metrics, 'polycheck_http_requests_total') ?? 0,
    http5xxTotal: fiveXx,
    http4xxTotal: fourXx,
    http429Total: fourTwoNine,
    httpDurationCount: sumMetric(metrics, 'polycheck_http_request_duration_seconds_count') ?? 0,
    httpDurationSumSeconds: sumMetric(metrics, 'polycheck_http_request_duration_seconds_sum') ?? 0,
  }
}

/* --------------------------------------------------------------- docker stats */

const parseBytes = (text) => {
  const match = String(text).trim().match(/^([0-9.]+)\s*([KMGTP]?i?B)$/i)
  if (!match) return null
  const value = Number(match[1])
  const unit = match[2].toLowerCase()
  const multipliers = {
    b: 1,
    kb: 1000,
    kib: 1024,
    mb: 1000 ** 2,
    mib: 1024 ** 2,
    gb: 1000 ** 3,
    gib: 1024 ** 3,
    tb: 1000 ** 4,
    tib: 1024 ** 4,
  }
  return Number.isFinite(value) && multipliers[unit] ? Math.round(value * multipliers[unit]) : null
}

let backendContainer = null
const resolveBackendContainer = async () => {
  if (backendContainer) return backendContainer
  const result = await exec('docker', [...compose, 'ps', '-q', 'backend'])
  const id = result.stdout.trim().split('\n').filter(Boolean)[0]
  backendContainer = id || 'polycheck-local-backend-1'
  return backendContainer
}

const sampleDockerStats = async () => {
  const container = await resolveBackendContainer()
  const result = await exec('docker', ['stats', '--no-stream', '--format', '{{json .}}', container], 25000)
  if (!result.ok) return { error: result.error, container }
  const line = result.stdout.trim().split('\n').filter(Boolean).at(-1)
  if (!line) return { error: 'docker stats returned nothing', container }
  let parsed
  try {
    parsed = JSON.parse(line)
  } catch (error) {
    return { error: `docker stats JSON parse failed: ${error.message}`, container }
  }
  const [memoryUsed, memoryLimit] = String(parsed.MemUsage || '').split('/').map((part) => part.trim())
  return {
    container,
    cpuPercent: Number.parseFloat(parsed.CPUPerc) || 0,
    memPercent: Number.parseFloat(parsed.MemPerc) || 0,
    memoryUsedBytes: parseBytes(memoryUsed),
    memoryLimitBytes: parseBytes(memoryLimit),
    pids: Number.parseInt(parsed.PIDs, 10) || null,
  }
}

/* --------------------------------------------------------------- backend 5xx */

let lastLogTime = Date.now()
// Re-read a small overlap on every tick so a request logged right at the window
// boundary (or with sub-second clock skew) is never missed; the seen-set keeps
// the overlap from being double counted.
const LOG_OVERLAP_MS = 750
const seenLogKeys = new Set()
const seenLogOrder = []
const sampleLogs = async () => {
  if (!collectLogs) return { skipped: true }
  const since = new Date(lastLogTime - LOG_OVERLAP_MS).toISOString()
  const result = await exec('docker', [...compose, 'logs', 'backend', '--since', since, '--no-log-prefix'], 30000)
  if (!result.ok) return { error: result.error }
  let count5xx = 0
  let maxTime = lastLogTime
  let lines = 0
  for (const line of result.stdout.split('\n')) {
    if (!line.trim() || !line.includes('"statusCode"')) continue
    let parsed
    try {
      parsed = JSON.parse(line)
    } catch {
      // Truncated/split lines: text match only (cannot dedupe reliably).
      if (/"statusCode":\s*5\d\d/.test(line)) count5xx += 1
      continue
    }
    const time = Number(parsed.time)
    if (!Number.isFinite(time)) continue
    if (time < lastLogTime - LOG_OVERLAP_MS) continue
    const key = `${time}:${parsed.req?.id ?? ''}`
    if (seenLogKeys.has(key)) continue
    seenLogKeys.add(key)
    seenLogOrder.push(key)
    if (time > maxTime) maxTime = time
    lines += 1
    const status = Number(parsed?.res?.statusCode)
    if (status >= 500 && status <= 599) count5xx += 1
  }
  if (seenLogOrder.length > 5000) {
    for (const key of seenLogOrder.splice(0, seenLogOrder.length - 2500)) seenLogKeys.delete(key)
  }
  lastLogTime = maxTime
  return { count5xx, lines }
}

/* --------------------------------------------------------------------- loop */

const samples = []
let finished = false
let windowStartedAt = null

const collect = async () => {
  const startedAt = Date.now()
  const [pg, redis, backend, dockerStats, logs] = await Promise.allSettled([
    samplePostgres(),
    sampleRedis(),
    sampleBackend(),
    collectStats ? sampleDockerStats() : Promise.resolve({ skipped: true }),
    sampleLogs(),
  ])
  const unwrap = (settled, name) => {
    if (settled.status === 'rejected') return { error: `${name} probe threw: ${settled.reason?.message ?? settled.reason}` }
    return settled.value
  }
  const record = {
    ts: new Date().toISOString(),
    probeMs: Date.now() - startedAt,
    pg: unwrap(pg, 'postgres'),
    redis: unwrap(redis, 'redis'),
    backend: unwrap(backend, 'backend'),
    docker: unwrap(dockerStats, 'docker'),
    logs: unwrap(logs, 'logs'),
  }
  const errors = []
  for (const section of ['pg', 'redis', 'backend', 'docker', 'logs']) {
    if (record[section]?.error) errors.push(`${section}: ${record[section].error}`)
  }
  if (errors.length > 0) record.errors = errors
  return record
}

const finalSummary = () => {
  if (finished) return
  finished = true
  const windowStartMs = windowStartedAt ?? (samples[0] ? Date.parse(samples[0].ts) : Date.now())
  const windowEndMs = Date.now()
  const startedAt = new Date(windowStartMs).toISOString()
  const endedAt = new Date(windowEndMs).toISOString()
  const durationSeconds = Math.max(0, (windowEndMs - windowStartMs) / 1000)
  const sampleSpanSeconds = samples.length > 1 ? (Date.parse(samples.at(-1).ts) - Date.parse(samples[0].ts)) / 1000 : 0
  const withSection = (section) => samples.map((sample) => sample[section]).filter((value) => value && !value.error)
  const maxOf = (values) => (values.length === 0 ? null : Math.max(...values.filter((value) => Number.isFinite(value))))
  const p95 = (values) => percentile(values, 95)
  const roundOrNull = (value, digits = 2) => (value === null ? null : round(value, digits))

  const pgSamples = withSection('pg')
  const redisSamples = withSection('redis')
  const backendSamples = withSection('backend')
  const dockerSamples = withSection('docker')
  const logSamples = withSection('logs')

  const fiveXxTotal = logSamples.reduce((total, entry) => total + (entry.count5xx ?? 0), 0)
  const eventLoopP99Samples = backendSamples.map((entry) => entry.eventLoopLagP99Ms).filter(Number.isFinite)
  const rssSamples = backendSamples.map((entry) => entry.rssBytes).filter(Number.isFinite)
  const cumulative = (key) => {
    const first = backendSamples.find((entry) => Number.isFinite(entry[key]))
    const last = [...backendSamples].reverse().find((entry) => Number.isFinite(entry[key]))
    return first && last ? last[key] - first[key] : null
  }

  const summary = {
    run: runName,
    startedAt,
    endedAt,
    durationSeconds: round(durationSeconds, 1),
    sampleSpanSeconds: round(sampleSpanSeconds, 1),
    intervalMs,
    samples: samples.length,
    probeErrors: samples.reduce((total, sample) => total + (sample.errors?.length ?? 0), 0),
    probeErrorDetails: [...new Set(samples.flatMap((sample) => sample.errors ?? []))].slice(0, 12),
    postgres: {
      maxConnections: pgSamples.at(-1)?.maxConnections ?? null,
      peakTotal: maxOf(pgSamples.map((entry) => entry.total)),
      peakActive: maxOf(pgSamples.map((entry) => entry.active)),
      peakIdle: maxOf(pgSamples.map((entry) => entry.idle)),
      peakIdleInTransaction: maxOf(pgSamples.map((entry) => entry.idleInTransaction)),
      peakWaiters: maxOf(pgSamples.map((entry) => entry.waiting)),
      peakMaxWaitSeconds: maxOf(pgSamples.map((entry) => entry.maxWaitSeconds)),
      peakLongQueries: maxOf(pgSamples.map((entry) => entry.longQueries)),
      peakLongQueryMaxSeconds: maxOf(pgSamples.map((entry) => entry.longQueryMaxSeconds)),
      peakLockWaits: maxOf(pgSamples.map((entry) => entry.lockWaits)),
      sawIdleInTransaction: pgSamples.some((entry) => entry.idleInTransaction > 0),
      peakIdleInTransactionSeconds: maxOf(pgSamples.map((entry) => entry.idleInTransactionMaxSeconds)),
    },
    redis: {
      peakConnectedClients: maxOf(redisSamples.map((entry) => entry.connectedClients)),
      peakBlockedClients: maxOf(redisSamples.map((entry) => entry.blockedClients)),
      peakOpsPerSecond: maxOf(redisSamples.map((entry) => entry.instantaneousOpsPerSecond)),
      peakUsedMemoryHuman: redisSamples.length
        ? redisSamples.reduce((peak, entry) => ((entry.usedMemoryBytes ?? 0) > (peak.usedMemoryBytes ?? 0) ? entry : peak), redisSamples[0]).usedMemoryHuman
        : null,
      rejectedConnections: maxOf(redisSamples.map((entry) => entry.rejectedConnections)),
      rejectedConnectionsDelta:
        redisSamples.length > 0
          ? (redisSamples.at(-1).rejectedConnections ?? 0) - (redisSamples[0].rejectedConnections ?? 0)
          : null,
      totalErrorReplies: maxOf(redisSamples.map((entry) => entry.totalErrorReplies)),
    },
    backend: {
      eventLoopLagP95Ms: roundOrNull(p95(eventLoopP99Samples)),
      eventLoopLagMedianMs: roundOrNull(percentile(eventLoopP99Samples, 50)),
      eventLoopLagPeakP99Ms: maxOf(eventLoopP99Samples),
      eventLoopLagMaxMs: maxOf(backendSamples.map((entry) => entry.eventLoopLagMaxMs)),
      peakRssBytes: maxOf(rssSamples),
      rssGrowthBytes: rssSamples.length > 1 ? rssSamples.at(-1) - rssSamples[0] : null,
      peakHeapUsedBytes: maxOf(backendSamples.map((entry) => entry.heapUsedBytes).filter(Number.isFinite)),
      peakHttpInFlight: maxOf(backendSamples.map((entry) => entry.httpInFlight)),
      http5xxFromMetrics: cumulative('http5xxTotal'),
      http429FromMetrics: cumulative('http429Total'),
      httpRequestsFromMetrics: cumulative('httpRequestsTotal'),
      httpDurationSamples: cumulative('httpDurationCount'),
    },
    docker: {
      container: dockerSamples.at(-1)?.container ?? backendContainer,
      peakCpuPercent: maxOf(dockerSamples.map((entry) => entry.cpuPercent)),
      peakMemPercent: maxOf(dockerSamples.map((entry) => entry.memPercent)),
      peakMemBytes: maxOf(dockerSamples.map((entry) => entry.memoryUsedBytes).filter(Number.isFinite)),
      memLimitBytes: dockerSamples.at(-1)?.memoryLimitBytes ?? null,
    },
    http5xx: {
      total: fiveXxTotal,
      perMinute: durationSeconds > 0 ? round((fiveXxTotal / durationSeconds) * 60, 2) : null,
      loggedLines: logSamples.reduce((total, entry) => total + (entry.lines ?? 0), 0),
    },
  }

  writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
  console.log(`OBSERVER_SUMMARY ${summaryPath}`)
  console.log(
    [
      `  samples=${summary.samples} duration=${summary.durationSeconds}s errors=${summary.probeErrors}`,
      `  pg: peakWaiters=${summary.postgres.peakWaiters} peakActive=${summary.postgres.peakActive} peakIdleInTx=${summary.postgres.peakIdleInTransaction} maxWait=${summary.postgres.peakMaxWaitSeconds}s longQueries=${summary.postgres.peakLongQueries} lockWaits=${summary.postgres.peakLockWaits}`,
      `  redis: clients=${summary.redis.peakConnectedClients} ops/s=${summary.redis.peakOpsPerSecond} rejects=${summary.redis.rejectedConnectionsDelta ?? summary.redis.rejectedConnections} mem=${summary.redis.peakUsedMemoryHuman}`,
      `  backend: eventLoopP95=${summary.backend.eventLoopLagP95Ms}ms median=${summary.backend.eventLoopLagMedianMs}ms peakRSS=${summary.backend.peakRssBytes} dockerCPU=${summary.docker.peakCpuPercent}% dockerMem=${summary.docker.peakMemPercent}%`,
      `  5xx: logs=${summary.http5xx.total} (${summary.http5xx.perMinute ?? 'n/a'}/min) metricDelta=${summary.backend.http5xxFromMetrics} 429metricDelta=${summary.backend.http429FromMetrics}`,
    ].join('\n'),
  )
  process.exit(0)
}

const stop = () => {
  if (finished) return
  finalSummary()
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

// run-load.mjs sets OBSERVE_STDIN_STOP=1 and keeps stdin piped open; standalone
// shells often give us a closed stdin, which must NOT be read as "stop".
const stdinStop = process.env.OBSERVE_STDIN_STOP === '1' || process.stdin.isTTY
if (stdinStop) {
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (data) => {
    if (/stop|quit|q/i.test(String(data))) stop()
  })
  process.stdin.on('end', stop)
  process.stdin.on('error', stop)
  process.stdin.resume()
}

const main = async () => {
  // Warm up the docker stats path (and resolve the backend container) so the
  // first recorded sample is not skewed by Docker CLI cold-start CPU burn.
  if (collectStats) await sampleDockerStats()
  const startedAt = Date.now()
  windowStartedAt = startedAt
  // Align the log window with the metrics window: anything logged during
  // warm-up belongs to the previous window, not this run.
  lastLogTime = startedAt
  while (!finished) {
    const record = await collect()
    if (finished) break
    samples.push(record)
    appendFileSync(ndjsonPath, `${JSON.stringify(record)}\n`)
    if (samples.length === 1) console.log(`OBSERVER_READY ${record.ts} ${ndjsonPath}`)
    if (durationMs > 0 && Date.now() - startedAt >= durationMs) break
    const elapsed = Date.now() - startedAt
    const nextDue = startedAt + samples.length * intervalMs
    const wait = Math.max(0, nextDue - Date.now())
    if (durationMs > 0) {
      const remaining = durationMs - elapsed
      if (remaining <= 0) break
    }
    await sleep(wait)
  }
  finalSummary()
}

main().catch((error) => {
  console.error(`observe.mjs fatal: ${error.stack || error.message}`)
  process.exit(1)
})
