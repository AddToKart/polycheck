import type { Event } from '@sentry/nextjs'

export const sanitizeSentryEvent = <T extends Event>(event: T): T => {
  if (event.request) {
    delete event.request.cookies
    delete event.request.headers
    delete event.request.data
    delete event.request.query_string
  }
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined
  }
  return event
}

export const sentryCommonOptions = {
  enabled: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  beforeSend: sanitizeSentryEvent,
  tracesSampleRate: 0.05,
}
