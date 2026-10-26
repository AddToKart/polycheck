'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const DISMISS_KEY = 'polycheck-pwa-install-dismissed'

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return isIos && isSafari
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

/**
 * One-time "Add to Home Screen" guidance for iOS students. Standalone PWAs keep
 * their storage across long idle periods; browser tabs can be evicted after
 * ~7 days, so installing protects the pre-synced class data.
 */
export function IosInstallCallout() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isIosSafari() || isStandalone()) return
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      // Private browsing may block storage; showing the callout is harmless.
    }
    setVisible(true)
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Ignore storage failures.
    }
  }

  if (!visible) return null

  return (
    <aside
      aria-label="Install Polycheck on this device"
      className="relative border border-golden/40 bg-golden/10 p-4 pr-10 text-sm dark:border-golden/25 dark:bg-golden/5"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install instructions"
        className="absolute right-2 top-2 rounded p-1 text-maroon-dark hover:bg-golden/20 dark:text-golden"
      >
        <X size={16} aria-hidden="true" />
      </button>
      <p className="font-bold text-maroon-dark dark:text-golden">Add Polycheck to your Home Screen</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
        <li>Tap the Share button in Safari.</li>
        <li>Choose &quot;Add to Home Screen&quot;, then open Polycheck from the new icon.</li>
      </ol>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        Installing keeps your offline class data available for longer between sessions.
      </p>
    </aside>
  )
}
