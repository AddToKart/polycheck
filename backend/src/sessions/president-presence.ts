import { haversineDistance } from '@polycheck/shared'
import { getPrimaryDeviceSecurityDispute } from '../attendance/device-security-policy'
import { MAX_LOCATION_ACCURACY_METERS, MAX_LOCATION_AGE_MS, MAX_WEB_LOCATION_ACCURACY_METERS } from '../attendance/types'
import type { HostStartDto } from './dto/host-session.dto'

export type PresidentPresence =
  { present: true; latitude: number; longitude: number; message: string } | { present: false; message: string }

interface ClassArea {
  geofenceLatitude: number | null
  geofenceLongitude: number | null
  geofenceRadiusMeters: number | null
}

const ASK_PROFESSOR = ' Ask your professor to mark you.'

/**
 * Whether starting the session may mark the president present. It holds them
 * to the same location rules as a scan, because they cannot scan a QR shown on
 * their own screen. Failing never blocks the start; it only leaves them unmarked.
 */
export function evaluatePresidentPresence(area: ClassArea, evidence: HostStartDto): PresidentPresence {
  const no = (reason: string): PresidentPresence => ({ present: false, message: reason + ASK_PROFESSOR })
  const { latitude, longitude, accuracyMeters } = evidence
  if (latitude === undefined || longitude === undefined) {
    return no('You were not marked present because your location was not shared.')
  }
  if (area.geofenceLatitude === null || area.geofenceLongitude === null || area.geofenceRadiusMeters === null) {
    return no('You were not marked present because this session has no class area.')
  }
  if (evidence.mocked === true) return no('You were not marked present because the location looks simulated.')
  if (getPrimaryDeviceSecurityDispute(evidence.deviceSecurity)) {
    return no('You were not marked present because this device failed the security check.')
  }
  if (evidence.locationCapturedAt && evidence.clientTime) {
    const age = Date.parse(evidence.clientTime) - Date.parse(evidence.locationCapturedAt)
    if (!(age >= -30_000 && age <= MAX_LOCATION_AGE_MS)) {
      return no('You were not marked present because the location reading was too old.')
    }
  }
  const isWeb = Boolean(evidence.deviceId?.startsWith('web-'))
  const maxAccuracy = isWeb ? MAX_WEB_LOCATION_ACCURACY_METERS : MAX_LOCATION_ACCURACY_METERS
  if (accuracyMeters === undefined || accuracyMeters > maxAccuracy) {
    return no('You were not marked present because your location was not accurate enough.')
  }
  const distance = haversineDistance(latitude, longitude, area.geofenceLatitude, area.geofenceLongitude)
  const radius = area.geofenceRadiusMeters
  if (distance > radius) {
    return no(
      `You were not marked present because you are about ${Math.round(distance)} m away and the class area is ${radius} m.`,
    )
  }
  if (!isWeb && accuracyMeters <= radius && distance + accuracyMeters > radius) {
    return no('You were not marked present because your location may be outside the class area.')
  }
  return { present: true, latitude, longitude, message: 'You were marked present.' }
}
