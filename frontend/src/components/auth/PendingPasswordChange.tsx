'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import type { User } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function validatePassword(password: string): string | null {
  if (password.length < 12) return 'Use at least 12 characters.'
  if (!/[a-z]/.test(password)) return 'Include a lowercase letter.'
  if (!/[A-Z]/.test(password)) return 'Include an uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Include a number.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Include a special character.'
  return null
}

/**
 * Forced first-login rotation for bulk-provisioned/admin-reset accounts. The
 * temporary-password session may call change-password without the old password.
 */
export function PendingPasswordChange({
  user,
  onDone,
  onCancel,
}: {
  user: User
  onDone: (user: User) => void
  onCancel?: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const validation = validatePassword(password)
    if (validation) {
      setError(validation)
      return
    }
    if (password !== confirmPassword) {
      setError('The password confirmation does not match.')
      return
    }
    setSubmitting(true)
    try {
      const updated = await api.changePassword(undefined, password)
      onDone(updated)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to change the password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="change-password-title" className="w-full">
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">
          Temporary password
        </p>
        <h2 id="change-password-title" className="text-3xl font-heading font-bold text-foreground">
          Choose a new password
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {user.fullName}, your account was created with a temporary password. Change it before continuing.
        </p>
      </div>

      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        {error ? (
          <div role="alert" className="border-l-4 border-red-600 bg-red-50 p-4 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="new-password" className="uppercase tracking-widest text-xs text-zinc-500">
            New password
          </Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex w-12 items-center justify-center border border-r-0 border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
              <Lock className="h-5 w-5 text-zinc-500" aria-hidden="true" />
            </div>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 rounded-none border-zinc-200 pl-16 text-lg dark:border-zinc-700"
              required
              minLength={12}
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            At least 12 characters with lowercase, uppercase, number, and special character.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="uppercase tracking-widest text-xs text-zinc-500">
            Confirm new password
          </Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-12 rounded-none border-zinc-200 text-lg dark:border-zinc-700"
            required
            minLength={12}
          />
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Button
            type="submit"
            disabled={submitting}
            className="h-12 flex-1 rounded-none bg-maroon text-base font-bold uppercase tracking-wide text-white hover:bg-maroon-dark"
          >
            {submitting ? 'Saving…' : 'Change password'}
          </Button>
          {onCancel ? (
            <Button type="button" variant="outline" className="h-12 rounded-none" onClick={onCancel}>
              Sign out
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
