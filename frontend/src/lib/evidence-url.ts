import { API_BASE } from './api-config'

/**
 * Resolves a backend static-upload reference (`/uploads/...`) to a browser URL.
 * When the API is proxied under the same origin the path can be used verbatim;
 * otherwise the backend origin is prefixed.
 */
export function resolveEvidenceUrl(path?: string | null): string | null {
  if (!path) return null
  const trimmed = path.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  // Object-store references cannot be rendered by the browser directly.
  if (/^s3:\/\//i.test(trimmed)) return null
  if (API_BASE.startsWith('/')) return trimmed
  try {
    return new URL(trimmed, `${new URL(API_BASE).origin}/`).toString()
  } catch {
    return trimmed
  }
}
