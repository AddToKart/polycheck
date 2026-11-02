'use client'

import { useState } from 'react'
import type { AiToolInvocationSummary } from '@polycheck/shared'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const OUTCOME_STYLES: Record<AiToolInvocationSummary['outcome'], string> = {
  succeeded:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-400',
  denied:
    'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:text-amber-400',
  failed: 'border-red-500/40 bg-red-500/10 text-red-700 dark:border-red-500/30 dark:text-red-400',
}

export function ToolActivityDisclosure({
  invocations,
  className,
}: {
  invocations: AiToolInvocationSummary[]
  className?: string
}) {
  const [open, setOpen] = useState(false)
  if (invocations.length === 0) return null

  const count = invocations.length

  return (
    <div className={cn('mt-2', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:text-maroon dark:text-zinc-400 dark:hover:text-golden"
      >
        Used {count} tool{count === 1 ? '' : 's'}
        <ChevronDown
          className={cn('h-3 w-3 transition-transform motion-reduce:transition-none', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="list" aria-label="Tool activity">
          {invocations.map((invocation, index) => (
            <span
              key={`${invocation.tool}-${index}`}
              role="listitem"
              title={invocation.detail || `${invocation.tool} · ${invocation.outcome}`}
              className={cn(
                'border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                OUTCOME_STYLES[invocation.outcome],
              )}
            >
              {invocation.tool.replace(/_/g, ' ')} · {invocation.outcome}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
