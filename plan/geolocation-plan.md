# Polycheck — Geolocation Plan

## Responsibility

This document covers the geolocation system: how geofences are configured, how distance validation works on both the device and the server, what constitutes a geofence violation, and the GPS spoofing heuristics in use.

---

## Geofence Configuration

A geofence is defined as a circle: a center point (latitude + longitude) and a radius in meters.

```ts
interface GeofenceConfig {
  latitude: number
  longitude: number
  radiusMeters: number  // typically 30–50 meters per system plan
}
```

### Where It's Set

Geofences are configured per-session, not per-section. A session's geofence represents the physical location of that specific class meeting. If a class moves rooms between sessions, the geofence changes.

```
Session.geofenceLatitude
Session.geofenceLongitude
Session.geofenceRadiusMeters
```

The default radius range from the system plan is **30–50 meters**. Teachers configure this when creating a session. The UI should suggest a sensible default (e.g., 40 meters) and allow adjustment.

---

## Haversine Distance Calculation

The distance between two points is calculated using the Haversine formula, which accounts for Earth's curvature and is accurate at short distances.

Implemented in `@polycheck/shared/utils/haversine.ts`:

```ts
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number  // returns distance in meters
```

This function is shared and used by both:
- **Student mobile app** — local validation at scan time (offline)
- **NestJS backend** — re-validation during sync

### Local Validation Flow (Student Device)

1. Student scans QR → decodes token payload
2. App requests current GPS location via `expo-location`
3. App fetches cached geofence for the session from local SQLite
4. Calls `haversineDistance(currentLat, currentLon, geofenceLat, geofenceLon)`
5. If `distance > geofenceRadiusMeters` → reject scan locally, show error
6. If within radius → accept, store attendance record

The student's device never submits to the server at scan time. The GPS coordinates are stored locally and sent during sync.

### Server Re-Validation Flow

During sync, the server independently recalculates the distance using the coordinates submitted by the student:

```ts
const distance = haversineDistance(
  record.latitude, record.longitude,
  session.geofenceLatitude, session.geofenceLongitude
)

if (distance > session.geofenceRadiusMeters) {
  // Mark as disputed, reason: 'outside_geofence'
}
```

This re-validation catches GPS spoofing that passed local checks (e.g., if the student manipulated their device GPS before scanning).

---

## GPS Accuracy Handling

Consumer-grade GPS has typical accuracy of 5–20 meters horizontally. In dense urban environments or indoors, accuracy degrades to 30–50 meters.

### Accuracy Buffer

The geofence radius should account for GPS accuracy. A radius of 40 meters with a device accuracy of 15 meters means a student 25 meters from the center could be reported as 40 meters away or 10 meters away depending on GPS error.

**V1 decision**: No dynamic accuracy-based expansion. The teacher-configured radius is used as-is. Students with persistent GPS accuracy issues can submit a dispute.

### GPS Accuracy as Dispute Signal

When submitting a dispute with `reason = 'gps_error'`, the student can optionally include the GPS accuracy reading from their device. This helps the teacher assess whether the rejection was a legitimate GPS accuracy problem.

---

## GPS Spoofing Detection

The system has a basic spoofing heuristic for v1:

### Heuristic 1: Suspiciously Precise Coordinates

Spoofing apps often produce coordinates that exactly match the geofence center (e.g., `14.5863, 120.9777`). Real GPS has noise.

Check: if the submitted coordinates are within 0.0001 degrees (~11 meters) of the exact geofence center, flag as suspicious.

```ts
const latDiff = Math.abs(record.latitude - session.geofenceLatitude)
const lonDiff = Math.abs(record.longitude - session.geofenceLongitude)
if (latDiff < 0.0001 && lonDiff < 0.0001) {
  // flag suspicious_coordinates — still accept, but surface to teacher
}
```

This does not automatically reject the record — it sets `disputeReason = 'suspicious_coordinates'` and surfaces it to the teacher for review.

### Heuristic 2: Multiple Students, Same Exact Coordinates

If multiple attendance records for a session share the exact same latitude/longitude, this is a strong signal that one student shared their GPS coordinates with others.

```sql
SELECT latitude, longitude, COUNT(*) 
FROM attendance_records 
WHERE session_id = $1 
GROUP BY latitude, longitude 
HAVING COUNT(*) > 2
```

Flag these groups for teacher review. Do not auto-reject in v1.

### V2 Plans

- SafetyNet Attestation (Android) — verify device is not rooted
- iOS DeviceCheck — verify device is a genuine Apple device
- Mock Location Detection — detect if the device has a mock location provider enabled

---

## Pre-Session Geofence Sync

Students must have the geofence cached locally before class. The pre-session pull endpoint returns:

```ts
// In GET /sync/pre-session response
{
  sessions: [{
    id: 'sess-001',
    sectionId: 'sec-001',
    date: '2026-06-16',
    geofence: {
      latitude: 14.5863,
      longitude: 120.9777,
      radiusMeters: 40
    }
    // ...
  }]
}
```

Students who have not pre-synced and have no cached geofence cannot scan. This is accepted behavior per the system plan.

---

## Geofence in Redis Cache

For active sessions, the geofence is cached in Redis (see `realtime-infra-plan.md`). The sync worker reads from cache first to avoid DB hits during peak load.

Cache key: `session:{sessionId}:geofence`
Value: `{ latitude, longitude, radiusMeters }`
TTL: session duration + buffer

---

## Edge Cases

| Scenario | Handling |
|---|---|
| Student in a high-rise directly above the geofence | 2D Haversine doesn't account for elevation. v1 ignores altitude. |
| Teacher sets geofence radius too small (< 10m) | UI should warn but not block. If many students are disputed due to small radius, teacher resolves manually. |
| Class held outdoors in a large area | Teacher sets a larger radius (up to 100m is acceptable). No cap enforced in v1. |
| GPS unavailable at scan time | Student cannot complete scan. Manual code entry is the fallback (see `scan.tsx`). |
| GPS accuracy >50m reported by device | Accept the scan but include raw accuracy reading in the sync payload for teacher context. |

---

## Open Questions

- **Altitude**: Haversine is 2D only. A student in a building directly above or below the geofence center would pass a 2D check even if they're physically 20 floors away. For v1, this is acceptable — PUP classrooms are a known set of rooms.
- **Indoor GPS**: GPS is notoriously unreliable indoors. The 40-meter default radius is designed to account for this, but if a specific building has poor GPS penetration, the teacher may need to disable geofencing for that room (not a v1 feature — would require a per-session `geofenceEnabled` flag).
- **Coordinate storage precision**: Float64 gives ~6 decimal places of precision in PostgreSQL, sufficient for sub-meter accuracy. No change needed.
