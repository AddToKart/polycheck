import * as Sentry from '@sentry/nextjs'
import { sentryCommonOptions } from './lib/sentry-options'

Sentry.init({
  ...sentryCommonOptions,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
