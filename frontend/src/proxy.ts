import { NextResponse, type NextRequest } from 'next/server'
import { API_BASE } from './lib/api-config'

const apiSources = (apiBase: string) => {
  try {
    const url = new URL(apiBase)
    const websocketProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return [url.origin, `${websocketProtocol}//${url.host}`]
  } catch {
    return []
  }
}

export const contentSecurityPolicy = (nonce: string, apiBase = API_BASE) => {
  const developmentSources =
    process.env.NODE_ENV === 'production'
      ? []
      : ["'unsafe-eval'", 'http://localhost:*', 'ws://localhost:*', 'http://127.0.0.1:*', 'ws://127.0.0.1:*']

  // Map style JSON + tiles load from the bare apex domains, which a `*.` wildcard
  // does NOT match. Both apex and wildcard forms are required.
  const mapSources = [
    'https://basemaps.cartocdn.com',
    'https://*.basemaps.cartocdn.com',
    'https://tile.openstreetmap.org',
    'https://*.tile.openstreetmap.org',
  ]

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${developmentSources[0] ?? ''}`.trim(),
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com",
    `img-src 'self' data: blob: ${mapSources.join(' ')}`,
    ["connect-src 'self'", ...apiSources(apiBase), ...mapSources, ...developmentSources.slice(1)].join(' '),
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
