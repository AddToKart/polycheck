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
})
