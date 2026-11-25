import type { InstitutionBranding } from '@polycheck/shared'
import { API_BASE } from './api-config'

/** Where the web server (not the browser) reaches the API; falls back to the public URL. */
const SERVER_API_BASE = (process.env.INTERNAL_API_URL?.trim() || API_BASE).replace(/\/+$/, '')

/**
 * Institution identity for the first server-rendered paint. Strictly best effort: a short timeout and any failure
 * return null, in which case the client fetches it (and falls back to its local copy). It must never delay or break
 * rendering of the page.
 */
export async function fetchServerBranding(): Promise<InstitutionBranding | null> {
  try {
    const response = await fetch(`${SERVER_API_BASE}/branding`, {
      signal: AbortSignal.timeout(1_500),
      next: { revalidate: 30 },
    })
    if (!response.ok) return null
    return (await response.json()) as InstitutionBranding
  } catch {
    return null
  }
}
