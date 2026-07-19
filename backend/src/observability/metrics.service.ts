import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client'

const QUEUE_NAME = 'attendance-sync'
const BULLMQ_COMPONENTS = ['producer', 'events', 'worker'] as const
type BullMqComponent = (typeof BULLMQ_COMPONENTS)[number]

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

  onModuleDestroy() {
    this.registry.clear()
  }
}
