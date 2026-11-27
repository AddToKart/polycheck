'use client'

import {
  AI_TERMS_ACCEPT_LABEL,
  AI_TERMS_INTRO,
  AI_TERMS_SECTIONS,
  AI_TERMS_TITLE,
  AI_TERMS_VERSION,
} from '@polycheck/shared'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PRIVACY_POLICY_URL } from '@/lib/legal'

interface TermsGateProps {
  /** Host name of the provider that will receive messages. */
  provider?: string
  accepting: boolean
  error: string | null
  onAccept: () => void
  /** Present when the assistant is in a panel that can be closed. */
  onDecline?: () => void
}

/** Shown before a person's first message: how their information is handled. */
export function TermsGate({ provider, accepting, error, onAccept, onDecline }: TermsGateProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        tabIndex={0}
        role="region"
        aria-label="AI assistant terms"
      >
        <div className="mx-auto max-w-xl">
          <ShieldCheck className="h-6 w-6 text-maroon dark:text-golden" aria-hidden="true" />
          <h3 className="mt-2 font-heading text-lg font-bold text-foreground">{AI_TERMS_TITLE}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{AI_TERMS_INTRO}</p>
          {provider ? (
            <p className="mt-3 border-l-2 border-maroon pl-3 text-sm text-foreground dark:border-golden">
              AI provider in use: <strong className="break-all">{provider}</strong>
            </p>
          ) : null}
          {AI_TERMS_SECTIONS.map((section) => (
            <section key={section.heading} className="mt-4">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-maroon dark:text-golden">
                {section.heading}
              </h4>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline underline-offset-2 hover:text-maroon dark:hover:text-golden"
            >
              Read the Privacy Policy
            </a>{' '}
            · Terms version {AI_TERMS_VERSION}
          </p>
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-300 p-3 dark:border-zinc-800">
        {error ? (
          <p role="alert" className="mb-2 text-xs text-maroon dark:text-golden">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          {onDecline ? (
            <Button
              type="button"
              variant="outline"
              onClick={onDecline}
              disabled={accepting}
              className="min-h-11 rounded-none text-[11px] font-bold uppercase tracking-widest"
            >
              Not now
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={onAccept}
            disabled={accepting}
            className="min-h-11 flex-1 rounded-none bg-maroon text-[11px] font-bold uppercase tracking-widest text-golden hover:bg-maroon-dark sm:flex-none dark:bg-golden dark:text-maroon-dark dark:hover:bg-golden-dark"
          >
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {AI_TERMS_ACCEPT_LABEL}
          </Button>
        </div>
      </div>
    </div>
  )
}
