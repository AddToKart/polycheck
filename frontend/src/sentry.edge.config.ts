import * as Sentry from '@sentry/nextjs'
import { sentryCommonOptions } from './lib/sentry-options'

Sentry.init({
  ...sentryCommonOptions,
  dsn: process.env.SENTRY_DSN,
})
