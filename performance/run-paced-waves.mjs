#!/usr/bin/env node
/**
 * Runs a fixture through paced k6 waves (local LT3/LT4 simulation).
 *
 * Each wave uses K6_USER_START so every student scans exactly once. Waves are
 * spaced to model realistic arrival rates (default 50 students every 4 s,
 * ~12.5 scans/s) instead of one instantaneous burst.
 *
 * Env:
 *   K6_FIXTURE_FILE (required, absolute)   fixture without TEACHER_TOKEN to skip dashboard reads
 *   K6_USER_COUNT (default 5000)
 *   K6_WAVE_SIZE (default 50)
 *   K6_WAVE_GAP_MS (default 4000)
 *   K6_MODE=online|offline (default online)
 *   K6_RESULTS_FILE (absolute; default sibling of fixture)
 *   K6_DOCKER_IMAGE (default grafana/k6:1.3.0)
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'

const fixturePath = process.env.K6_FIXTURE_FILE
if (!fixturePath || !isAbsolute(fixturePath)) throw new Error('K6_FIXTURE_FILE must be an absolute path')
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const total = Number(process.env.K6_USER_COUNT ?? 5000)
const waveSize = Number(process.env.K6_WAVE_SIZE ?? 50)
const gapMs = Number(process.env.K6_WAVE_GAP_MS ?? 4000)
const mode = process.env.K6_MODE || 'online'
const image = process.env.K6_DOCKER_IMAGE || 'grafana/k6:1.3.0'
const resultsPath = process.env.K6_RESULTS_FILE || join(dirname(fixturePath), `paced-${mode}-results.json`)
const fixtureName = fixturePath.split(/[\\/]/).pop()
const fixtureDir = dirname(fixturePath)
const scriptsDir = join(process.cwd(), 'performance')
const summaryDir = join(fixtureDir, `waves-${mode}`)
const tokenCount = Array.isArray(fixture.tokens) ? fixture.tokens.length : 0

if (!Number.isInteger(total) || total < 1 || total > 5000) throw new Error('K6_USER_COUNT must be 1-5000')
if (!Number.isInteger(waveSize) || waveSize < 1 || waveSize > 500) throw new Error('K6_WAVE_SIZE must be 1-500')
if (total > tokenCount) throw new Error(`Fixture has ${tokenCount} tokens; need ${total}`)
if (!existsSync(summaryDir)) mkdirSync(summaryDir, { recursive: true })

const waves = Math.ceil(total / waveSize)
const startedAt = Date.now()
const results = []
console.log(`Paced ${mode} run: ${total} students in ${waves} waves of ${waveSize}, gap ${gapMs}ms`)

for (let index = 0; index < waves; index += 1) {
  const start = index * waveSize
  const count = Math.min(waveSize, total - start)
  const summaryFile = join(summaryDir, `wave-${index}.json`)
  const args = [
    'run', '--rm',
    '-v', `${scriptsDir}:/scripts:ro`,
    '-v', `${fixtureDir}:/fixtures`,
    '-e', 'K6_PROFILE=smoke',
    '-e', `K6_USER_COUNT=${count}`,
    '-e', `K6_USER_START=${start}`,
    '-e', `K6_MODE=${mode}`,
    '-e', `K6_FIXTURE_FILE=/fixtures/${fixtureName}`,
    '-e', `K6_SUMMARY_EXPORT=/fixtures/waves-${mode}/wave-${index}.json`,
    image, 'run', '/scripts/attendance-load.js',
  ]
  const waveStarted = Date.now()
  const run = spawnSync('docker', args, { encoding: 'utf8', timeout: 300_000, maxBuffer: 64 * 1024 * 1024 })
  const elapsed = Date.now() - waveStarted
  if (run.status !== 0) {
    console.error(`Wave ${index + 1}/${waves} failed (exit ${run.status})`)
    console.error((run.stderr || run.stdout || '').slice(-2000))
    process.exit(1)
  }
  if (!existsSync(summaryFile)) throw new Error(`Wave ${index + 1} produced no summary`)
  const metrics = JSON.parse(readFileSync(summaryFile, 'utf8')).metrics
  const scan = metrics['http_req_duration{operation:scan}'] || {}
  const accepted = metrics.accepted_attendance || {}
  const checks = metrics.checks || {}
  const iterations = metrics.iterations || {}
  results.push({
    wave: index + 1,
    start,
    count,
    p95Ms: scan['p(95)'] ?? null,
    maxMs: scan.max ?? null,
    accepted: accepted.value === 1 ? count : 0,
    checksFailed: checks.fails ?? null,
    iterations: iterations.count ?? null,
    wallMs: elapsed,
  })
  if ((index + 1) % 10 === 0 || index === waves - 1) {
    console.log(`  ${index + 1}/${waves} waves complete (${Math.round((Date.now() - startedAt) / 1000)}s)`)
  }
  const remaining = gapMs - elapsed
  if (remaining > 0 && index < waves - 1) await new Promise((resolve) => setTimeout(resolve, remaining))
  if (Date.now() - startedAt > 13 * 60 * 1000) throw new Error('Exceeded the 15-minute QR window safety margin; aborting')
}

const p95s = results.map((result) => result.p95Ms).filter((value) => typeof value === 'number')
const aggregate = {
  mode,
  students: total,
  waves,
  waveSize,
  gapMs,
  durationSeconds: Math.round((Date.now() - startedAt) / 1000),
  accepted: results.reduce((sum, result) => sum + result.accepted, 0),
  failedWaves: results.filter((result) => result.checksFailed > 0).length,
  totalChecksFailed: results.reduce((sum, result) => sum + (result.checksFailed ?? 0), 0),
  worstWaveP95Ms: p95s.length ? Math.max(...p95s) : null,
  meanWaveP95Ms: p95s.length ? Math.round(p95s.reduce((sum, value) => sum + value, 0) / p95s.length) : null,
  wavesDetail: results,
}
writeFileSync(resultsPath, JSON.stringify(aggregate, null, 2))
console.log('')
console.log(JSON.stringify({ ...aggregate, wavesDetail: undefined }, null, 2))
console.log(`Detailed results: ${resultsPath}`)
if (aggregate.accepted !== total || aggregate.totalChecksFailed !== 0) process.exit(1)
