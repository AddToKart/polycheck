import { describe, expect, it } from 'vitest'
import { haversineDistance, isWithinGeofence } from './haversine'

describe('haversineDistance', () => {
  it('returns zero for identical coordinates', () => {
    expect(haversineDistance(0, 0, 0, 0)).toBe(0)
    expect(haversineDistance(14.5995, 120.9842, 14.5995, 120.9842)).toBe(0)
  })

  it('returns ~111.195 km for one degree of latitude at the equator', () => {
    const distance = haversineDistance(0, 0, 1, 0)
    expect(Math.abs(distance - 111195)).toBeLessThan(500)
  })

  it('returns ~111.195 km for one degree of longitude at the equator', () => {
    const distance = haversineDistance(0, 0, 0, 1)
    expect(Math.abs(distance - 111195)).toBeLessThan(500)
  })

  it('returns ~78.6 km for one degree of longitude at 45° latitude', () => {
    const distance = haversineDistance(45, 0, 45, 1)
    // 111195 * cos(45°) ≈ 78.6 km; the contract expects ~78.8 km, allow a band either way.
    expect(distance).toBeGreaterThan(78000)
    expect(distance).toBeLessThan(79500)
  })

  it('is symmetric: distance(a, b) === distance(b, a)', () => {
    const pairs: Array<[number, number, number, number]> = [
      [0, 0, 1, 1],
      [14.5995, 120.9842, 40.7128, -74.006],
      [-33.8688, 151.2093, 35.6762, 139.6503],
      [45, -93, 45, -92],
    ]
    for (const [lat1, lon1, lat2, lon2] of pairs) {
      expect(haversineDistance(lat1, lon1, lat2, lon2)).toBe(
        haversineDistance(lat2, lon2, lat1, lon1)
      )
    }
  })
})

describe('isWithinGeofence', () => {
  const centerLat = 14.5995
  const centerLon = 120.9842

  it('returns true when the student is inside the radius', () => {
    // ~40 m north of the center (0.00036 deg lat ≈ 40 m)
    expect(isWithinGeofence(centerLat + 0.00036, centerLon, centerLat, centerLon, 50)).toBe(true)
  })

  it('returns true when the student is exactly at the radius (inclusive boundary)', () => {
    const distance = haversineDistance(centerLat, centerLon, centerLat + 0.001, centerLon)
    expect(isWithinGeofence(centerLat + 0.001, centerLon, centerLat, centerLon, distance)).toBe(true)
  })

  it('returns false when the student is just outside the radius', () => {
    const distance = haversineDistance(centerLat, centerLon, centerLat + 0.001, centerLon)
    expect(isWithinGeofence(centerLat + 0.001, centerLon, centerLat, centerLon, distance - 1)).toBe(false)
  })

  it('returns false for a clearly distant point', () => {
    expect(isWithinGeofence(centerLat + 1, centerLon, centerLat, centerLon, 50)).toBe(false)
  })
})
