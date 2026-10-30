'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { AiCapabilities, User } from '@polycheck/shared'
import { Sparkles } from 'lucide-react'
import { api } from '@/lib/api-client'
import { AssistantChat } from './AssistantChat'
import {
  isAssistantRole,
  readGeometryPreference,
  writeGeometryPreference,
  type AssistantOverlayGeometry,
} from './assistant-utils'
import { shouldShowAssistantEntry } from './assistant-visibility'
import { ASSISTANT_ROLE_COPY } from './suggestions'

const FOCUS_ROUTES = new Set(['/faculty/assistant', '/student/assistant'])

export function AssistantLauncher() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [capabilities, setCapabilities] = useState<AiCapabilities | null>(null)
  const [resolved, setResolved] = useState(false)
  const [open, setOpen] = useState(false)
  const [geometry, setGeometry] = useState<AssistantOverlayGeometry>('dock')
  const launcherRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    let requestSeq = 0
    let currentUserId: string | null = null

    const sync = async () => {
      const seq = ++requestSeq
      const current = api.getCurrentUser()
      const nextUser = current && isAssistantRole(current.role) ? current : null
      const previousUserId = currentUserId
      const userChanged = nextUser?.id !== previousUserId
      currentUserId = nextUser?.id ?? null
      setUser(nextUser)

      if (!nextUser) {
        setCapabilities(null)
        setResolved(true)
        setOpen(false)
        return
      }

      // Background session revalidation also emits polycheck-auth-changed.
      // Keep the resolved surface (and any open panel) stable for the same
      // user; only a new identity needs a fresh gate before it can render.
      if (userChanged) {
        setResolved(false)
        setCapabilities(null)
        if (previousUserId !== null) setOpen(false)
      }

      let nextCapabilities: AiCapabilities | null = null
      try {
        nextCapabilities = await api.getAiCapabilities()
      } catch {
        nextCapabilities = null
      }
      if (cancelled || seq !== requestSeq) return

      setCapabilities(nextCapabilities)
      setResolved(true)
      // A policy flip while the panel is open must not leave a dead chat
      // surface on screen. The next capabilities check decides when it returns.
      if (!shouldShowAssistantEntry(nextUser.role, nextCapabilities)) setOpen(false)
    }

    void sync()
    const onAuthChanged = () => {
      void sync()
    }
    window.addEventListener('polycheck-auth-changed', onAuthChanged)
    return () => {
      cancelled = true
      window.removeEventListener('polycheck-auth-changed', onAuthChanged)
    }
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const close = useCallback(() => {
    setOpen(false)
    window.setTimeout(() => launcherRef.current?.focus(), 0)
  }, [])

  const changeGeometry = useCallback((next: AssistantOverlayGeometry) => {
    setGeometry(next)
    writeGeometryPreference(next)
  }, [])

  const openAssistant = useCallback(() => {
    setGeometry(readGeometryPreference())
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      // Esc ladder: theater → dock → close.
      if (geometry === 'theater') {
        changeGeometry('dock')
      } else {
        close()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [changeGeometry, close, geometry, open])

  if (
    !user ||
    !resolved ||
    !shouldShowAssistantEntry(user.role, capabilities) ||
    FOCUS_ROUTES.has(pathname)
  ) {
    return null
  }

  const copy = ASSISTANT_ROLE_COPY[user.role]

  return (
    <>
      {!open ? (
        <button
          ref={launcherRef}
          type="button"
          onClick={openAssistant}
          aria-label={copy.bubbleAriaLabel}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={copy.eyebrow}
          className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 flex h-11 items-center gap-2 border border-maroon-dark bg-maroon px-4 text-[10px] font-bold uppercase tracking-widest text-golden shadow-lg transition-colors hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-golden focus-visible:ring-offset-2 dark:border-golden/40"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Assistant</span>
        </button>
      ) : null}

      {open ? (
        <AssistantChat
          geometry={geometry}
          onGeometryChange={changeGeometry}
          onClose={close}
          autoFocus
        />
      ) : null}
    </>
  )
}
