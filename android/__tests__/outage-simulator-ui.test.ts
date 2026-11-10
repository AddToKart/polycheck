/**
 * F7 (WF-LD9) — Android outage simulator tests: the API-client guard, the
 * shared receipt formatter, the More-sheet gating flag, and the honest
 * restore-outcome computation.
 */
import {
  SIMULATED_NETWORK_OUTAGE_MESSAGE,
  armOutage,
  disarmOutage,
  formatOutageReceipt,
  isOutageArmed,
} from '@polycheck/shared'
import type { Session } from '@polycheck/shared'
import { api } from '../services/api-client'
import * as offlineStore from '../services/offline-store'
import { buildFacultyMoreItems, isOutageSimulatorEnabled, OUTAGE_SIMULATOR_ROUTE } from '../lib/more-items'
import { outageRestoreOutcome } from '../lib/outage-simulator-ui'

jest.mock('../services/api-config', () => ({ API_BASE: 'http://test/api' }))
jest.mock('../services/offline-store', () => ({
  initializeOfflineStore: jest.fn().mockResolvedValue(undefined),
  cacheAttendanceRecords: jest.fn().mockResolvedValue(undefined),
  cacheSections: jest.fn().mockResolvedValue(undefined),
  cacheSessions: jest.fn().mockResolvedValue(undefined),
  cacheSubjects: jest.fn().mockResolvedValue(undefined),
  drainOfflineQueue: jest.fn().mockResolvedValue(undefined),
  enqueueOfflineOperation: jest.fn().mockResolvedValue(undefined),
  getCachedAttendanceRecords: jest.fn().mockResolvedValue([]),
  getCachedSection: jest.fn().mockResolvedValue(null),
  getCachedSections: jest.fn().mockResolvedValue([]),
  getCachedSession: jest.fn().mockResolvedValue(null),
  getCachedSessions: jest.fn().mockResolvedValue([]),
  getCachedSubject: jest.fn().mockResolvedValue(null),
  getCachedSubjects: jest.fn().mockResolvedValue([]),
  getOfflineQueueSequence: jest.fn().mockResolvedValue({ count: 0, lastId: null }),
  getPendingSyncCount: jest.fn().mockResolvedValue(0),
  getServerClockOffset: jest.fn().mockResolvedValue(null),
  removeCachedAttendanceAttempt: jest.fn().mockResolvedValue(undefined),
  replaceCachedAttendanceForStudent: jest.fn().mockResolvedValue(undefined),
  replaceCachedSections: jest.fn().mockResolvedValue(undefined),
  replaceCachedSubjects: jest.fn().mockResolvedValue(undefined),
  setOfflineOwner: jest.fn().mockResolvedValue(undefined),
  setServerClockOffset: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../services/offline-crypto', () => ({
  encryptOfflineValue: jest.fn(async (value: unknown) => JSON.stringify(value)),
  decryptOfflineValue: jest.fn(async (value: string) => JSON.parse(value)),
}))
jest.mock('../services/signing-key', () => ({
  getOrCreateTeacherSigningKey: jest.fn().mockResolvedValue({
    publicKey: 'mocked-public-key',
    secretKey: 'mocked-secret-key',
  }),
}))
jest.mock('../services/device-id', () => ({
  getOrCreateInstallationId: jest.fn().mockResolvedValue('mobile-test-installation'),
}))
jest.mock('expo-secure-store')
jest.mock('react-native')

const storeMock = offlineStore as unknown as {
  getCachedSession: jest.Mock
  enqueueOfflineOperation: jest.Mock
  getPendingSyncCount: jest.Mock
}

const fetchMock = jest.fn()
const originalFetch = globalThis.fetch

beforeAll(() => {
  Object.defineProperty(globalThis, 'fetch', { value: fetchMock, writable: true, configurable: true })
})

afterAll(() => {
  Object.defineProperty(globalThis, 'fetch', { value: originalFetch, writable: true, configurable: true })
})

// Hand-crafts a QR token whose payload segment the shared mock can decode.
const makeToken = (payload: unknown): string =>
  `${Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}.fake-signature`

const cachedSession: Session = {
  id: 'sess-1',
  sectionId: 'sec-1',
  subjectName: 'Data Structures',
  mode: 'in_person',
  date: '2026-11-02',
  startTime: '09:30',
  endTime: '12:00',
  geofence: { latitude: 14.8697, longitude: 120.9991, radiusMeters: 200 },
  isActive: true,
  isRescheduled: false,
  qrValidityMinutes: 10,
  gracePeriodMinutes: 5,
  teacherPublicKey: 'teacher-public-key',
  teacherId: 'teacher-1',
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  disarmOutage()
  fetchMock.mockReset()
  storeMock.getCachedSession.mockReset().mockResolvedValue(null)
  storeMock.enqueueOfflineOperation.mockReset().mockResolvedValue(undefined)
  storeMock.getPendingSyncCount.mockReset().mockResolvedValue(0)
})

afterEach(() => {
  // The flag store is process-wide module state — never leak an armed outage.
  disarmOutage()
  expect(isOutageArmed()).toBe(false)
})

describe('api-client outage guard', () => {
  it('rejects every request before the network while armed', async () => {
    armOutage()
    const error = await api.createSubject({ name: 'Radar Science', code: 'CS 301' }).catch((caught) => caught)
    expect(error).toBeInstanceOf(TypeError)
    expect(error.message).toBe(SIMULATED_NETWORK_OUTAGE_MESSAGE)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lets requests through again once disarmed', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '[]',
    } as unknown as Response)
    await expect(api.getSubjects()).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('routes writes into the existing encrypted queue while armed', async () => {
    armOutage()
    storeMock.getCachedSession.mockResolvedValue(cachedSession)
    const token = makeToken({
      version: 1,
      sessionId: 'sess-1',
      sectionId: 'sec-1',
      teacherId: 'teacher-1',
      teacherName: 'Prof Test',
      issuedAt: Date.now() - 1_000,
      validityMinutes: 10,
      gracePeriodMinutes: 5,
      mode: 'in_person',
      pinRequired: false,
    })
    const result = await api.submitScan('sess-1', 'user-1', 'Maria Santos', 14.8697, 120.9991, 'mobile-test', token)
    if ('error' in result) throw new Error(`expected an offline record, got: ${result.error}`)
    expect(result.isSynced).toBe(false)
    expect(result.status).toBe('present')
    expect(storeMock.enqueueOfflineOperation).toHaveBeenCalledWith(
      'attendance_scan',
      expect.objectContaining({ sessionId: 'sess-1', qrToken: token }),
    )
    // The simulated outage never touches the wire — the queue is the write path.
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('formatOutageReceipt (shared helper)', () => {
  it('renders the receipt chip with the queue sequence and id prefix', () => {
    expect(formatOutageReceipt(3, 'attendance_scan:a1b2c3d4-9')).toBe('Receipt #3 · attendan')
    expect(formatOutageReceipt(104, 'a1b2c3d4')).toBe('Receipt #104 · a1b2c3d4')
  })

  it('hides the prefix when no operation id exists and clamps bad sequences', () => {
    expect(formatOutageReceipt(12)).toBe('Receipt #12')
    expect(formatOutageReceipt(0, null)).toBe('Receipt #0')
    expect(formatOutageReceipt(Number.NaN, undefined)).toBe('Receipt #0')
  })
})

describe('outage simulator More-sheet gating', () => {
  const plainTeacher = { role: 'teacher' as const }
  const superAdmin = { role: 'super_admin' as const }

  it('keeps the item out of the sheet when the flag is off', () => {
    const labels = buildFacultyMoreItems({ user: plainTeacher, showAssistant: true, pendingExcuses: 0 })
      .map((item) => item.label)
    expect(labels).not.toContain('Outage Simulator')
  })

  it('appends the bolt item for teachers when the flag is on', () => {
    const items = buildFacultyMoreItems({ user: plainTeacher, showAssistant: true, pendingExcuses: 0, outageSimulatorEnabled: true })
    const simulator = items.find((item) => item.label === 'Outage Simulator')
    expect(simulator).toMatchObject({ icon: 'bolt', route: OUTAGE_SIMULATOR_ROUTE })
    // Appended last so the production order is untouched.
    expect(items[items.length - 1].label).toBe('Outage Simulator')
  })

  it('never adds the item to the super-admin console list', () => {
    const labels = buildFacultyMoreItems({ user: superAdmin, showAssistant: true, pendingExcuses: 0, outageSimulatorEnabled: true })
      .map((item) => item.label)
    expect(labels).not.toContain('Outage Simulator')
  })

  it('parses the env flag strictly, mirroring the qr-fallback policy', () => {
    expect(isOutageSimulatorEnabled('true')).toBe(true)
    expect(isOutageSimulatorEnabled('false')).toBe(false)
    expect(isOutageSimulatorEnabled(undefined)).toBe(false)
    expect(isOutageSimulatorEnabled('TRUE')).toBe(false)
    expect(isOutageSimulatorEnabled('1')).toBe(false)
  })
})

describe('outageRestoreOutcome', () => {
  it('reports the reconciled count computed from pending counts', () => {
    expect(outageRestoreOutcome(3, 0)).toEqual({
      kind: 'reconciled',
      count: 3,
      message: '3 offline check-ins reconciled.',
    })
    expect(outageRestoreOutcome(5, 2).count).toBe(3)
  })

  it('never fakes success when the queue did not drain', () => {
    expect(outageRestoreOutcome(3, 3)).toEqual({
      kind: 'still-pending',
      count: 3,
      message: '3 saved records are still queued — check the connection and replay again.',
    })
  })

  it('reports an empty queue without inventing a count', () => {
    expect(outageRestoreOutcome(0, 0)).toEqual({
      kind: 'empty',
      count: 0,
      message: 'The encrypted queue is empty — nothing to replay.',
    })
  })

  it('tolerates non-finite counters', () => {
    expect(outageRestoreOutcome(Number.NaN, 2)).toMatchObject({ kind: 'still-pending', count: 2 })
    expect(outageRestoreOutcome(4, Number.NaN)).toMatchObject({ kind: 'reconciled', count: 4 })
  })
})
