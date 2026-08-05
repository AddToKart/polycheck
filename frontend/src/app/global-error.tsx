'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <main className="max-w-md text-center">
          <h1 className="font-serif text-3xl font-bold">Polycheck hit an unexpected error</h1>
          <p className="mt-3 text-sm text-muted-foreground">The problem was reported without attendance evidence or location details.</p>
          <button type="button" onClick={reset} className="mt-6 min-h-11 rounded-xl bg-maroon px-5 font-bold text-white">
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
