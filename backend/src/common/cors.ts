import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface'

const METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'PUT']
const PUBLIC_REGISTRATION = /^\/api\/registrations\/public(\/status)?\/?(\?.*)?$/

export const splitOrigins = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

/**
 * The web app's origins may call the whole API with cookies. The landing page
 * is a different site: it may call only the two public sign-up routes, and
 * never with cookies.
 */
export function corsOptionsFor(url: string, appOrigins: string[], registrationOrigins: string[]): CorsOptions {
  if (PUBLIC_REGISTRATION.test(url)) {
    return {
      origin: [...new Set([...registrationOrigins, ...appOrigins])],
      methods: ['GET', 'POST'],
      credentials: false,
    }
  }
  return { origin: appOrigins, methods: METHODS, credentials: true }
}
