'use client'

import { useState } from 'react'
import type { AiChatAttachment } from '@polycheck/shared'
import { Check, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { describeAssistantError } from './assistant-utils'

type DownloadState = 'loading' | 'done'

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function FormatIcon({ format }: { format: AiChatAttachment['format'] }) {
  const Icon = format === 'csv' ? FileSpreadsheet : FileText
  return <Icon className="h-4 w-4" aria-hidden="true" />
}

export function AttachmentCards({
  attachments,
  onError,
  className,
}: {
  attachments: AiChatAttachment[]
  onError?: (message: string) => void
  className?: string
}) {
  const [states, setStates] = useState<Record<string, DownloadState>>({})

  if (attachments.length === 0) return null

  const handleDownload = async (attachment: AiChatAttachment) => {
    if (states[attachment.id] === 'loading') return
    setStates((current) => ({ ...current, [attachment.id]: 'loading' }))
    try {
      const blob = await api.downloadAssistantFile(attachment.downloadPath)
      triggerBrowserDownload(blob, attachment.filename)
      setStates((current) => ({ ...current, [attachment.id]: 'done' }))
    } catch (error) {
      setStates((current) => {
        const next = { ...current }
        delete next[attachment.id]
        return next
      })
      onError?.(describeAssistantError(error))
    }
  }

  return (
    <div className={cn('mt-2 flex flex-col gap-1.5', className)}>
      {attachments.map((attachment) => {
        const state = states[attachment.id]
        return (
          <button
            key={attachment.id}
            type="button"
            onClick={() => void handleDownload(attachment)}
            disabled={state === 'loading'}
            aria-label={
              state === 'done'
                ? `Download ${attachment.filename} again`
                : `Download ${attachment.filename}`
            }
            className="group flex w-full items-center gap-2 border border-zinc-300 bg-white px-2 py-2 text-left transition-colors hover:border-maroon hover:bg-maroon/5 disabled:cursor-wait disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:border-golden dark:hover:bg-golden/5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-maroon/20 bg-maroon/5 text-maroon dark:border-golden/20 dark:bg-golden/10 dark:text-golden">
              <FormatIcon format={attachment.format} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-foreground">
                {attachment.label || attachment.filename}
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {attachment.format} · {attachment.filename}
              </span>
            </span>
            <span className="shrink-0 text-maroon dark:text-golden" aria-hidden="true">
              {state === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              ) : state === 'done' ? (
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
