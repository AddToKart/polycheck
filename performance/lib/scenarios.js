/**
 * k6 scenario builders.
 *
 * All counts derive from the fixture and the environment; nothing is
 * hardcoded. `K6_SHAPE=burst|arrival` selects the executor shape and every
 * scenario name carries the shape suffix so burst and paced results can never
 * be confused in a summary export.
 */
function intEnv(name, fallback, min, max) {
  const raw = __ENV[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer in [${min}, ${max}], got ${raw}`)
  }
  return value
}

function floatEnv(name, fallback) {
  const raw = __ENV[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number, got ${raw}`)
  return value
}

function seconds(value) {
  return `${Math.max(1, Math.ceil(value))}s`
}

/**
 * k6's constant-arrival-rate `rate` is an int64. Convert an arbitrary
 * arrivals-per-second value into the closest integer rate over a scaled
 * timeUnit so fractional rates (e.g. 2.22/s) survive instead of being rounded
 * down to 1/s.
 */
export function arrivalRate(ratePerSecond) {
  if (!(ratePerSecond > 0)) throw new Error(`arrival rate must be positive, got ${ratePerSecond}`)
  const units = [1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 900]
  let best = null
  for (const unit of units) {
    const scaled = ratePerSecond * unit
    const rate = Math.round(scaled)
    if (rate < 1) continue
    const error = Math.abs(scaled - rate)
    if (!best || error < best.error) best = { unit, rate, error }
    if (error === 0) break
  }
  return { rate: best.rate, timeUnit: `${best.unit}s` }
}

/**
 * Scan arrivals per second. Default = full fixture population / 900 s, i.e. a
 * 15-minute bell window (LOAD_TESTING.md's realism note). The rate models the
 * real population; K6_USER_COUNT only limits how many students this run
 * actually sends, so a smoke run stays short while the pacing stays realistic.
 */
export function scanRatePerSecond(fixture) {
  return floatEnv('K6_RATE_PER_SECOND', fixture.students.length / 900)
}

export function loginRatePerSecond() {
  return floatEnv('K6_LOGIN_RATE_PER_SECOND', 4)
}

export function scanScenario(fixture, shape) {
  const count = fixture.studentCount
  if (shape === 'burst') {
    const vus = Math.max(1, Math.min(count, intEnv('K6_SCAN_VUS', count, 1, 5000)))
    return {
      name: 'scan_burst',
      options: {
        executor: 'per-vu-iterations',
        vus,
        iterations: 1,
        maxDuration: seconds(Math.max(120, vus * 1.5 + 60)),
        gracefulStop: '30s',
        tags: { shape },
      },
    }
  }
  const perSecond = scanRatePerSecond(fixture)
  const arrival = arrivalRate(perSecond)
  // Warm-up/overshoot margin: 1% of the run (min 5 s) covers VU ramp-up without
  // stretching small smoke runs to a fixed 15 s.
  const durationSeconds = count / perSecond + Math.max(5, Math.ceil(count * 0.01))
  const preAllocatedVUs = Math.max(2, Math.min(600, Math.ceil(perSecond * 2) + 2))
  return {
    name: 'scan_paced',
    options: {
      executor: 'constant-arrival-rate',
      rate: arrival.rate,
      timeUnit: arrival.timeUnit,
      duration: seconds(durationSeconds),
      preAllocatedVUs,
      maxVUs: Math.min(1000, preAllocatedVUs * 3),
      gracefulStop: '30s',
      tags: { shape },
    },
  }
}

export function loginScenario(fixture, shape) {
  const count = fixture.studentCount
  if (shape === 'burst') {
    const vus = Math.max(1, Math.min(count, intEnv('K6_LOGIN_VUS', count, 1, 5000)))
    return {
      name: 'login_burst',
      options: {
        executor: 'per-vu-iterations',
        vus,
        iterations: 1,
        maxDuration: seconds(Math.max(120, vus * 1.5 + 60)),
        gracefulStop: '30s',
        tags: { shape },
      },
    }
  }
  const perSecond = loginRatePerSecond()
  const arrival = arrivalRate(perSecond)
  const durationSeconds = count / perSecond + Math.max(5, Math.ceil(count * 0.01))
  const preAllocatedVUs = Math.max(2, Math.min(200, Math.ceil(perSecond * 2) + 2))
  return {
    name: 'login_paced',
    options: {
      executor: 'constant-arrival-rate',
      rate: arrival.rate,
      timeUnit: arrival.timeUnit,
      duration: seconds(durationSeconds),
      preAllocatedVUs,
      maxVUs: Math.min(400, preAllocatedVUs * 3),
      gracefulStop: '30s',
      tags: { shape },
    },
  }
}

export function fixedScenario(name, shape, options) {
  const { vus, iterations, startTime, maxDuration = '10m' } = options
  return {
    name,
    options: {
      executor: 'per-vu-iterations',
      vus,
      iterations,
      ...(startTime ? { startTime } : {}),
      maxDuration,
      gracefulStop: '30s',
      tags: { shape },
    },
  }
}

/** How many students each small flow should touch (fixture-derived, capped). */
export function shareCount(fixture, envName, share, cap, min = 1) {
  const fallback = Math.max(min, Math.min(cap, Math.ceil(fixture.studentCount * share)))
  return Math.max(min, Math.min(cap, intEnv(envName, fallback, 1, 2000)))
}

export function mixedScenario(shape) {
  if (shape === 'burst') {
    const vus = intEnv('K6_MIX_VUS', 50, 1, 500)
    const perVu = intEnv('K6_MIX_ITERATIONS_PER_VU', 6, 1, 200)
    return {
      name: 'mixed_burst',
      options: {
        executor: 'per-vu-iterations',
        vus,
        iterations: perVu,
        maxDuration: seconds(Math.max(120, vus * perVu * 1.5 + 60)),
        gracefulStop: '30s',
        tags: { shape },
      },
    }
  }
  const perSecond = floatEnv('K6_MIX_RATE_PER_SECOND', 12)
  const arrival = arrivalRate(perSecond)
  const duration = __ENV.K6_MIX_DURATION || '5m'
  const preAllocatedVUs = Math.max(2, Math.min(500, Math.ceil(perSecond * 2) + 2))
  return {
    name: 'mixed_paced',
    options: {
      executor: 'constant-arrival-rate',
      rate: arrival.rate,
      timeUnit: arrival.timeUnit,
      duration,
      preAllocatedVUs,
      maxVUs: Math.min(1000, preAllocatedVUs * 3),
      gracefulStop: '30s',
      tags: { shape },
    },
  }
}
