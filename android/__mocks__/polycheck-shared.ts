// Mock @polycheck/shared for Jest
export function isWithinGeofence(
  lat: number, lng: number,
  centerLat: number, centerLng: number,
  radiusMeters: number,
): boolean {
  const R = 6371000
  const dLat = ((centerLat - lat) * Math.PI) / 180
  const dLng = ((centerLng - lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat * Math.PI) / 180) * Math.cos((centerLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radiusMeters
}

export function signQRToken(_payload: unknown, _secretKey: string): string {
  return 'signed-token-placeholder'
}

export function verifyQRToken(_token: string, _publicKey: string): unknown {
  return { valid: true }
}

export function createSigningKeyPair(_seed: Uint8Array) {
  return { publicKey: 'test-public-key', secretKey: 'test-secret-key' }
}
