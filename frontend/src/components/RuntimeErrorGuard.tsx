'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { isCancellationShapedError } from '@/lib/abort-errors'

const NAVIGATION_GRACE_MS = 2_000

function startsSameOriginNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false

  const target = event.target
  if (!(target instanceof Element)) return false

  const anchor = target.closest('a[href]')
  if (!anchor) return false

  try {
    const url = new URL(anchor.getAttribute('href') ?? '', window.location.href)
    return url.origin === window.location.origin
  } catch {
    return false
  }
}

/**
 * Browser fetch engines report cancelled requests (navigation, unmount,
 * prefetch cancellation) with messages that are indistinguishable from genuine
 * network failures. Suppress those rejections only while a navigation or page
 * teardown is in progress; everything else keeps propagating so real failures
 * remain visible.
 */
export function RuntimeErrorGuard() {
  const pathname = usePathname()
  const lastNavigationAt = useRef(0)
  const previousPathname = useRef(pathname)

  useEffect(() => {
    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    lastNavigationAt.current = Date.now()
  }, [pathname])

  useEffect(() => {
    const markNavigation = () => {
      lastNavigationAt.current = Date.now()
    }
    const handleClick = (event: MouseEvent) => {
      if (startsSameOriginNavigation(event)) markNavigation()
    }
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isCancellationShapedError(event.reason)) return
      const navigating = Date.now() - lastNavigationAt.current <= NAVIGATION_GRACE_MS
      if (navigating || document.visibilityState === 'hidden') {
        event.preventDefault()
      }
    }

    document.addEventListener('click', handleClick, true)
    window.addEventListener('pagehide', markNavigation)
    window.addEventListener('popstate', markNavigation)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      document.removeEventListener('click', handleClick, true)
      window.removeEventListener('pagehide', markNavigation)
      window.removeEventListener('popstate', markNavigation)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null
}
