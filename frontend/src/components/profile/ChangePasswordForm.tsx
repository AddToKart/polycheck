'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import type { User } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { useNotifications } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const PASSWORD_RULES: { test: (value: string) => boolean; message: string }[] = [
  { test: (value) => value.length >= 12, message: 'Use at least 12 characters.' },
  { test: (value) => /[a-z]/.test(value), message: 'Include a lowercase letter.' },
  { test: (value) => /[A-Z]/.test(value), message: 'Include an uppercase letter.' },
  { test: (value) => /[0-9]/.test(value), message: 'Include a number.' },
  { test: (value) => /[^A-Za-z0-9]/.test(value), message: 'Include a special character.' },
]

/**
 * Authenticated self-service rotation. Requires the current password, keeps
 * this session valid, and signs out every other session (authVersion bump).
 */
export function ChangePasswordForm({ user, onUpdated }: { user: User; onUpdated: (user: User) => void }) {
  const { addNotification } = useNotifications()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const failedRule = PASSWORD_RULES.find((rule) => !rule.test(newPassword))
    if (failedRule) {
      setError(failedRule.message)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The password confirmation does not match.')
      return
    }
    if (!currentPassword) {
      setError('Enter your current password.')
      return
    }
    setSubmitting(true)
    try {
      const updated = await api.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onUpdated(updated)
      addNotification('success', 'Password changed', 'Other signed-in devices were signed out.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to change the password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <div className="space-y-2">
        <Label htmlFor="profile-current-password">Current password</Label>
        <Input
          id="profile-current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-new-password">New password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <Input
              id="profile-new-password"
              type="password"
              autoComplete="new-password"
              className="pl-9"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={12}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-confirm-password">Confirm new password</Label>
          <Input
            id="profile-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={12}
            required
          />
        </div>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        At least 12 characters with lowercase, uppercase, number, and special character. Changing your password signs
        out every other device; this session stays signed in.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={submitting} className="bg-maroon text-white hover:bg-maroon-dark">
        {submitting ? 'Changing…' : 'Change password'}
      </Button>
      <p className="sr-only">Signed in as {user.fullName}</p>
    </form>
  )
}
