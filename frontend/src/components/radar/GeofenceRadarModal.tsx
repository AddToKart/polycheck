'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { Radar, RefreshCw, Loader2, LocateFixed, Ban, Users } from 'lucide-react'
import {
  ATTENDANCE_ANOMALY_EVENT,
  haversineDistance,
  type AttendanceAnomalyEvent,
  type AttendanceRecord,
  type GeofenceConfig,
  type ScanAttemptView,
  type Session,
  type Student,
} from '@polycheck/shared'
import {
  Map as RadarMap,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  useMap,
} from '@/components/ui/map'
import GeofenceCircle from '@/components/GeofenceCircle'
import { pupSantaMaria, type CampusConfig } from '@polycheck/shared/map'
import { pupColors } from '@/lib/colors'
import { API_BASE } from '@/lib/api-config'
import { api } from '@/lib/api-client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ── Pure shaping (unit-tested) ───────────────────────────────────────────────

export interface RadarPin {
  key: string
  studentId: string
  studentName: string
  studentNumber: string
  latitude: number
  longitude: number
  distanceMeters: number | null
  outsideMeters: number | null
  denied: boolean
  reason?: string | null
  timestamp: string
  channel?: string | null
  checkpoint?: string | null
  source: 'attempt' | 'record' | 'anomaly'
}

export interface RadarNoGpsEntry {
  key: string
  studentId: string
  studentName: string
  studentNumber: string
  denied: boolean
  reason?: string | null
}

export interface RadarData {
  pins: RadarPin[]
  noGps: RadarNoGpsEntry[]
  insideCount: number
  deniedCount: number
}

/** Attendance statuses whose coordinates represent a live/accepted check-in. */
const ACCEPTED_RECORD_STATUSES = new Set(['present', 'late', 'incomplete', 'pending'])

/** The exact popup copy demanded by the plan: numbers, `m`, and the separator. */
export function radarDistanceCopy(options: {
  studentNumber: string
  distanceMeters: number | null
  denied: boolean
  outsideMeters?: number | null
}): string {
  const who = options.studentNumber.trim() || 'Unknown'
  if (options.distanceMeters === null || !Number.isFinite(options.distanceMeters)) {
    return `${who}: verified · no distance telemetry`
  }
  if (options.denied) {
    const outside = Math.max(0, Math.round(options.outsideMeters ?? 0))
    return `${who}: ${options.distanceMeters}m away · ${outside}m outside geofence`
  }
  return `${who}: ${options.distanceMeters}m inside geofence`
}

function resolveDistance(
  geofence: GeofenceConfig | undefined,
  latitude: number,
  longitude: number,
  stored: number | null | undefined,
): number | null {
  if (typeof stored === 'number' && Number.isFinite(stored)) return Math.round(stored)
  if (!geofence) return null
  return Math.round(haversineDistance(latitude, longitude, geofence.latitude, geofence.longitude))
}

function plotable(latitude: number | null, longitude: number | null) {
  // Manual pins default to (0, 0) — that is the Gulf of Guinea, not a
  // classroom. Never plot the empty default.
  if (latitude === null || longitude === null) return null
  if (latitude === 0 && longitude === 0) return null
  return { latitude, longitude }
}

/**
 * Merges stored scan attempts, the cockpit's roster records, and live anomaly
 * events into pins + a no-GPS side legend. One pin per student — the latest
 * event wins (anomalies are newest by definition) — while the denied counter
 * counts every denial attempt, so a retried cheat is visible in the number.
 */
export function shapeRadarData(
  geofence: GeofenceConfig | undefined,
  attempts: ScanAttemptView[],
  records: AttendanceRecord[],
  students: Student[],
  anomalies: AttendanceAnomalyEvent[] = [],
): RadarData {
  const numberFor = (studentId: string, explicit?: string | null): string => {
    if (typeof explicit === 'string' && explicit.trim()) return explicit.trim()
    return students.find((student) => student.id === studentId)?.studentId ?? ''
  }

  const latestPerStudent = new Map<string, ScanAttemptView>()
  for (const attempt of attempts) {
    const existing = latestPerStudent.get(attempt.studentId)
    if (!existing || new Date(attempt.timestamp).getTime() >= new Date(existing.timestamp).getTime()) {
      latestPerStudent.set(attempt.studentId, attempt)
    }
  }

  const pins: RadarPin[] = []
  const noGps: RadarNoGpsEntry[] = []
  const coveredStudents = new Set<string>()

  let deniedCount = 0
  for (const attempt of attempts) {
    if (attempt.outcome === 'denied') deniedCount += 1
  }

  for (const [studentId, latest] of latestPerStudent) {
    coveredStudents.add(studentId)
    const coords = plotable(latest.coordinates?.latitude ?? null, latest.coordinates?.longitude ?? null)
    const denied = latest.outcome === 'denied'
    if (!coords) {
      noGps.push({
        key: `attempt:${latest.id}`,
        studentId,
        studentName: latest.studentName,
        studentNumber: numberFor(studentId, latest.studentNumber),
        denied,
        reason: latest.denialReason ?? null,
      })
      continue
    }
    const distance = resolveDistance(geofence, coords.latitude, coords.longitude, latest.distanceMeters)
    pins.push({
      key: `attempt:${latest.id}`,
      studentId,
      studentName: latest.studentName,
      studentNumber: numberFor(studentId, latest.studentNumber),
      latitude: coords.latitude,
      longitude: coords.longitude,
      distanceMeters: distance,
      outsideMeters: denied && distance !== null && geofence ? Math.max(0, distance - geofence.radiusMeters) : null,
      denied,
      reason: latest.denialReason ?? null,
      timestamp: latest.timestamp,
      channel: latest.inputChannel ?? null,
      checkpoint: latest.checkpoint ?? null,
      source: 'attempt',
    })
  }

  // Roster fallback: manual overrides / offline rows that never became an
  // attempt for this student still carry classroom geometry — plot them.
  for (const record of records) {
    if (coveredStudents.has(record.studentId)) continue
    if (!ACCEPTED_RECORD_STATUSES.has(record.status)) continue
    const coords = plotable(
      record.coordinates?.latitude ?? null,
      record.coordinates?.longitude ?? null,
    )
    if (!coords) continue
    coveredStudents.add(record.studentId)
    const distance = resolveDistance(geofence, coords.latitude, coords.longitude, null)
    pins.push({
      key: `record:${record.id}`,
      studentId: record.studentId,
      studentName: record.studentName,
      studentNumber: students.find((student) => student.id === record.studentId)?.studentId ?? '',
      latitude: coords.latitude,
      longitude: coords.longitude,
      distanceMeters: distance,
      outsideMeters: null,
      denied: false,
      reason: null,
      timestamp: record.timestamp,
      channel: 'manual',
      checkpoint: null,
      source: 'record',
    })
  }

  // Live denials arrive while the modal is open — they are the newest truth
  // for that student, so their pin wins.
  anomalies.forEach((anomaly, index) => {
    deniedCount += 1
    const studentNumber = numberFor(anomaly.studentId, anomaly.studentNumber)
    const coords = plotable(anomaly.latitude ?? null, anomaly.longitude ?? null)
    if (!coords) {
      noGps.push({
        key: `anomaly:${index}`,
        studentId: anomaly.studentId,
        studentName: anomaly.studentName ?? studentNumber,
        studentNumber,
        denied: true,
        reason: anomaly.reason,
      })
      return
    }
    const distance = resolveDistance(geofence, coords.latitude, coords.longitude, anomaly.distanceMeters)
    pins.push({
      key: `anomaly:${anomaly.studentId}:${index}`,
      studentId: anomaly.studentId,
      studentName: anomaly.studentName ?? studentNumber,
      studentNumber,
      latitude: coords.latitude,
      longitude: coords.longitude,
      distanceMeters: distance,
      outsideMeters: distance !== null && geofence ? Math.max(0, distance - geofence.radiusMeters) : null,
      denied: true,
      reason: anomaly.reason,
      timestamp: anomaly.timestamp,
      channel: null,
      checkpoint: null,
      source: 'anomaly',
    })
  })

  return {
    pins,
    noGps,
    insideCount: pins.filter((pin) => !pin.denied).length,
    deniedCount,
  }
}

// ── Live session-room socket (mirrors lib/realtime.ts's subscribeToSession —
// safe to replicate here because realtime.ts is outside this task's ownership
// and the helper there has no anomaly wiring). ───────────────────────────────

function realtimeRoomOrigin(): string {
  if (API_BASE.startsWith('/')) return `${window.location.origin}/attendance`
  return `${new URL(API_BASE).origin}/attendance`
}

interface RadarSocketHandlers {
  onCheckIn: () => void
  onAnomaly: (event: AttendanceAnomalyEvent) => void
  onConnectionChange?: (connected: boolean) => void
}

export function createRadarSocket(sessionId: string, handlers: RadarSocketHandlers): () => void {
  if (typeof window === 'undefined') return () => undefined
  const socket: Socket = io(realtimeRoomOrigin(), {
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1_000,
    timeout: 8_000,
    transports: ['websocket'],
  })

  socket.on('connect', () => {
    // A transport connect is not the room join; wait for session:joined.
    handlers.onConnectionChange?.(false)
    socket.emit('session:join', { sessionId })
  })
  socket.on('session:joined', (payload: { sessionId?: string }) => {
    if (payload?.sessionId === sessionId) handlers.onConnectionChange?.(true)
  })
  socket.on('disconnect', () => handlers.onConnectionChange?.(false))
  socket.on('connect_error', () => handlers.onConnectionChange?.(false))
  socket.on('attendance:updated', () => handlers.onCheckIn())
  socket.on(ATTENDANCE_ANOMALY_EVENT, (event: AttendanceAnomalyEvent) => {
    if (event?.sessionId === sessionId) handlers.onAnomaly(event)
  })

  return () => {
    socket.emit('session:leave', { sessionId })
    socket.removeAllListeners()
    socket.disconnect()
  }
}

// ── Campus buildings layer — the same source/layer painting recipe as
// CampusMap's internal CampusBuildingsLayer (module-private there; re-declared
// here because that file is outside this task's ownership) ───────────────────

function RadarCampusLayer({ campus }: { campus: CampusConfig }) {
  const { map, isLoaded } = useMap()
  const id = useId()
  const polygonSourceId = `radar-polygons-${id}`
  const labelSourceId = `radar-labels-${id}`
  const fillLayerId = `radar-fill-${id}`
  const outlineLayerId = `radar-outline-${id}`
  const labelLayerId = `radar-labels-layer-${id}`

  const polygonGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Polygon> = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: campus.buildings.map((building) => ({
        type: 'Feature',
        properties: { name: building.name, abbr: building.abbreviation },
        geometry: { type: 'Polygon', coordinates: [building.polygon] },
      })),
    }),
    [campus],
  )

  useEffect(() => {
    if (!isLoaded || !map) return

    const labelGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: 'FeatureCollection',
      features: campus.buildings.map((building) => ({
        type: 'Feature',
        properties: { abbr: building.abbreviation },
        geometry: { type: 'Point', coordinates: building.center },
      })),
    }

    map.addSource(polygonSourceId, { type: 'geojson', data: polygonGeoJSON })
    map.addSource(labelSourceId, { type: 'geojson', data: labelGeoJSON })

    map.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: polygonSourceId,
      paint: {
        'fill-color': pupColors.maroon,
        'fill-opacity': 0.08,
      },
    })

    map.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: polygonSourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': pupColors.maroon,
        'line-width': 1.5,
        'line-opacity': 0.4,
      },
    })

    map.addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: labelSourceId,
      layout: {
        'text-field': ['get', 'abbr'],
        'text-font': ['Open Sans Semibold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 11,
        'text-offset': [0, -1.2],
        'text-anchor': 'bottom',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': pupColors.maroon,
        'text-halo-color': pupColors.white,
        'text-halo-width': 2,
        'text-opacity': 0.85,
      },
    })

    return () => {
      try {
        if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId)
        if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId)
        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId)
        if (map.getSource(labelSourceId)) map.removeSource(labelSourceId)
        if (map.getSource(polygonSourceId)) map.removeSource(polygonSourceId)
      } catch {
        /* the map outlived the layer teardown */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, map, polygonSourceId, labelSourceId, fillLayerId, outlineLayerId, labelLayerId, polygonGeoJSON])

  return null
}

// ── Modal chrome ────────────────────────────────────────────────────────────

function humanizeReason(reason?: string | null): string | null {
  if (!reason) return null
  return reason.replaceAll('_', ' ')
}

function channelLabel(channel?: string | null): string | null {
  if (!channel) return null
  return channel === 'image' ? 'screenshot' : channel
}

export interface GeofenceRadarModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: Session
  records: AttendanceRecord[]
  students: Student[]
}

export default function GeofenceRadarModal({
  open,
  onOpenChange,
  session,
  records,
  students,
}: GeofenceRadarModalProps) {
  const [attempts, setAttempts] = useState<ScanAttemptView[]>([])
  const [anomalies, setAnomalies] = useState<AttendanceAnomalyEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadEpochRef = useRef(0)

  const loadAttempts = useCallback(async () => {
    const epoch = ++loadEpochRef.current
    setLoading(true)
    setError(null)
    try {
      const recentAttempts = await api.getScanAttempts(session.id)
      if (epoch === loadEpochRef.current) setAttempts(recentAttempts)
    } catch (caught) {
      if (epoch === loadEpochRef.current) {
        setError(caught instanceof Error ? caught.message : 'Radar data unavailable')
      }
    } finally {
      if (epoch === loadEpochRef.current) setLoading(false)
    }
  }, [session.id])

  useEffect(() => {
    if (!open) return
    // Opening fresh: past this-open anomalies are already stored server-side
    // and will be refetched, so do not double-count them.
    setAnomalies([])
    void loadAttempts()
    return createRadarSocket(session.id, {
      onCheckIn: () => void loadAttempts(),
      onAnomaly: (event) => setAnomalies((previous) => [...previous.slice(-19), event]),
    })
  }, [open, session.id, loadAttempts])

  const data = useMemo(
    () => shapeRadarData(session.geofence, attempts, records, students, anomalies),
    [session.geofence, attempts, records, students, anomalies],
  )
  const geofence = session.geofence

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[92vh] w-[92vw] max-w-[1080px] flex-col overflow-hidden border-golden/30 bg-maroon-dark p-0 text-white"
        aria-describedby="radar-modal-desc"
      >
        <DialogHeader className="mb-0 flex-row flex-wrap items-center justify-between gap-2 border-b border-golden/25 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Radar className="h-5 w-5 shrink-0 text-golden" aria-hidden="true" />
            <DialogTitle className="font-heading truncate text-lg font-bold text-white">
              Live geofence radar
            </DialogTitle>
            <p id="radar-modal-desc" className="sr-only">
              Verification map for {session.subjectName} — accepted check-ins pulse inside the
              geofence, denied attempts blink outside it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-golden" aria-hidden="true" /> : null}
            <p
              data-testid="radar-counters"
              aria-live="polite"
              aria-atomic="true"
              className="text-sm font-bold text-white tabular-nums"
            >
              Inside: {data.insideCount} <span className="mx-1 text-golden">·</span> Denied:{' '}
              {data.deniedCount}
            </p>
            <button
              type="button"
              onClick={() => void loadAttempts()}
              className="inline-flex h-9 min-h-9 w-9 items-center justify-center p-1 hover:opacity-70"
              aria-label="Refresh radar data"
            >
              <RefreshCw className="h-4 w-4 text-golden" />
            </button>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-3 p-4 md:grid-cols-[1fr_15rem]">
          <div className="relative min-h-[240px] overflow-hidden rounded border border-golden/25">
            {error ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center" role="alert">
                <p className="text-xs font-bold uppercase tracking-widest text-golden">Radar unavailable</p>
                <p className="text-xs text-zinc-300">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadAttempts()}
                  className="mt-1 inline-flex items-center gap-1.5 border border-golden/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-golden hover:bg-golden/10"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            ) : !geofence ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <Ban className="h-6 w-6 text-golden" aria-hidden="true" />
                <p className="text-xs font-bold uppercase tracking-widest text-golden">
                  Online session · No geofence
                </p>
                <p className="max-w-sm text-xs text-zinc-300">
                  Location is not collected for online sessions (RA 10173 data minimization), so
                  there is no geometry to plot. Denied checkpoints still surface on the roster.
                </p>
              </div>
            ) : (
              <RadarMap
                center={[geofence.longitude, geofence.latitude]}
                zoom={17}
                className="h-full w-full"
              >
                <RadarCampusLayer campus={pupSantaMaria} />
                <GeofenceCircle
                  latitude={geofence.latitude}
                  longitude={geofence.longitude}
                  radiusMeters={geofence.radiusMeters}
                />
                {data.pins.map((pin) => (
                  <MapMarker key={pin.key} latitude={pin.latitude} longitude={pin.longitude}>
                    <MarkerContent>
                      {pin.denied ? (
                        <span
                          data-testid="radar-pin"
                          data-denied="true"
                          className="relative block h-4 w-4"
                        >
                          <span
                            aria-hidden="true"
                            className="h-4 w-4 animate-[radar-blink_1.1s_ease-in-out_infinite] rounded-full border-2 border-red-300 bg-red-500 shadow-lg ring-2 ring-red-600/40 motion-reduce:animate-none motion-reduce:ring-4"
                          />
                        </span>
                      ) : (
                        <span
                          data-testid="radar-pin"
                          data-denied="false"
                          className="relative flex h-4 w-4"
                        >
                          <span
                            aria-hidden="true"
                            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60 motion-reduce:hidden"
                          />
                          <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-green-500 shadow-lg" />
                        </span>
                      )}
                    </MarkerContent>
                    <MarkerPopup closeButton>
                      <div className="min-w-[190px]">
                        <p className="text-sm font-bold text-maroon-dark dark:text-white">
                          {pin.studentName}
                        </p>
                        <p
                          data-testid="radar-distance-copy"
                          className="text-[11px] font-semibold text-zinc-700 tabular-nums dark:text-zinc-200"
                        >
                          {radarDistanceCopy({
                            studentNumber: pin.studentNumber,
                            distanceMeters: pin.distanceMeters,
                            denied: pin.denied,
                            outsideMeters: pin.outsideMeters,
                          })}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <span>
                            {new Date(pin.timestamp).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                          {channelLabel(pin.channel) ? (
                            <span className="border border-zinc-300 px-1 dark:border-zinc-700">
                              {channelLabel(pin.channel)}
                            </span>
                          ) : null}
                          {pin.checkpoint ? (
                            <span className="border border-zinc-300 px-1 dark:border-zinc-700">
                              {pin.checkpoint}
                            </span>
                          ) : null}
                        </div>
                        {pin.denied ? (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                            Denied{humanizeReason(pin.reason) ? `: ${humanizeReason(pin.reason)}` : ''}
                          </p>
                        ) : null}
                      </div>
                    </MarkerPopup>
                  </MapMarker>
                ))}
                {data.pins.length === 0 && !loading ? (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 border border-golden/40 bg-maroon-dark/80 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-golden"
                  >
                    No verified pins yet
                  </span>
                ) : null}
              </RadarMap>
            )}

            {/* Legend */}
            <div className="absolute bottom-2 left-2 z-[5] flex flex-wrap items-center gap-3 border border-golden/25 bg-maroon-dark/90 px-2.5 py-1.5 text-[10px] font-semibold text-white">
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />
                Verified
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-red-300 bg-red-500" />
                Denied
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-zinc-300 bg-zinc-400" />
                No GPS
              </span>
            </div>
          </div>

          <aside
            data-testid="radar-nogps-list"
            aria-label="Students without check-in coordinates"
            className="flex min-h-0 flex-col overflow-y-auto border border-golden/25 bg-maroon p-3"
          >
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-golden">
              <Users className="h-3.5 w-3.5" aria-hidden="true" /> Without coordinates ({data.noGps.length})
            </p>
            {data.noGps.length === 0 ? (
              <p className="mt-2 text-[11px] text-zinc-300">Every tracked attempt carried coordinates.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {data.noGps.map((entry) => (
                  <li
                    key={entry.key}
                    data-testid="radar-nogps-entry"
                    className={`border-l-4 px-2 py-1.5 ${entry.denied ? 'border-red-500' : 'border-zinc-400'}`}
                  >
                    <p className="text-xs font-semibold text-white">{entry.studentName}</p>
                    <p className="text-[10px] text-zinc-300 tabular-nums">
                      {entry.studentNumber || entry.studentId}
                      {entry.denied ? ' · denied' : ' · accepted'}
                    </p>
                    {entry.denied && humanizeReason(entry.reason) ? (
                      <p className="text-[10px] font-semibold text-red-300">{humanizeReason(entry.reason)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-auto flex items-center gap-1.5 pt-3 text-[10px] text-zinc-400">
              <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" /> Manual pins and offline
              check-ins without GPS are listed here instead of the map.
            </p>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}

