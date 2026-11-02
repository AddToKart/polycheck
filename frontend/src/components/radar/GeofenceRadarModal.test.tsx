import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import {
  ATTENDANCE_ANOMALY_EVENT,
  type AttendanceAnomalyEvent,
  type AttendanceRecord,
  type ScanAttemptView,
  type Session,
  type Student,
} from '@polycheck/shared'
import { radarDistanceCopy, shapeRadarData } from './GeofenceRadarModal'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const apiMock = vi.hoisted(() => ({ getScanAttempts: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ api: apiMock }))

const geofenceMock = vi.hoisted(() => ({
  propsList: [] as { latitude: number; longitude: number; radiusMeters: number }[],
}))
vi.mock('@/components/GeofenceCircle', () => ({
  default: (props: { latitude: number; longitude: number; radiusMeters: number }) => {
    geofenceMock.propsList.push(props)
    return <div data-testid="geofence-circle" />
  },
}))

// The real @/components/ui/map mounts maplibre-gl (WebGL) — unusable in jsdom.
// Record marker geometry + render popups inline so copy is assertable.
const mapMock = vi.hoisted(() => ({}))
vi.mock('@/components/ui/map', () => ({
  Map: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  MapMarker: ({
    latitude,
    longitude,
    children,
  }: {
    latitude: number
    longitude: number
    children?: ReactNode
  }) => (
    <div data-testid="map-marker" data-latitude={latitude} data-longitude={longitude}>
      {children}
    </div>
  ),
  MarkerContent: ({ children }: { children?: ReactNode }) => (
    <div data-testid="marker-content">{children}</div>
  ),
  MarkerPopup: ({ children }: { children?: ReactNode }) => (
    <div data-testid="marker-popup">{children}</div>
  ),
  useMap: () => ({ map: null, isLoaded: false }),
}))

// ── Socket.io mock: a registry of per-socket handlers for live-event tests ────
const sockets = vi.hoisted(() => ({
  instances: [] as Array<unknown>,
  last: null as {
    handlers: Map<string, (payload: unknown) => void>
    emitted: Array<{ event: string; payload: unknown }>
    removed: boolean
    disconnected: boolean
  } | null,
  io: null as unknown,
}))
vi.mock('socket.io-client', () => ({
  // Install-time indirection: installSocketMock() swaps `sockets.io` per test,
  // so the factory must defer to it at call time instead of binding the value.
  io: (...args: unknown[]) => (sockets.io as (...a: unknown[]) => unknown)(...args) as never,
}))

function installSocketMock(): void {
  sockets.instances.length = 0
  sockets.last = null
  sockets.io = () => {
    const handlers = new Map<string, (payload: unknown) => void>()
    const instance = {
      handlers,
      emitted: [] as Array<{ event: string; payload: unknown }>,
      removed: false,
      disconnected: false,
      on(event: string, listener: (payload: unknown) => void) {
        handlers.set(event, listener)
        // socket.io auto-emits `connect` after a successful handshake; fire it
        // eagerly in registration order so `session:join` is emitted like the
        // real client does.
        if (event === 'connect') listener(undefined)
        return instance
      },
      emit(event: string, payload?: unknown) {
        instance.emitted.push({ event, payload })
        return instance
      },
      removeAllListeners() {
        instance.removed = true
        handlers.clear()
        return instance
      },
      disconnect() {
        instance.disconnected = true
        return instance
      },
    }
    sockets.instances.push(instance)
    sockets.last = instance
    return instance
  }
}

const emitToSocket = (event: string, payload: unknown) => {
  const handler = sockets.last?.handlers.get(event)
  if (!handler) throw new Error(`No handler registered for ${event}`)
  handler(payload)
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const geofenceConfig = {
  latitude: 14.8697,
  longitude: 120.9991,
  radiusMeters: 50,
}

const session: Session = {
  id: 'session-1',
  sectionId: 'section-1',
  subjectName: 'Software Engineering',
  mode: 'in_person',
  date: '2026-08-06',
  startTime: '08:00',
  endTime: '10:00',
  qrValidityMinutes: 10,
  gracePeriodMinutes: 15,
  geofence: geofenceConfig,
  isActive: true,
  qrToken: 'token-0',
  teacherId: 'teacher-1',
  createdAt: '2026-08-01T00:00:00.000Z',
}

const student = {
  id: 'student-1',
  fullName: 'Mary Kay Santos',
  studentId: '2021-00042-MN-0',
  role: 'student' as const,
  program: 'BSIT',
  yearLevel: 3,
  enrolledSectionIds: ['section-1'],
  isActive: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
} satisfies Student

function attemptFixture(overrides: Partial<ScanAttemptView> = {}): ScanAttemptView {
  return {
    id: 'attempt-1',
    sessionId: 'session-1',
    studentId: 'student-1',
    studentName: 'Mary Kay Santos',
    studentNumber: '2021-00042-MN-0',
    timestamp: '2026-08-06T08:01:00.000Z',
    receivedAt: '2026-08-06T08:01:01.000Z',
    coordinates: { latitude: 14.87, longitude: 120.9991 },
    distanceMeters: 34,
    geofenceRadiusMeters: 50,
    outcome: 'accepted',
    denialReason: null,
    mocked: false,
    pinVerified: null,
    offline: false,
    inputChannel: 'camera',
    checkpoint: null,
    deviceIdMasked: 'mobile-…9f2a',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  geofenceMock.propsList.length = 0
  installSocketMock()
  apiMock.getScanAttempts.mockResolvedValue([attemptFixture()])
  document.body.innerHTML = ''
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

// ── Pure shaping unit tests ──────────────────────────────────────────────────

describe('radar shaping helpers', () => {
  it('builds the exact distance copy variants from the plan', () => {
    expect(
      radarDistanceCopy({ studentNumber: '2021-00042-MN-0', distanceMeters: 124, denied: true, outsideMeters: 74 }),
    ).toBe('2021-00042-MN-0: 124m away · 74m outside geofence')
    expect(
      radarDistanceCopy({ studentNumber: '2021-00042-MN-0', distanceMeters: 21, denied: false }),
    ).toBe('2021-00042-MN-0: 21m inside geofence')
    expect(radarDistanceCopy({ studentNumber: '  ', distanceMeters: null, denied: false })).toBe(
      'Unknown: verified · no distance telemetry',
    )
  })

  it('keeps one pin per student (latest attempt wins) and counts every denial', () => {
    const older = attemptFixture({ id: 'a-1', outcome: 'denied', distanceMeters: 200, timestamp: '2026-08-06T07:59:00.000Z' })
    const newer = attemptFixture({ id: 'a-2', outcome: 'accepted', distanceMeters: 21, timestamp: '2026-08-06T08:01:00.000Z' })
    const data = shapeRadarData(geofenceConfig, [older, newer], [], [student])

    expect(data.pins).toHaveLength(1)
    expect(data.pins[0]).toMatchObject({ key: 'attempt:a-2', denied: false, distanceMeters: 21 })
    expect(data.insideCount).toBe(1)
    expect(data.deniedCount).toBe(1)
  })

  it('computes distances server-side variants: stored value preferred, haversine fallback', () => {
    const noStored = attemptFixture({ distanceMeters: null, coordinates: { latitude: 14.87, longitude: 120.9991 } })
    const data = shapeRadarData(geofenceConfig, [noStored], [], [student])
    expect(data.pins[0].distanceMeters).not.toBeNull()
    expect(data.pins[0].distanceMeters).toBeGreaterThan(0)
    // 14.87 is ~34m north of 14.8697 — inside the 50m radius, so not denied.
    expect(data.pins[0].denied).toBe(false)
  })

  it('sends denied attempts outside the radius to the popup with outside arithmetic', () => {
    const denied = attemptFixture({ outcome: 'denied', distanceMeters: 124, geofenceRadiusMeters: 50 })
    const data = shapeRadarData(geofenceConfig, [denied], [], [student])
    expect(data.pins[0]).toMatchObject({ denied: true, outsideMeters: 74 })
  })

  it('falls back to roster-accepted records for students without attempts and lists no-GPS students', () => {
    const manualRecord: AttendanceRecord = {
      id: 'record-1',
      sessionId: 'session-1',
      sectionId: 'section-1',
      studentId: 'student-2',
      studentName: 'Juan Dela Cruz',
      timestamp: '2026-08-06T08:02:00.000Z',
      status: 'present',
      coordinates: { latitude: 14.8697, longitude: 120.9991 },
      isSynced: true,
      deviceId: 'manual',
    }
    const noGpsAttempt = attemptFixture({ id: 'a-3', studentId: 'student-3', studentName: 'No Fix Mate', coordinates: { latitude: null, longitude: null }, distanceMeters: null })
    const data = shapeRadarData(geofenceConfig, [noGpsAttempt], [manualRecord], [student])

    // Coordinate-less attempts are never pinned — the roster record is the
    // only pin here; the no-GPS attempt lands in the side legend.
    expect(data.pins).toHaveLength(1)
    expect(data.pins[0]).toMatchObject({ key: 'record:record-1', source: 'record', denied: false })
    expect(data.insideCount).toBe(1)
    expect(data.noGps).toHaveLength(1)
    expect(data.noGps[0]).toMatchObject({ studentName: 'No Fix Mate', denied: false, key: 'attempt:a-3' })
  })
})

// ── Modal integration ────────────────────────────────────────────────────────

describe('GeofenceRadarModal', () => {
  it('loads attempts on open, renders pins, counters, and the exact denied popup copy', async () => {
    const denied = attemptFixture({
      id: 'attempt-denied',
      studentId: 'student-9',
      studentName: 'Pepe Halfpenny',
      studentNumber: '2021-00095-MN-0',
      coordinates: { latitude: 14.8689, longitude: 120.9989 },
      outcome: 'denied',
      denialReason: 'outside_geofence',
      distanceMeters: 124,
      geofenceRadiusMeters: 50,
      inputChannel: 'image',
    })
    apiMock.getScanAttempts.mockResolvedValue([attemptFixture(), denied])

    render(
      <GeofenceRadarModalDefault open onOpenChange={() => undefined} session={session} records={[]} students={[student]} />,
    )
    await flush()

    expect(apiMock.getScanAttempts).toHaveBeenCalledWith('session-1')
    expect(screen.getByTestId('radar-counters')).toHaveTextContent('Inside: 1')
    expect(screen.getByTestId('radar-counters')).toHaveTextContent('Denied: 1')

    // Radix portals dialog content into document.body — query globally.
    const pins = document.body.querySelectorAll('[data-testid="radar-pin"]')
    expect(pins).toHaveLength(2)
    expect(pins[0]).toHaveAttribute('data-denied', 'false')
    expect(pins[1]).toHaveAttribute('data-denied', 'true')

    const copies = screen.getAllByTestId('radar-distance-copy')
    expect(copies[0]).toHaveTextContent('2021-00042-MN-0: 34m inside geofence')
    expect(copies[1]).toHaveTextContent('2021-00095-MN-0: 124m away · 74m outside geofence')
    const popup = copies[1].closest('[data-testid="marker-popup"]')
    expect(popup).toHaveTextContent('Denied: outside geofence')
    expect(popup).toHaveTextContent('screenshot')

    // Geofence perimeter rendered from the session config (the mock records
    // per re-render; identity matters, not push count).
    expect(geofenceMock.propsList).toContainEqual(geofenceConfig)
  })

  it('shows active-only denied error state with retry wiring', async () => {
    apiMock.getScanAttempts.mockRejectedValue(new Error('Forensics offline'))
    const { rerender } = render(
      <GeofenceRadarModalDefault open onOpenChange={() => undefined} session={session} records={[]} students={[student]} />,
    )
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Forensics offline')
    apiMock.getScanAttempts.mockResolvedValue([])
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    rerender(
      <GeofenceRadarModalDefault open onOpenChange={() => undefined} session={session} records={[]} students={[student]} />,
    )
    await screen.findByText('No verified pins yet')
  })

  it('renders the RA 10173 notice for online sessions (no geofence)', async () => {
    render(
      <GeofenceRadarModalDefault
        open
        onOpenChange={() => undefined}
        session={{ ...session, mode: 'online', geofence: undefined }}
        records={[]}
        students={[student]}
      />,
    )
    await flush()
    expect(screen.getByText('Online session · No geofence')).toBeInTheDocument()
    expect(screen.getByText(/RA 10173 data minimization/)).toBeInTheDocument()
  })

  it('joins the session room, refetches on attendance:updated, and plots anomaly pins live', async () => {
    render(
      <GeofenceRadarModalDefault open onOpenChange={() => undefined} session={session} records={[]} students={[student]} />,
    )
    await flush()
    expect(apiMock.getScanAttempts).toHaveBeenCalledTimes(1)
    expect(sockets.last?.emitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'session:join', payload: { sessionId: 'session-1' } }),
      ]),
    )

    const anomaly: AttendanceAnomalyEvent = {
      sessionId: 'session-1',
      studentId: 'student-5',
      studentName: 'Lola Teleport',
      studentNumber: '2021-00077-MN-0',
      latitude: 14.8680,
      longitude: 120.9985,
      distanceMeters: 210,
      geofenceRadiusMeters: 50,
      reason: 'outside_geofence',
      timestamp: '2026-08-06T08:05:30.000Z',
    }
    await act(async () => {
      emitToSocket(ATTENDANCE_ANOMALY_EVENT, anomaly)
      await Promise.resolve()
    })

    expect(screen.getByTestId('radar-counters')).toHaveTextContent('Denied: 1')
    const deniedCopy = screen.getAllByTestId('radar-distance-copy')
    expect(deniedCopy).toHaveLength(2)
    expect(deniedCopy[1]).toHaveTextContent('2021-00077-MN-0: 210m away · 160m outside geofence')

    const before = apiMock.getScanAttempts.mock.calls.length
    await act(async () => {
      emitToSocket('attendance:updated', { sessionId: 'session-1', studentId: 'student-1' })
      await Promise.resolve()
    })
    expect(apiMock.getScanAttempts.mock.calls.length).toBeGreaterThan(before)
    expect(sockets.last?.emitted.filter((e) => e.event === 'attendance:updated' ? false : e.event === 'session:leave')).toEqual([])

    // leave + disconnect on unmount
    cleanup()
    expect(sockets.last?.disconnected).toBe(true)
    expect(sockets.last?.removed).toBe(true)
    expect(sockets.last?.emitted.some((e) => e.event === 'session:leave')).toBe(true)
  })

  it('lists live coordinate-less anomalies in the side legend without a pin', async () => {
    render(
      <GeofenceRadarModalDefault open onOpenChange={() => undefined} session={session} records={[]} students={[student]} />,
    )
    await flush()
    await act(async () => {
      emitToSocket(ATTENDANCE_ANOMALY_EVENT, {
        sessionId: 'session-1',
        studentId: 'student-6',
        studentName: 'Broken GPS',
        latitude: null,
        longitude: null,
        distanceMeters: null,
        reason: 'emulator_detected',
        timestamp: '2026-08-06T08:06:00.000Z',
      })
      await Promise.resolve()
    })

    const entries = screen.getAllByTestId('radar-nogps-entry')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toHaveTextContent('Broken GPS')
    expect(entries[0]).toHaveTextContent('emulator detected')
    expect(screen.getByTestId('radar-counters')).toHaveTextContent('Denied: 1')
  })
})

// Wrapper import placed below mocks (module graph trick used across this suite).
import GeofenceRadarModalDefault from './GeofenceRadarModal'

void mapMock
