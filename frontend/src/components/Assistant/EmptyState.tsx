'use client'

import { ArrowUpRight, Check, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssistantRole } from './assistant-utils'
import { ASSISTANT_ROLE_COPY } from './suggestions'

export function EmptyState({
  role,
  suggestions,
  onSelectPrompt,
  className,
}: {
  role: AssistantRole
  suggestions: string[]
  onSelectPrompt: (prompt: string) => void
  className?: string
}) {
  const copy = ASSISTANT_ROLE_COPY[role]
  const prompts = suggestions.slice(0, 4)

  return (
    <div
      className={cn('mx-auto flex w-full max-w-md flex-col items-center py-6 text-center', className)}
      aria-labelledby="assistant-empty-title"
    >
      <span className="flex h-12 w-12 items-center justify-center border border-golden/60 bg-golden/15 text-maroon dark:text-golden">
        <Sparkles className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3
        id="assistant-empty-title"
        className="mt-3 font-heading text-lg font-bold leading-tight text-maroon dark:text-golden"
      >
        {copy.emptyTitle}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {copy.emptyDescription}
      </p>

      <p className="mt-5 self-start text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        Try asking
      </p>
      <div className="mt-2 grid w-full grid-cols-2 gap-2 text-left">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelectPrompt(prompt)}
            className="group flex min-h-[62px] flex-col justify-between border border-zinc-300 bg-white p-2.5 text-left transition-colors hover:border-maroon hover:bg-maroon/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:border-golden dark:hover:bg-golden/5 dark:focus-visible:ring-golden/40"
          >
            <span className="text-xs font-semibold leading-snug text-zinc-700 dark:text-zinc-200">
              {prompt}
            </span>
            <ArrowUpRight
              className="mt-2 h-3.5 w-3.5 self-end text-zinc-400 transition-colors group-hover:text-maroon dark:group-hover:text-golden"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      <div className="mt-5 grid w-full grid-cols-2 gap-3 text-left">
        <section aria-label="What the assistant can do" className="border border-zinc-200 p-2.5 dark:border-zinc-800">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Can
          </h4>
          <ul className="mt-1.5 space-y-1">
            {copy.can.map((item) => (
              <li key={item} className="flex gap-1.5 text-[11px] leading-snug text-zinc-600 dark:text-zinc-300">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>
        <section aria-label="What the assistant cannot do" className="border border-zinc-200 p-2.5 dark:border-zinc-800">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Can&apos;t
          </h4>
          <ul className="mt-1.5 space-y-1">
            {copy.cant.map((item) => (
              <li key={item} className="flex gap-1.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                <X className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        Read-only · scoped to your account
      </p>
    </div>
  )
}
