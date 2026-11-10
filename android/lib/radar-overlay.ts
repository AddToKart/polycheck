import { haversineDistance } from '@polycheck/shared'
import type {
  AttendanceAnomalyEvent,
  AttendanceRecord,
  AttendanceStatus,
  FinaleCountStatus,
  ScanAttemptView,
  SessionFinaleSummary,
} from '@polycheck/shared'
import type { StudentMapPin } from '../components/MapView'

/**
 * F2 (WF-LD4) — live geofence radar shaping for the Android session cockpit.
 *
 * Pure data layer: merges stored scan attempts (`GET /attendance/attempts`),
 * the cockpit's roster records, and live `attendance:anomaly` events into
 * (a) pins for the existing Leaflet-WebView map and (b) a denied-attempt log
 * with the exact forensic distance copy. Mirrors the web radar modal's
 * shaping (`frontend/src/components/radar/GeofenceRadarModal.tsx`) so both
 * platforms tell the same story from the same server truth.
 */

export interface RadarGeofence {
  latitude: number
  longitude: number
  radiusMeters: number
}

export interface RadarDeniedEntry {
  key: string
  studentId: string
  studentName: string
  studentNumber: string
  distanceMeters: number | null
  outsideMeters: number | null
  /** `<studentNumber>: 124m away · 74m outside geofence` */
  copy: string
  reason: string | null
  timestamp: string
  source: 'attempt' | 'anomaly'
}

export interface RadarNoGpsEntry {
  key: string
  studentId: string
  studentName: string
  studentNumber: string
  denied: boolean
  reason: string | null
}

export interface RadarOverlayData {
  /** Record pins (status-coloured, existing behaviour) + red denied pins. */
  mapPins: StudentMapPin[]
  /** Records with plotable coordinates — the "N locations" detail count. */
  recordPinCount: number
  /** Every denial (attempts + live anomalies), newest last. */
  deniedLog: RadarDeniedEntry[]
  /** Attempts/anomalies without a usable fix — compact legend list. */
  noGps: RadarNoGpsEntry[]
  /** Unique students verified inside the geofence. */
  insideCount: number
  /** Every denial event — a retried cheat is visible in the number. */
  deniedCount: number
}

/** Attendance statuses whose coordinates represent a live/accepted check-in. */
const ACCEPTED_RECORD_STATUSES = new Set<AttendanceStatus>([
  'present',
  'late',
  'incomplete',
  'pending',
])

/**
 * The distance fragment demanded by the plan: numbers, `m`, and the separator.
 * Denied: `124m away · 74m outside geofence`. Inside: `21m inside geofence`.
 */
export function radarDistanceFragment(options: {
  distanceMeters: number | null
  denied: boolean
  outsideMeters?: number | null
}): string {
  if (options.distanceMeters === null || !Number.isFinite(options.distanceMeters)) {
    return 'verified · no distance telemetry'
  }
  if (options.denied) {
    const outside = Math.max(0, Math.round(options.outsideMeters ?? 0))
    return `${options.distanceMeters}m away · ${outside}m outside geofence`
  }
  return `${options.distanceMeters}m inside geofence`
}

/** The exact popup/list copy: `<studentNumber>: <fragment>`. */
export function radarDistanceCopy(options: {
  studentNumber: string
  distanceMeters: number | null
  denied: boolean
  outsideMeters?: number | null
}): string {
  const who = options.studentNumber.trim() || 'Unknown'
  return `${who}: ${radarDistanceFragment(options)}`
}

/** Stored `distanceMeters` preferred; shared Haversine fallback; else null. */
export function resolveRadarDistance(
  geofence: RadarGeofence | null | undefined,
  latitude: number,
  longitude: number,
  stored: number | null | undefined,
): number | null {
  if (typeof stored === 'number' && Number.isFinite(stored)) return Math.round(stored)
  if (!geofence) return null
  return Math.round(haversineDistance(latitude, longitude, geofence.latitude, geofence.longitude))
}

/**
 * Manual pins default to (0, 0) — that is the Gulf of Guinea, not a
 * classroom. Never plot the empty default.
 */
export function plotableCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): { latitude: number; longitude: number } | null {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null
  if (latitude === 0 && longitude === 0) return null
  return { latitude, longitude }
}

interface StudentNumberSource {
  id: string
  studentId: string
}

function numberFor(
  students: Array<Pick<StudentNumberSource, 'id' | 'studentId'>>,
  studentId: string,
  explicit?: string | null,
): string {
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim()
  return students.find((student) => student.id === studentId)?.studentId ?? ''
}

/**
 * Merges stored scan attempts, roster records, and live anomaly events into
 * map pins + the denied log. Records keep their existing status-coloured pins
 * (strictly additive overlay); every denial becomes a red pin/log entry, so
 * the map shows both a student's accepted check-in and their rejected retry.
 */
export function shapeRadarOverlay(input: {
  geofence?: RadarGeofence | null
  attempts: ScanAttemptView[]
  records: AttendanceRecord[]
  students: Array<Pick<StudentNumberSource, 'id' | 'studentId'>>
  anomalies?: AttendanceAnomalyEvent[]
}): RadarOverlayData {
  const { geofence, attempts, records, students } = input
  const anomalies = input.anomalies ?? []

  const mapPins: StudentMapPin[] = []
  const deniedLog: RadarDeniedEntry[] = []
  const noGps: RadarNoGpsEntry[] = []
  const insideStudents = new Set<string>()
  let recordPinCount = 0
  let deniedCount = 0

  // Records first: the cockpit's existing pins keep their status colours and
  // their accepted check-ins count toward "Inside" exactly once per student.
  for (const record of records) {
    const coords = plotableCoordinates(record.coordinates?.latitude, record.coordinates?.longitude)
    if (!coords) continue
    recordPinCount += 1
    mapPins.push({
      id: record.studentId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      label: record.studentName,
      program: record.studentProgram,
      status: record.status,
      timestamp: record.timestamp,
      deviceId: record.deviceId,
    })
    if (ACCEPTED_RECORD_STATUSES.has(record.status)) insideStudents.add(record.studentId)
  }

  for (const attempt of attempts) {
    const studentNumber = numberFor(students, attempt.studentId, attempt.studentNumber)
    const coords = plotableCoordinates(attempt.coordinates?.latitude, attempt.coordinates?.longitude)
    if (attempt.outcome === 'denied') {
      deniedCount += 1
      const distance = coords
        ? resolveRadarDistance(geofence, coords.latitude, coords.longitude, attempt.distanceMeters)
        : null
      const outsideMeters =
        distance !== null && geofence ? Math.max(0, distance - geofence.radiusMeters) : null
      deniedLog.push({
        key: `attempt:${attempt.id}`,
        studentId: attempt.studentId,
        studentName: attempt.studentName,
        studentNumber,
        distanceMeters: distance,
        outsideMeters,
        copy: radarDistanceCopy({
          studentNumber,
          distanceMeters: distance,
          denied: true,
          outsideMeters,
        }),
        reason: attempt.denialReason ?? null,
        timestamp: attempt.timestamp,
        source: 'attempt',
      })
      if (coords) {
        mapPins.push({
          id: `attempt:${attempt.id}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
          label: attempt.studentName,
          program: radarDistanceFragment({ distanceMeters: distance, denied: true, outsideMeters }),
          status: 'absent',
          timestamp: attempt.timestamp,
        })
      } else {
        noGps.push({
          key: `attempt:${attempt.id}`,
          studentId: attempt.studentId,
          studentName: attempt.studentName,
          studentNumber,
          denied: true,
          reason: attempt.denialReason ?? null,
        })
      }
      continue
    }
    // Accepted/pending attempts are represented on the map by the student's
    // record pin; they only need to count toward "Inside" (or the no-GPS list).
    if (coords) insideStudents.add(attempt.studentId)
    else {
      noGps.push({
        key: `attempt:${attempt.id}`,
        studentId: attempt.studentId,
        studentName: attempt.studentName,
        studentNumber,
        denied: false,
        reason: attempt.denialReason ?? null,
      })
    }
  }

  // Live denials arrive while the cockpit is open — they are the newest truth
  // for that student, so their red pin/log entry lands instantly.
  anomalies.forEach((anomaly, index) => {
    deniedCount += 1
    const studentNumber = numberFor(students, anomaly.studentId, anomaly.studentNumber)
    const name = anomaly.studentName?.trim() || studentNumber || 'Unknown student'
    const coords = plotableCoordinates(anomaly.latitude, anomaly.longitude)
    const distance = coords
      ? resolveRadarDistance(geofence, coords.latitude, coords.longitude, anomaly.distanceMeters)
      : null
    const outsideMeters =
      distance !== null && geofence ? Math.max(0, distance - geofence.radiusMeters) : null
    deniedLog.push({
      key: `anomaly:${anomaly.studentId}:${index}`,
      studentId: anomaly.studentId,
      studentName: name,
      studentNumber,
      distanceMeters: distance,
      outsideMeters,
      copy: radarDistanceCopy({
        studentNumber,
        distanceMeters: distance,
        denied: true,
        outsideMeters,
      }),
      reason: anomaly.reason,
      timestamp: anomaly.timestamp,
      source: 'anomaly',
    })
    if (coords) {
      mapPins.push({
        id: `anomaly:${anomaly.studentId}:${index}`,
        latitude: coords.latitude,
        longitude: coords.longitude,
        label: name,
        program: radarDistanceFragment({ distanceMeters: distance, denied: true, outsideMeters }),
        status: 'absent',
        timestamp: anomaly.timestamp,
      })
    } else {
      noGps.push({
        key: `anomaly:${anomaly.studentId}:${index}`,
        studentId: anomaly.studentId,
        studentName: name,
        studentNumber,
        denied: true,
        reason: anomaly.reason,
      })
    }
  })

  return {
    mapPins,
    recordPinCount,
    deniedLog,
    noGps,
    insideCount: insideStudents.size,
    deniedCount,
  }
}

/** Header counter copy: `Inside: 30 · Denied: 2`. */
export function formatRadarCounters(insideCount: number, deniedCount: number): string {
  return `Inside: ${insideCount} · Denied: ${deniedCount}`
}

/**
 * Appends a live anomaly unless the exact event already landed (socket
 * replays must not duplicate a red entry).
 */
export function mergeAnomaly(
  anomalies: AttendanceAnomalyEvent[],
  event: AttendanceAnomalyEvent,
): AttendanceAnomalyEvent[] {
  const key = `${event.studentId}:${event.timestamp}:${event.reason}`
  return anomalies.some(
    (existing) => `${existing.studentId}:${existing.timestamp}:${existing.reason}` === key,
  )
    ? anomalies
    : [...anomalies, event]
}

/**
 * Attendance rate per the standing-evaluation policy (mirrors the kiosk
 * finale): numerator = present + late; denominator = present + late +
 * incomplete + absent; excused rows leave the denominator, and
 * pending/disputed rows stay out of the rate entirely.
 */
export function finaleAttendancePercent(counts: Record<FinaleCountStatus, number>): number | null {
  const present = counts.present ?? 0
  const late = counts.late ?? 0
  const incomplete = counts.incomplete ?? 0
  const absent = counts.absent ?? 0
  const denominator = present + late + incomplete + absent
  if (denominator <= 0) return null
  return Math.round(((present + late) / denominator) * 100)
}

export interface FinaleBannerModel {
  endedAt: string
  capacity: number
  counts: Record<FinaleCountStatus, number>
  rate: number | null
  rateLabel: string
}

/** Maps a `session:finale` broadcast into the cockpit banner view model. */
export function mapFinaleBanner(summary: SessionFinaleSummary): FinaleBannerModel {
  const rate = finaleAttendancePercent(summary.counts)
  return {
    endedAt: summary.endedAt,
    capacity: summary.capacity,
    counts: summary.counts,
    rate,
    rateLabel: rate === null ? '—' : `${rate}%`,
  }
}
