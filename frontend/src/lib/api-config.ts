const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()

/**
 * Browser API origin. Deployments should set NEXT_PUBLIC_API_URL to the
 * publicly reachable NestJS endpoint; localhost remains convenient for local
 * web development.
 */
export const API_BASE = (configuredApiUrl || 'http://localhost:4000/api').replace(/\/+$/, '')
