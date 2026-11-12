import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api-config', () => ({ API_BASE: 'https://api.polycheck.test/api' }))

const student = {
  id: 'student-1',
  studentId: '2026-00001-MN-0',
  fullName: 'Test Student',
  role: 'student',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function prepare(queued: number) {
  localStorage.setItem('polycheck-user', JSON.stringify(student))
  vi.resetModules()
  const [{ api, requestUserLogout }, store] = await Promise.all([
    import('../api-client'),
    import('./store'),
  ])
  await store.wipeOfflineStore()
  await store.initializeOfflineStore(student.id)
  for (let index = 0; index < queued; index += 1) {
    await store.enqueueOfflineOperation('attendance_scan', {
      sessionId: `sess-${index}`,
      clientAttemptId: `attempt-${index}`,
    })
  }
  return { api, requestUserLogout, store }
}

describe('queue-aware logout', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('preserves queued check-ins on a default sign-out', async () => {
    const { api, store } = await prepare(2)
    await expect(api.pendingOfflineSyncCount()).resolves.toBe(2)

    await api.logout()

    // The queue was consulted, so the wipe was skipped; the same account can
    // sign back in, decrypt its evidence (the owner key survived) and drain it.
    await store.initializeOfflineStore(student.id)
    await expect(store.getPendingSyncCount()).resolves.toBe(2)
    const issues = await store.getOfflineQueueIssues()
    expect(issues.map((issue) => issue.sessionId).sort()).toEqual([
      'sess-0',
      'sess-1',
    ])
  })

  it('preserves the queue on programmatic termination even when a discard is requested', async () => {
    const { api, store } = await prepare(1)

    await api.logout({ armDeviceCooldown: false, discardOfflineQueue: true })

    await store.initializeOfflineStore(student.id)
    await expect(store.getPendingSyncCount()).resolves.toBe(1)
  })

  it('does not log out when the user declines the discard confirmation', async () => {
    const { requestUserLogout, store } = await prepare(2)
    const confirm = vi.fn(() => false)

    const outcome = await requestUserLogout(confirm)

    expect(confirm).toHaveBeenCalledWith(2)
    expect(outcome).toEqual({
      loggedOut: false,
      pendingSyncCount: 2,
      queuePreserved: true,
    })
    expect(fetch).not.toHaveBeenCalled()
    await expect(store.getPendingSyncCount()).resolves.toBe(2)
  })

  it('wipes the queue only after the user confirms the discard', async () => {
    const { requestUserLogout, store } = await prepare(2)

    const outcome = await requestUserLogout(() => true)

    expect(outcome.loggedOut).toBe(true)
    expect(outcome.queuePreserved).toBe(false)
    await store.initializeOfflineStore(student.id)
    await expect(store.getPendingSyncCount()).resolves.toBe(0)
  })

  it('does not prompt when the queue is empty', async () => {
    const { requestUserLogout } = await prepare(0)
    const confirm = vi.fn(() => true)

    const outcome = await requestUserLogout(confirm)

    expect(confirm).not.toHaveBeenCalled()
    expect(outcome).toMatchObject({ loggedOut: true, pendingSyncCount: 0 })
  })
})
