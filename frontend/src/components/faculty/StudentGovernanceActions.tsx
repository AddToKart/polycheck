'use client'

import { useEffect, useState } from 'react'
import { KeyRound, ShieldAlert, Smartphone } from 'lucide-react'
import type { DelegatedTeacherPermissions, EmergencyDeviceReleaseReason, User } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { formatCooldownRemaining, cooldownRemainingMinutes } from '@polycheck/shared/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CredentialResultDialog, type CredentialSummary } from '@/components/admin/credential-result-dialog'
import { useNotifications } from '@/lib/notifications'

const REASONS: { value: EmergencyDeviceReleaseReason; label: string }[] = [
  { value: 'dead_battery', label: 'Dead battery' },
  { value: 'lost_or_damaged', label: 'Lost or damaged phone' },
  { value: 'borrowed_device', label: 'Borrowed device' },
  { value: 'other', label: 'Other reason' },
]

interface StudentGovernanceActionsProps {
  student: Pick<User, 'id' | 'fullName' | 'studentId' | 'deviceCooldownUntil' | 'deviceBoundAt'>
  sectionId: string | null
  permissions?: DelegatedTeacherPermissions | null
  onChanged?: () => void
}

/**
 * Teacher-facing delegated actions for one student in a section context:
 * issue a temporary password and release a bound/locked device. Both calls are
 * re-authorized server-side (policy, per-teacher override, enrollment).
 */
export function StudentGovernanceActions({
  student,
  sectionId,
  permissions,
  onChanged,
}: StudentGovernanceActionsProps) {
  const { addNotification } = useNotifications()
  const [confirmReset, setConfirmReset] = useState(false)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [reason, setReason] = useState<EmergencyDeviceReleaseReason>('lost_or_damaged')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState<CredentialSummary | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const cooldownMinutes = cooldownRemainingMinutes(student.deviceCooldownUntil ?? null, nowMs)

  useEffect(() => {
    if (cooldownMinutes === null) return
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [cooldownMinutes])

  if (!sectionId) return null
  if (permissions && !permissions.canResetStudentPasswords && !permissions.canEmergencyUnbindDevices) {
    return null
  }

  const canReset = permissions ? permissions.canResetStudentPasswords : true
  const canRelease = permissions ? permissions.canEmergencyUnbindDevices : true

  const handleReset = async () => {
    setSubmitting(true)
    setError('')
    try {
      const result = await api.teacherResetStudentPassword(student.id, sectionId)
      setConfirmReset(false)
      setCredentials({
        role: 'student',
        name: student.fullName,
        identifier: student.studentId ?? student.id,
        password: result.temporaryPassword,
      })
      onChanged?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reset this student password')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRelease = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api.emergencyReleaseDevice(student.id, {
        sectionId,
        reason,
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      setReleaseOpen(false)
      setNote('')
      addNotification(
        'success',
        'Device released',
        `${student.fullName} can sign in on a device again. The action was audited.`,
      )
      onChanged?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to release this student device')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {student.deviceCooldownUntil && cooldownMinutes !== null ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
          Device locked · {formatCooldownRemaining(cooldownMinutes)} left
        </span>
      ) : student.deviceBoundAt ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
          Device bound
        </span>
      ) : null}

      {canReset ? (
        <Button type="button" variant="outline" className="gap-2" onClick={() => setConfirmReset(true)}>
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Reset password
        </Button>
      ) : null}

      {canRelease ? (
        <Button type="button" variant="outline" className="gap-2" onClick={() => setReleaseOpen(true)}>
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          Emergency device release
        </Button>
      ) : null}

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset {student.fullName}&apos;s password?</DialogTitle>
            <DialogDescription>
              A new temporary password will be generated and shown once. All of this student&apos;s sessions will be
              revoked, and they must change the password on their next sign-in.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-maroon text-white hover:bg-maroon-dark"
              disabled={submitting}
              onClick={() => void handleReset()}
            >
              {submitting ? 'Generating…' : 'Generate temporary password'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emergency device release</DialogTitle>
            <DialogDescription>
              Clears {student.fullName}&apos;s bound device and any cooldown so they can sign in immediately. The
              reason is recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void handleRelease(event)}>
            <div className="space-y-2">
              <Label htmlFor="release-reason">Reason</Label>
              <select
                id="release-reason"
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                value={reason}
                onChange={(event) => setReason(event.target.value as EmergencyDeviceReleaseReason)}
              >
                {REASONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="release-note">Note (optional)</Label>
              <Input
                id="release-note"
                value={note}
                maxLength={280}
                placeholder="Context the teacher wants on record"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setReleaseOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Releasing…' : 'Release device'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CredentialResultDialog credentials={credentials} onOpenChange={(open) => { if (!open) setCredentials(null) }} />
    </div>
  )
}
