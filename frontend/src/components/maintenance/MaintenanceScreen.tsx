'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Clock, Wrench } from 'lucide-react'
import { DEFAULT_MAINTENANCE_MESSAGE } from '@polycheck/shared'
import { cn } from '@/lib/utils'
import { formatMaintenanceRemaining } from './maintenance-time'

export interface MaintenanceScreenProps {
  message?: string
  estimatedEnd?: string
  variant?: 'page' | 'overlay' | 'embedded'
  showAdminLogin?: boolean
  className?: string
}

/** Branded maintenance surface shared by the overlay, page, and login embeds. */
export function MaintenanceScreen({
  message,
  estimatedEnd,
  variant = 'page',
  showAdminLogin = true,
  className,
}: MaintenanceScreenProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const headingRef = useRef<HTMLHeadingElement | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const countdown = formatMaintenanceRemaining(estimatedEnd, nowMs)
  const fullscreen = variant !== 'embedded'

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center bg-maroon px-6 py-12 text-center text-white dark:bg-surface-dark',
        fullscreen && 'min-h-screen w-full',
        className,
      )}
    >
      <div
        className={cn(
          'w-full space-y-6 border border-golden/30 bg-maroon-dark/60 p-8 shadow-xl dark:border-golden/20 dark:bg-black/40',
          variant === 'embedded' ? 'max-w-md' : 'max-w-xl',
        )}
      >
        <div className="flex items-center justify-center gap-4">
          <Image src="/pup-logo.png" width={48} height={48} alt="PUP Logo" className="h-12 w-12 object-contain" />
          <div className="relative flex h-14 w-14 items-center justify-center">
            <Wrench
              aria-hidden
              className="h-10 w-10 animate-spin text-golden [animation-duration:6s] motion-reduce:animate-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-golden">Scheduled maintenance</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-heading text-2xl font-bold leading-tight text-white outline-none sm:text-3xl"
          >
            Polycheck is under scheduled maintenance
          </h1>
          <p className="text-sm leading-relaxed text-white/80">{message?.trim() || DEFAULT_MAINTENANCE_MESSAGE}</p>
        </div>

        {countdown.tone !== 'none' ? (
          <p
            role="status"
            aria-live="polite"
            className={cn(
              'mx-auto flex w-fit items-center gap-2 border px-4 py-2 text-xs font-bold uppercase tracking-widest',
              countdown.tone === 'overdue'
                ? 'border-golden bg-golden/10 text-golden'
                : 'border-white/30 bg-white/5 text-white',
            )}
          >
            <Clock aria-hidden className="h-4 w-4" />
            {countdown.label}
          </p>
        ) : null}

        <dl className="space-y-1 border-t border-white/15 pt-4 text-xs text-white/70">
          <div>
            <dt className="inline font-bold uppercase tracking-widest text-golden">IT desk: </dt>
            <dd className="inline">Campus MIS Office (IT Coordinator)</dd>
          </div>
          <div>
            <dt className="inline font-bold uppercase tracking-widest text-golden">Support: </dt>
            <dd className="inline">Office of the Campus Director</dd>
          </div>
        </dl>

        {showAdminLogin ? (
          <div className="pt-2">
            <Link
              href="/login/faculty"
              className="inline-block text-xs font-semibold text-golden underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-golden"
            >
              Administrator Login
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
