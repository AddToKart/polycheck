'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, RefreshCw, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

async function writeToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Permission or insecure-context failures fall through to the textarea.
    }
  }
  if (typeof document === 'undefined') throw new Error('Clipboard is unavailable')
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    if (!document.execCommand('copy')) throw new Error('Clipboard is unavailable')
  } finally {
    textarea.remove()
  }
}

interface MessageActionsProps {
  content: string
  align?: 'start' | 'end'
  onRegenerate?: () => void
  regenerateDisabled?: boolean
  onRetry?: () => void
  className?: string
}

const actionClass =
  'inline-flex items-center gap-1 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-maroon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-golden dark:focus-visible:ring-golden/40'

export function MessageActions({
  content,
  align = 'start',
  onRegenerate,
  regenerateDisabled = false,
  onRetry,
  className,
}: MessageActionsProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const resetTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    }
  }, [])

  const flash = (state: 'copied' | 'failed') => {
    setCopyState(state)
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setCopyState('idle'), 2_000)
  }

  const handleCopy = async () => {
    try {
      await writeToClipboard(content)
      flash('copied')
    } catch {
      flash('failed')
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-0.5', align === 'end' && 'justify-end', className)}>
      {content ? (
        <button type="button" onClick={() => void handleCopy()} className={actionClass}>
          {copyState === 'copied' ? (
            <Check className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Copy className="h-3 w-3" aria-hidden="true" />
          )}
          {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
        </button>
      ) : null}

      {onRegenerate ? (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerateDisabled}
          className={actionClass}
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Regenerate
        </button>
      ) : null}

      {onRetry ? (
        <button type="button" onClick={onRetry} className={cn(actionClass, 'text-maroon dark:text-golden')}>
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      ) : null}

      <span role="status" aria-live="polite" className="sr-only">
        {copyState === 'copied'
          ? 'Message copied to clipboard'
          : copyState === 'failed'
            ? 'Could not copy the message'
            : ''}
      </span>
    </div>
  )
}
