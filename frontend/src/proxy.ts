import { NextResponse, type NextRequest } from 'next/server'

const apiSources = () => {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (!configured) return []
  try {
    const url = new URL(configured)
    const websocketProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return [url.origin, `${websocketProtocol}//${url.host}`]
  } catch {
    return []
  }
}

const contentSecurityPolicy = (nonce: string) => {
  const developmentSources =
    process.env.NODE_ENV === 'production'
      ? []
      : ["'unsafe-eval'", 'http://localhost:*', 'ws://localhost:*', 'http://127.0.0.1:*', 'ws://127.0.0.1:*']

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${developmentSources[0] ?? ''}`.trim(),
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://*.basemaps.cartocdn.com",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
    [
      "connect-src 'self'",
      ...apiSources(),
      'https://*.tile.openstreetmap.org',
      'https://*.basemaps.cartocdn.com',
      ...developmentSources.slice(1),
    ].join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]
    .join('; ')
    .replace(/\s{2,}/g, ' ')
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const policy = contentSecurityPolicy(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', policy)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', policy)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|pup-logo.png).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
