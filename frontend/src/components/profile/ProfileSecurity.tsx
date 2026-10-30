'use client'

import { useEffect, useState } from 'react'
import type { User } from '@polycheck/shared'
import { cooldownRemainingMinutes, formatCooldownRemaining } from '@polycheck/shared/utils'
import { api } from '@/lib/api-client'
import { useNotifications } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ContactSettingsForm({ user, onUpdated }: { user: User; onUpdated: (user: User) => void }) {
  const { addNotification } = useNotifications()
  const [contactEmail, setContactEmail] = useState(user.contactEmail ?? '')
  const [contactPhone, setContactPhone] = useState(user.contactPhone ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const dirty = contactEmail !== (user.contactEmail ?? '') || contactPhone !== (user.contactPhone ?? '')

  useEffect(() => {
    setContactEmail(user.contactEmail ?? '')
    setContactPhone(user.contactPhone ?? '')
  }, [user.contactEmail, user.contactPhone])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const updated = await api.updateContacts({
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
      })
      onUpdated(updated)
      addNotification('success', 'Contacts updated', 'Your secondary contact details were saved.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save contact details.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-contact-email">Personal email</Label>
          <Input
            id="profile-contact-email"
            type="email"
            value={contactEmail}
            placeholder="you@example.com"
            onChange={(event) => setContactEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-contact-phone">Emergency mobile number</Label>
          <Input
            id="profile-contact-phone"
            type="tel"
            value={contactPhone}
            placeholder="+63 917 123 4567"
            onChange={(event) => setContactPhone(event.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        These are secondary contact channels for your account. Clear a field and save to remove it; your PUP sign-in
        identity never changes here.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || !dirty} className="bg-maroon text-white hover:bg-maroon-dark">
          {submitting ? 'Saving…' : 'Save contacts'}
        </Button>
        {dirty ? <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Unsaved changes</span> : null}
      </div>
    </form>
  )
}

export function DevicePanel({
  user,
  onUpdated,
  onLoggedOut,
}: {
  user: User
  onUpdated: (user: User) => void
  onLoggedOut: () => void
}) {
  const { addNotification } = useNotifications()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())

  const cooldownMinutes = cooldownRemainingMinutes(user.deviceCooldownUntil ?? null, nowMs)

  useEffect(() => {
    if (cooldownMinutes === null) return
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [cooldownMinutes])

  const unregister = async () => {
    setSubmitting(true)
    setError('')
    try {
      const result = await api.unregisterDevice(user.boundDeviceId ?? '')
      onUpdated(result.user)
      setConfirmOpen(false)
      addNotification('success', 'Device unregistered', result.message)
      await api.logout()
      onLoggedOut()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to unregister this device.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Bound mobile device</p>
        {user.boundDeviceId ? (
          <div className="mt-2 space-y-1">
            <p className="font-mono text-sm text-foreground">Android device · …{user.boundDeviceId.slice(-6)}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Bound {user.deviceBoundAt ? new Date(user.deviceBoundAt).toLocaleString('en-PH') : 'recently'}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            No device is bound. Sign in on the Polycheck Android app to bind this account to a device.
          </p>
        )}
        {cooldownMinutes !== null ? (
          <p className="mt-3 inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            Mobile sign-ins locked · {formatCooldownRemaining(cooldownMinutes)} left
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm font-semibold text-foreground">Unregister this device</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Use this when you are switching to a new phone. Your mobile sessions end immediately and new mobile sign-ins
          are locked for the institution&apos;s cooldown window (default 2 hours). Your instructor can release you
          sooner.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={() => setConfirmOpen(true)}
        >
          Unregister this device
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unregister this device?</DialogTitle>
            <DialogDescription>
              Unregistering will lock your account from logging into another device for the cooldown window (default 2
              hours). Proceed?
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            This device will be signed out. Ask your instructor for an emergency device release if you need access
            before the cooldown ends.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-maroon text-white hover:bg-maroon-dark"
              disabled={submitting}
              onClick={() => void unregister()}
            >
              {submitting ? 'Unregistering…' : 'Unregister'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
