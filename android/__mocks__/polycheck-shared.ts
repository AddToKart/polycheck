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

// Decodes the unsigned payload segment of a QR token (`<base64url(JSON payload)>.<signature>`).
// Signature verification is intentionally skipped in tests; any parse failure returns null so the
// offline pipeline can exercise its invalid-signature paths.
export function verifyQRToken(token: string, _publicKey: string): unknown {
  try {
    const encoded = token.split('.')[0]
    if (!encoded) return null
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const decoded = Buffer.from(padded, 'base64').toString('utf8')
    return decoded ? JSON.parse(decoded) : null
  } catch {
    return null
  }
}

export function createSigningKeyPair(_seed: Uint8Array) {
  return { publicKey: 'test-public-key', secretKey: 'test-secret-key' }
}
