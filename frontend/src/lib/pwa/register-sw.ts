/**
 * Service-worker registration + update signaling for the offline-first web app.
 *
 * Offline support is on by default and can be disabled with
 * NEXT_PUBLIC_PWA_OFFLINE=false (kill switch for environments where a stale SW
 * would be harmful). Registration is production-only so `next dev` is never
 * served from a cache.
 */
export const PWA_OFFLINE_ENABLED = process.env.NEXT_PUBLIC_PWA_OFFLINE !== 'false'

export const PWA_UPDATE_EVENT = 'polycheck-pwa-update'

function notifyUpdateReady() {
  window.dispatchEvent(new CustomEvent(PWA_UPDATE_EVENT))
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!PWA_OFFLINE_ENABLED) return null
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  if (process.env.NODE_ENV !== 'production') return null

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

    if (registration.waiting) notifyUpdateReady()

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      if (!installing) return
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          notifyUpdateReady()
        }
      })
    })

    return registration
  } catch {
    // Offline capability is best-effort; never break online attendance for it.
    return null
  }
}

export function applyServiceWorkerUpdate(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' })
}

/** Cache names the worker owns end with this suffix (`polycheck-v2-api`). */
const API_CACHE_SUFFIX = '-api'

/**
 * Drops every API body the service worker cached. Called on logout and account
 * switch: the Cache API is keyed by URL only and ignores the session cookie, so
 * a cached roster/attendance body would otherwise be served to the next account
 * on this browser while offline.
 *
 * Best-effort and non-blocking by design — offline support must never block a
 * sign-out. The worker handles `CLEAR_API_CACHE` for its own cache, and the
 * page deletes the same Cache-API entries directly (the Cache API is shared
 * with the worker) so caches left by an older worker version die immediately.
 */
export async function clearApiCache(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_API_CACHE' })
    }
    if (typeof caches === 'undefined') return
    const keys = await caches.keys()
    await Promise.all(
      keys.filter((key) => key.endsWith(API_CACHE_SUFFIX)).map((key) => caches.delete(key)),
    )
  } catch (error) {
    // Offline capability is best-effort; a failed purge must not block logout.
    console.warn('[pwa] The cached API responses could not be cleared.', error)
  }
}
