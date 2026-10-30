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
