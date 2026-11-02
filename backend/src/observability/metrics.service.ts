import { Injectable, OnModuleDestroy } from '@nestjs/common'
import type { ServerStatusSnapshot } from '@polycheck/shared'
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client'

const QUEUE_NAME = 'attendance-sync'
const BULLMQ_COMPONENTS = ['producer', 'events', 'worker'] as const
type BullMqComponent = (typeof BULLMQ_COMPONENTS)[number]

type RegistryMetric = Awaited<ReturnType<Registry['getMetricsAsJSON']>>[number]

@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly registry = new Registry()
  private bullMqConfigured = false
  private readonly bullMqReady: Record<BullMqComponent, boolean> = {
    producer: false,
    events: false,
    worker: false,
  }

  readonly httpRequests = new Counter({
    name: 'polycheck_http_requests_total',
    help: 'Completed HTTP requests',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  })
  readonly httpDuration = new Histogram({
    name: 'polycheck_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  })
  readonly httpInFlight = new Gauge({
    name: 'polycheck_http_requests_in_flight',
    help: 'HTTP requests currently being processed',
    labelNames: ['method', 'route'] as const,
    registers: [this.registry],
  })
  private readonly applicationReady = new Gauge({
    name: 'polycheck_readiness_status',
    help: 'Whether this application instance is ready to serve traffic',
    registers: [this.registry],
  })
  private readonly dependencyReady = new Gauge({
    name: 'polycheck_dependency_ready',
    help: 'Whether a required application dependency is ready',
    labelNames: ['dependency'] as const,
    registers: [this.registry],
  })
  private readonly bullMqComponentReady = new Gauge({
    name: 'polycheck_bullmq_component_ready',
    help: 'Whether a BullMQ component is connected and ready',
    labelNames: ['queue', 'component'] as const,
    registers: [this.registry],
  })
  private readonly bullMqJobsFailed = new Counter({
    name: 'polycheck_bullmq_jobs_failed_total',
    help: 'BullMQ job attempts that failed',
    labelNames: ['queue'] as const,
    registers: [this.registry],
  })
  private readonly bullMqJobDuration = new Histogram({
    name: 'polycheck_bullmq_job_duration_seconds',
    help: 'BullMQ job processing duration in seconds',
    labelNames: ['queue', 'outcome'] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
    registers: [this.registry],
  })
  private readonly bullMqJobWait = new Histogram({
    name: 'polycheck_bullmq_job_wait_seconds',
    help: 'Time BullMQ jobs spend waiting before processing',
    labelNames: ['queue'] as const,
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 300],
    registers: [this.registry],
  })
  private readonly bullMqJobs = new Gauge({
    name: 'polycheck_bullmq_jobs',
    help: 'Current BullMQ jobs by state',
    labelNames: ['queue', 'state'] as const,
    registers: [this.registry],
  })
  private readonly importRows = new Counter({
    name: 'polycheck_import_rows_total',
    help: 'Bulk-import rows processed by kind and outcome',
    labelNames: ['kind', 'outcome'] as const,
    registers: [this.registry],
  })

  constructor() {
    collectDefaultMetrics({ prefix: 'polycheck_', register: this.registry })
    this.applicationReady.set(0)
    this.dependencyReady.set({ dependency: 'database' }, 0)
    this.dependencyReady.set({ dependency: 'redis' }, 0)
    this.configureBullMq(false)
  }

  get contentType() {
    return this.registry.contentType
  }

  metrics() {
    return this.registry.metrics()
  }

  setApplicationReady(ready: boolean) {
    this.applicationReady.set(ready ? 1 : 0)
  }

  setDependencyReady(dependency: 'database' | 'redis', ready: boolean) {
    this.dependencyReady.set({ dependency }, ready ? 1 : 0)
  }

  configureBullMq(configured: boolean) {
    this.bullMqConfigured = configured
    for (const component of BULLMQ_COMPONENTS) this.setBullMqComponentReady(component, false)
  }

  setBullMqComponentReady(component: BullMqComponent, ready: boolean) {
    this.bullMqReady[component] = ready
    this.bullMqComponentReady.set({ queue: QUEUE_NAME, component }, ready ? 1 : 0)
  }

  getBullMqReadiness() {
    return { configured: this.bullMqConfigured, ...this.bullMqReady }
  }

  recordBullMqFailure() {
    this.bullMqJobsFailed.inc({ queue: QUEUE_NAME })
  }

  observeBullMqJob(waitSeconds: number, durationSeconds: number, outcome: 'completed' | 'failed') {
    this.bullMqJobWait.observe({ queue: QUEUE_NAME }, Math.max(0, waitSeconds))
    this.bullMqJobDuration.observe({ queue: QUEUE_NAME, outcome }, Math.max(0, durationSeconds))
  }

  setBullMqJobCounts(counts: Record<'wait' | 'active' | 'delayed' | 'failed', number>) {
    for (const [state, count] of Object.entries(counts)) {
      this.bullMqJobs.set({ queue: QUEUE_NAME, state }, count)
    }
  }

  recordImportRows(
    kind: 'student_registration' | 'section_enrollment',
    outcome: 'created' | 'updated' | 'skipped' | 'invalid' | 'enrolled' | 'provisioned',
    count: number,
  ) {
    if (count > 0) this.importRows.inc({ kind, outcome }, count)
  }

  /**
   * Reads one live snapshot from the existing registry only — no new metric
   * definitions and no database/Redis round-trips. Missing series degrade to
   * null/0/false so a partially-initialized process can still report status.
   */
  async snapshot(activeSockets: number): Promise<ServerStatusSnapshot> {
    const metrics = await this.registry.getMetricsAsJSON()
    const byName = new Map(metrics.map((metric) => [metric.name, metric]))
    const metric = (name: string) => byName.get(name) ?? byName.get(`polycheck_${name}`)
    const sum = (name: string) => (metric(name)?.values ?? []).reduce((total, sample) => total + sample.value, 0)
    const sampleValue = (name: string, labels?: Record<string, string>): number | null => {
      const values = metric(name)?.values
      if (!values?.length) return null
      const sample = labels
        ? values.find((value) => Object.entries(labels).every(([key, expected]) => value.labels[key] === expected))
        : values[0]
      return sample ? sample.value : null
    }
    const httpRequests = metric('polycheck_http_requests_total')
    const httpErrors = (httpRequests?.values ?? [])
      .filter((sample) => Number(sample.labels.status_code) >= 500)
      .reduce((total, sample) => total + sample.value, 0)
    const duration = metric('polycheck_http_request_duration_seconds')
    const eventLoopLag =
      sampleValue('polycheck_nodejs_eventloop_lag_p99_seconds') ??
      sampleValue('polycheck_nodejs_eventloop_lag_mean_seconds')

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      httpRequestsTotal: sum('polycheck_http_requests_total'),
      httpErrorsTotal: httpErrors,
      latencyP50Ms: this.histogramPercentileMs(duration, 0.5),
      latencyP95Ms: this.histogramPercentileMs(duration, 0.95),
      eventLoopLagMs: eventLoopLag === null ? null : Math.round(eventLoopLag * 100_000) / 100,
      memoryRssBytes: sampleValue('polycheck_process_resident_memory_bytes') ?? 0,
      cpuSecondsTotal: sampleValue('polycheck_process_cpu_seconds_total') ?? 0,
      applicationReady: sampleValue('polycheck_readiness_status') === 1,
      databaseReady: sampleValue('polycheck_dependency_ready', { dependency: 'database' }) === 1,
      redisReady: sampleValue('polycheck_dependency_ready', { dependency: 'redis' }) === 1,
      queue: {
        wait: this.labelSum(metric('polycheck_bullmq_jobs'), 'state', 'wait'),
        active: this.labelSum(metric('polycheck_bullmq_jobs'), 'state', 'active'),
        failed: sum('polycheck_bullmq_jobs_failed_total'),
      },
      activeSockets,
    }
  }

  private labelSum(metric: RegistryMetric | undefined, label: string, expected: string): number {
    return (metric?.values ?? [])
      .filter((sample) => sample.labels[label] === expected)
      .reduce((total, sample) => total + sample.value, 0)
  }

  /**
   * Approximates a quantile from a cumulative histogram by interpolating
   * inside the bucket that first crosses the target rank.
   */
  private histogramPercentileMs(metric: RegistryMetric | undefined, quantile: number): number | null {
    if (!metric) return null
    const buckets = new Map<number, number>()
    for (const sample of metric.values) {
      const le = sample.labels.le
      if (le === undefined) continue
      const bound = le === '+Inf' ? Number.POSITIVE_INFINITY : Number(le)
      if (bound !== Number.POSITIVE_INFINITY && !Number.isFinite(bound)) continue
      buckets.set(bound, (buckets.get(bound) ?? 0) + sample.value)
    }
    const finite = [...buckets.entries()]
      .filter(([bound]) => Number.isFinite(bound))
      .sort(([left], [right]) => left - right)
    const total = buckets.get(Number.POSITIVE_INFINITY) ?? finite.at(-1)?.[1] ?? 0
    if (total <= 0 || finite.length === 0) return null

    const target = total * quantile
    for (let index = 0; index < finite.length; index += 1) {
      const [upper, cumulative] = finite[index]
      if (cumulative < target) continue
      const [lower, previousCumulative] = index === 0 ? [0, 0] : finite[index - 1]
      const inBucket = cumulative - previousCumulative
      const fraction = inBucket > 0 ? (target - previousCumulative) / inBucket : 0
      const milliseconds = (lower + (upper - lower) * Math.min(1, Math.max(0, fraction))) * 1_000
      return Math.round(milliseconds * 100) / 100
    }
    const last = finite.at(-1)
    return last ? last[0] * 1_000 : null
  }

  onModuleDestroy() {
    this.registry.clear()
  }
}
