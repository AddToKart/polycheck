'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface CredentialSummary {
  role: 'teacher' | 'student' | 'admin'
  name: string
  identifier: string
  password: string
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

/**
 * Shows a server-generated temporary password exactly once. The password is
 * never persisted client-side beyond this component's lifetime.
 */
export function CredentialResultDialog({
  credentials,
  onOpenChange,
}: {
  credentials: CredentialSummary | null
  onOpenChange: (open: boolean) => void
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCopied(false)
  }, [credentials])

  const copyAll = async () => {
    if (!credentials) return
    const text = [
      'Polycheck credentials',
      `Role: ${credentials.role}`,
      `Name: ${credentials.name}`,
      `Identifier: ${credentials.identifier}`,
      `Temporary password: ${credentials.password}`,
      'Change this password on first sign-in.',
    ].join('\n')
    if (await copyText(text)) setCopied(true)
  }

  return (
    <Dialog open={credentials !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-maroon/5 text-maroon dark:bg-golden/10 dark:text-golden">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl">Temporary credentials</DialogTitle>
          <DialogDescription>
            Share this password with {credentials?.name ?? 'the account holder'} in person. It will not be shown
            again, and it must be changed on first sign-in.
          </DialogDescription>
        </DialogHeader>

        {credentials ? (
          <div className="space-y-4">
            <dl className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Role</dt>
                <dd className="font-semibold capitalize text-foreground">{credentials.role}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Name</dt>
                <dd className="font-semibold text-foreground">{credentials.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Identifier</dt>
                <dd className="font-mono text-xs text-foreground">{credentials.identifier}</dd>
              </div>
              <div className="space-y-2 px-4 py-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Temporary password</dt>
                <dd className="rounded-lg bg-zinc-100 px-3 py-2 font-mono text-base font-semibold tracking-wide text-foreground dark:bg-zinc-900">
                  {credentials.password}
                </dd>
              </div>
            </dl>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="gap-2 bg-maroon text-white hover:bg-maroon-dark" onClick={() => void copyAll()}>
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy credentials'}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
