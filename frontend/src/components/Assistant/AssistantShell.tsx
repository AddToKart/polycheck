'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import {
  History,
  Maximize2,
  Minimize2,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssistantChatGeometry } from './assistant-utils'
import { useIsDesktop } from './use-assistant-ui'

interface AssistantShellProps {
  geometry: AssistantChatGeometry
  eyebrow: string
  threadTitle: string | null
  model?: string
  connected: boolean
  streaming: boolean
  onClose?: () => void
  onToggleGeometry?: () => void
  onNewChat?: () => void
  historyOpen: boolean
  onToggleHistory?: () => void
  /** Mounted only while the rail/sheet is open (so it fetches on demand). */
  rail?: ReactNode
  className?: string
  children: ReactNode
}

const controlClass =
  'inline-flex h-7 w-7 items-center justify-center text-white/70 transition-colors hover:bg-white/10 hover:text-golden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-golden/60 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-golden'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function AssistantShell({
  geometry,
  eyebrow,
  threadTitle,
  model,
  connected,
  streaming,
  onClose,
  onToggleGeometry,
  onNewChat,
  historyOpen,
  onToggleHistory,
  rail,
  className,
  children,
}: AssistantShellProps) {
  const frameRef = useRef<HTMLElement>(null)
  const isDesktop = useIsDesktop()
  const isOverlay = geometry !== 'focus'

  useEffect(() => {
    if (!isOverlay) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [isOverlay])

  useEffect(() => {
    if (!isOverlay) return
    const frame = frameRef.current
    const timer = window.setTimeout(() => frame?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [isOverlay])

  useEffect(() => {
    if (!isOverlay) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const frame = frameRef.current
      if (!frame) return
      const focusable = Array.from(frame.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null
      const index = active ? focusable.indexOf(active) : -1
      if (index === -1) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
        return
      }
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOverlay])

  const connectionLabel = connected
    ? 'Connected'
    : streaming
      ? 'Reconnecting'
      : 'Idle'
  const TitleTag = geometry === 'focus' ? 'h1' : 'h2'

  const header = (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-golden/70 bg-maroon px-3 py-2.5 text-white dark:bg-surface-dark dark:text-foreground">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-golden/60 bg-golden/15 text-golden">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TitleTag className="shrink-0 font-heading text-sm font-bold leading-none text-golden">
              Assistant
            </TitleTag>
            {model ? (
              <span
                title={`Model: ${model}`}
                className="hidden max-w-[9rem] truncate border border-white/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/75 sm:inline dark:border-golden/25 dark:text-golden/80"
              >
                {model}
              </span>
            ) : null}
            <span
              title={`Connection: ${connectionLabel}`}
              className="flex shrink-0 items-center gap-1"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  connected
                    ? 'bg-emerald-400'
                    : streaming
                      ? 'animate-pulse bg-golden motion-reduce:animate-none'
                      : 'bg-white/35 dark:bg-zinc-600',
                )}
              />
              <span className="sr-only">Connection: {connectionLabel}</span>
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-baseline gap-1.5 text-[9px] font-bold uppercase tracking-widest text-white/60 dark:text-zinc-400">
            <span className="shrink-0">{eyebrow}</span>
            {threadTitle ? (
              <>
                <span aria-hidden="true" className="shrink-0">
                  ·
                </span>
                <span
                  className="truncate text-[11px] font-medium normal-case tracking-normal text-white/85 dark:text-zinc-300"
                  title={threadTitle}
                >
                  {threadTitle}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {onNewChat ? (
          <button
            type="button"
            onClick={onNewChat}
            aria-label="Start a new chat"
            title="New chat"
            className={controlClass}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}

        {onToggleGeometry && geometry !== 'focus' ? (
          <button
            type="button"
            onClick={onToggleGeometry}
            aria-label={geometry === 'dock' ? 'Expand assistant to theater' : 'Collapse assistant to dock'}
            title={geometry === 'dock' ? 'Expand' : 'Collapse'}
            className={cn(controlClass, 'hidden lg:inline-flex')}
          >
            {geometry === 'dock' ? (
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        ) : null}

        {rail && onToggleHistory ? (
          <button
            type="button"
            onClick={onToggleHistory}
            aria-label={historyOpen ? 'Hide conversation history' : 'Show conversation history'}
            aria-expanded={historyOpen}
            title="Conversation history"
            className={cn(controlClass, historyOpen && 'bg-white/10 text-golden dark:bg-zinc-800')}
          >
            <History className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assistant"
            title="Close"
            className={controlClass}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </header>
  )

  const body = (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      {rail && historyOpen && isDesktop ? (
        <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-300 lg:flex dark:border-zinc-800">
          {rail}
        </aside>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>

      {rail && historyOpen && !isDesktop ? (
        <div className="absolute inset-0 z-20 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onToggleHistory}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex h-full w-72 max-w-[85%] flex-col border-r border-zinc-300 bg-background shadow-xl dark:border-zinc-800">
            {rail}
          </aside>
        </div>
      ) : null}
    </div>
  )

  if (!isOverlay) {
    return (
      <section
        className={cn(
          'relative flex h-full min-h-0 flex-col overflow-hidden border border-zinc-300 bg-background text-foreground dark:border-zinc-800',
          className,
        )}
        aria-label="Assistant"
        data-geometry={geometry}
      >
        {header}
        {body}
      </section>
    )
  }

  return (
    <div className="fixed inset-0 z-[80]" data-geometry={geometry}>
      <div
        className={cn(
          'absolute inset-0 bg-black/50',
          geometry === 'theater' ? 'backdrop-blur-md' : 'backdrop-blur-sm',
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <section
        ref={frameRef}
        role="dialog"
        aria-modal="true"
        aria-label="Assistant"
        tabIndex={-1}
        className={cn(
          'absolute flex flex-col overflow-hidden border bg-background text-foreground shadow-2xl outline-none',
          geometry === 'dock'
            ? 'inset-y-0 right-0 w-full max-w-md border-l border-zinc-300 dark:border-zinc-800'
            : 'left-1/2 top-1/2 h-[min(760px,86vh)] w-[min(1120px,92vw)] -translate-x-1/2 -translate-y-1/2 border-zinc-300 dark:border-zinc-800',
          'transition-[width,height] duration-200 motion-reduce:transition-none',
          className,
        )}
      >
        {header}
        {body}
      </section>
    </div>
  )
}
