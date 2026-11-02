'use client'

import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react'
import { isNearBottom, prefersReducedMotion } from './assistant-utils'

/**
 * Keeps the transcript pinned to the newest message only while the reader is
 * already at the bottom. Scrolling up freezes the viewport and starts the
 * "Jump to latest" unread counter instead of yanking the reader down.
 */
export function useStickToBottom(contentKey: string, messageCount: number) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const stickRef = useRef(true)
  const previousCountRef = useRef(messageCount)
  const [scrolledUp, setScrolledUp] = useState(false)
  const [unread, setUnread] = useState(0)

  const scrollToLatest = useCallback((behavior: ScrollBehavior) => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTo({
      top: node.scrollHeight,
      behavior: prefersReducedMotion() ? 'auto' : behavior,
    })
  }, [])

  useEffect(() => {
    const node = scrollRef.current
    if (!node || !stickRef.current) return
    node.scrollTop = node.scrollHeight
  }, [contentKey])

  useEffect(() => {
    const delta = messageCount - previousCountRef.current
    previousCountRef.current = messageCount
    if (delta > 0 && !stickRef.current) {
      setUnread((current) => current + delta)
    }
  }, [messageCount])

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget
    const nearBottom = isNearBottom({
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    })
    stickRef.current = nearBottom
    setScrolledUp(!nearBottom)
    if (nearBottom) setUnread(0)
  }, [])

  const jumpToLatest = useCallback(() => {
    stickRef.current = true
    setScrolledUp(false)
    setUnread(0)
    scrollToLatest('smooth')
  }, [scrollToLatest])

  /** Force the viewport back to the newest message (e.g. after switching threads). */
  const resetToBottom = useCallback(() => {
    stickRef.current = true
    setScrolledUp(false)
    setUnread(0)
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [])

  return { scrollRef, scrolledUp, unread, onScroll, jumpToLatest, resetToBottom }
}

/** SSR-safe `min-width` media query, used to pick the rail vs. the sheet. */
export function useIsDesktop(query = '(min-width: 1024px)'): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mediaQuery = window.matchMedia(query)
    const update = () => setMatches(mediaQuery.matches)
    update()
    mediaQuery.addEventListener?.('change', update)
    return () => mediaQuery.removeEventListener?.('change', update)
  }, [query])

  return matches
}
