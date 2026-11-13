import { describe, expect, it } from 'vitest'
import { resolveRuntimePlan } from '../src/runtime'
import { testConfig } from './config-fixture'

const primary = { isPrimary: true, isWorker: false }
const worker = { isPrimary: false, isWorker: true }

describe('runtime role plan', () => {
  it('keeps the default role in one process', () => {
    expect(resolveRuntimePlan({ ...testConfig, INGEST_ROLE: 'all' }, primary)).toEqual({ kind: 'single', role: 'all' })
  })

  it('runs a dedicated drainer without forking', () => {
    expect(resolveRuntimePlan({ ...testConfig, INGEST_ROLE: 'drain' }, primary)).toEqual({ kind: 'single', role: 'drain' })
  })

  it('serves a single http process when cluster mode is off or one worker is configured', () => {
    expect(
      resolveRuntimePlan({ ...testConfig, INGEST_ROLE: 'http', INGEST_CLUSTER_ENABLED: false }, primary),
    ).toEqual({ kind: 'single', role: 'http' })
    expect(resolveRuntimePlan({ ...testConfig, INGEST_ROLE: 'http', INGEST_HTTP_WORKERS: 1 }, primary)).toEqual({
      kind: 'single',
      role: 'http',
    })
  })

  it('forks workers in the primary and serves in the forked children', () => {
    expect(resolveRuntimePlan({ ...testConfig, INGEST_ROLE: 'http', INGEST_HTTP_WORKERS: 4 }, primary)).toEqual({
      kind: 'cluster-primary',
      workers: 4,
    })
    expect(resolveRuntimePlan({ ...testConfig, INGEST_ROLE: 'http', INGEST_HTTP_WORKERS: 4 }, worker)).toEqual({
      kind: 'cluster-worker',
    })
  })
})
