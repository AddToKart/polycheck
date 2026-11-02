import { shouldTerminateForReplacedSession } from '../lib/session-replacement'
import type { SessionReplacementProbe } from '../lib/session-replacement'
import type { User } from '@polycheck/shared'

const user = { id: 'stu-1', role: 'student' } as unknown as User

const probeReturning = (value: User | null, options: { throw?: boolean } = {}): SessionReplacementProbe => ({
  restoreSession: jest.fn(() =>
    options.throw ? Promise.reject(new Error('offline')) : Promise.resolve(value),
  ),
})

describe('shouldTerminateForReplacedSession', () => {
  it('terminates only when the live session probe reports the session is gone', async () => {
    const probe = probeReturning(null)

    await expect(shouldTerminateForReplacedSession(probe)).resolves.toBe(true)
  })

  it('terminates for a cross-device replacement right after this device completed its own login', async () => {
    // Only an in-flight login mutes the monitor; a completed login leaves the
    // fresh token in place so the probe is authoritative either way.
    const probe = probeReturning(null)
    probe.isOwnLoginInFlight = jest.fn().mockReturnValue(false)

    await expect(shouldTerminateForReplacedSession(probe)).resolves.toBe(true)
    expect(probe.restoreSession).toHaveBeenCalledTimes(1)
  })

  it('skips the probe entirely while this device has a login in flight', async () => {
    const probe = probeReturning(null)
    probe.isOwnLoginInFlight = jest.fn().mockReturnValue(true)

    await expect(shouldTerminateForReplacedSession(probe)).resolves.toBe(false)
    expect(probe.restoreSession).not.toHaveBeenCalled()
  })

  it('probes again once the in-flight stamp has expired', async () => {
    const probe = probeReturning(null)
    probe.isOwnLoginInFlight = jest.fn((now?: number) => Boolean(now && now < 100))

    await expect(shouldTerminateForReplacedSession(probe, 5_000)).resolves.toBe(true)
    expect(probe.restoreSession).toHaveBeenCalledTimes(1)
  })

  it('never terminates on a probe failure (network is not proof of revocation)', async () => {
    const probe: SessionReplacementProbe = {
      restoreSession: jest.fn(() => Promise.reject(new Error('offline'))),
    }

    await expect(shouldTerminateForReplacedSession(probe)).resolves.toBe(false)
  })
})
