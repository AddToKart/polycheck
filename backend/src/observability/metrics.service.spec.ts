import { MetricsService } from './metrics.service'

describe('MetricsService', () => {
  it('collects process defaults and exposes only fixed BullMQ dimensions', async () => {
    const metrics = new MetricsService()
    metrics.configureBullMq(true)
    metrics.setBullMqComponentReady('worker', true)
    metrics.setBullMqJobCounts({ wait: 2, active: 1, delayed: 0, failed: 0 })

    const output = await metrics.metrics()

    expect(output).toContain('polycheck_process_cpu_user_seconds_total')
    expect(output).toContain('polycheck_nodejs_eventloop_lag_p99_seconds')
    expect(output).toContain('queue="attendance-sync",component="worker"')
    expect(output).toContain('queue="attendance-sync",state="wait"} 2')
    metrics.onModuleDestroy()
  })

  it('extracts a server-status snapshot from the existing registry series', async () => {
    const metrics = new MetricsService()
    metrics.setApplicationReady(true)
    metrics.setDependencyReady('database', true)
    metrics.setDependencyReady('redis', true)
    metrics.setBullMqJobCounts({ wait: 2, active: 1, delayed: 0, failed: 3 })
    metrics.recordBullMqFailure()
    metrics.httpRequests.inc({ method: 'GET', route: '/sections', status_code: '200' }, 3)
    metrics.httpRequests.inc({ method: 'GET', route: '/sections', status_code: '503' }, 1)
    for (let index = 0; index < 10; index += 1) {
      metrics.httpDuration.observe({ method: 'GET', route: '/sections', status_code: '200' }, 0.2)
    }

    const snapshot = await metrics.snapshot(7)

    expect(snapshot).toEqual(
      expect.objectContaining({
        httpRequestsTotal: 4,
        httpErrorsTotal: 1,
        latencyP50Ms: 175,
        latencyP95Ms: 242.5,
        applicationReady: true,
        databaseReady: true,
        redisReady: true,
        queue: { wait: 2, active: 1, failed: 1 },
        activeSockets: 7,
      }),
    )
    expect(snapshot.memoryRssBytes).toBeGreaterThan(0)
    expect(snapshot.cpuSecondsTotal).toBeGreaterThanOrEqual(0)
    expect(snapshot.uptimeSeconds).toBeGreaterThan(0)
    expect(Date.parse(snapshot.timestamp)).not.toBeNaN()
    metrics.onModuleDestroy()
  })

  it('degrades missing latency, readiness, and queue series without throwing', async () => {
    const metrics = new MetricsService()

    const snapshot = await metrics.snapshot(0)

    expect(snapshot).toEqual(
      expect.objectContaining({
        httpRequestsTotal: 0,
        httpErrorsTotal: 0,
        latencyP50Ms: null,
        latencyP95Ms: null,
        applicationReady: false,
        databaseReady: false,
        redisReady: false,
        queue: { wait: 0, active: 0, failed: 0 },
        activeSockets: 0,
      }),
    )
    metrics.onModuleDestroy()
  })
})
