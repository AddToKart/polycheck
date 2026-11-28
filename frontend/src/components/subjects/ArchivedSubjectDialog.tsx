'use client'

import { useCallback, useEffect, useState } from 'react'
import { Archive, Download, Images, RotateCcw, Trash2 } from 'lucide-react'
import { ARCHIVE_EVIDENCE_RETENTION_DAYS, type SubjectLifecycle } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { describeMutationError } from '@/lib/run-mutation'
import { downloadPhotoReport, downloadSubjectAttendance } from '@/lib/download'
import { useTrustedNow } from '@/lib/hooks/use-trusted-now'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Days, hours, minutes and seconds until a moment; never negative. */
export function countdownParts(targetMs: number, nowMs: number) {
  const seconds = Math.max(0, Math.floor((targetMs - nowMs) / 1000))
  return {
    days: Math.floor(seconds / 86_400),
    hours: Math.floor((seconds % 86_400) / 3_600),
    minutes: Math.floor((seconds % 3_600) / 60),
    seconds: seconds % 60,
  }
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

interface ArchivedSubjectDialogProps {
  subject: { id: string; name: string; code: string } | null
  /** Teachers may restore and delete; administrators only read and export. */
  canManage: boolean
  onClose: () => void
  onRestored: () => void
  onDeleted: () => void
}

/**
 * What a professor sees on opening an archived subject: when its evidence will be erased, a way to
 * keep copies, and the two ways out. Everything else about the subject is read-only.
 */
export function ArchivedSubjectDialog({
  subject,
  canManage,
  onClose,
  onRestored,
  onDeleted,
}: ArchivedSubjectDialogProps) {
  const [lifecycle, setLifecycle] = useState<SubjectLifecycle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'export' | 'photos' | 'restore' | 'delete' | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [typedCode, setTypedCode] = useState('')
  const { nowMs, offsetMs } = useTrustedNow()
  const subjectId = subject?.id

  const load = useCallback(async () => {
    if (!subjectId) return
    setError(null)
    try {
      setLifecycle(await api.getSubjectLifecycle(subjectId))
    } catch (cause) {
      setError(describeMutationError(cause, 'Could not read the archive details.'))
    }
  }, [subjectId])

  useEffect(() => {
    setLifecycle(null)
    setConfirmingDelete(false)
    setTypedCode('')
    void load()
  }, [load])

  const run = async (action: NonNullable<typeof busy>, task: () => Promise<unknown>, done?: () => void) => {
    if (busy) return
    setBusy(action)
    setError(null)
    try {
      await task()
      done?.()
    } catch (cause) {
      setError(describeMutationError(cause))
    } finally {
      setBusy(null)
    }
  }

  if (!subject) return null

  const purgeAtMs = lifecycle?.evidencePurgeAt ? Date.parse(lifecycle.evidencePurgeAt) : null
  const left = purgeAtMs === null ? null : countdownParts(purgeAtMs, nowMs + (offsetMs ?? 0))
  const erased = lifecycle?.evidencePurgedAt ?? null
  const codeMatches = typedCode.trim().toLowerCase() === subject.code.trim().toLowerCase()

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-lg rounded-none border-t-4 border-t-maroon dark:border-t-golden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 shrink-0 text-maroon dark:text-golden" aria-hidden="true" />
            This subject is archived
          </DialogTitle>
          <DialogDescription>
            {subject.name} ({subject.code}) is hidden and read-only. Nothing in it can be changed unless you
            restore it.
          </DialogDescription>
        </DialogHeader>

        {lifecycle ? (
          <div className="mt-4 space-y-4">
            {erased ? (
              <p className="border-l-4 border-l-maroon bg-zinc-100 p-3 text-sm dark:border-l-golden dark:bg-zinc-800">
                Its class photos, excuse photos, location data and scan logs were erased on {day(erased)}.
                Attendance results are kept.
              </p>
            ) : left && lifecycle.evidencePurgeAt ? (
              <div className="bg-maroon p-4 text-white dark:bg-golden dark:text-maroon-dark">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                  Evidence is permanently erased in
                </p>
                <p
                  role="timer"
                  aria-label={`${left.days} days left`}
                  className="mt-1 font-heading text-3xl font-bold tabular-nums text-golden dark:text-maroon-dark"
                >
                  {left.days}d {String(left.hours).padStart(2, '0')}h {String(left.minutes).padStart(2, '0')}m{' '}
                  {String(left.seconds).padStart(2, '0')}s
                </p>
                <p className="mt-2 text-xs leading-relaxed">
                  On {day(lifecycle.evidencePurgeAt)}, {ARCHIVE_EVIDENCE_RETENTION_DAYS} days after archiving, its
                  class photos, excuse photos, location data and scan logs are deleted. Attendance results are
                  kept. Download the photo PDF before then.
                </p>
              </div>
            ) : null}

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {plural(lifecycle.counts.sections, 'section')} · {plural(lifecycle.counts.sessions, 'class meeting')} ·{' '}
              {plural(lifecycle.counts.attendanceRecords, 'attendance record')} ·{' '}
              {plural(lifecycle.counts.classPhotos, 'class photo')}
            </p>

            {confirmingDelete ? (
              <div className="space-y-3 border border-red-700 p-3 dark:border-red-400">
                <p className="text-sm font-bold text-red-700 dark:text-red-300">Delete this subject for good?</p>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  This deletes its sections, class meetings, photos and <strong>all attendance records</strong> right
                  now. It cannot be undone. Export the attendance records first if anyone may need them.
                </p>
                <div className="space-y-1">
                  <Label htmlFor="confirm-subject-code">
                    Type <span className="font-mono">{subject.code}</span> to confirm
                  </Label>
                  <Input
                    id="confirm-subject-code"
                    value={typedCode}
                    onChange={(event) => setTypedCode(event.target.value)}
                    autoComplete="off"
                    className="rounded-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      setConfirmingDelete(false)
                      setTypedCode('')
                    }}
                  >
                    Keep it
                  </Button>
                  <Button
                    type="button"
                    className="rounded-none bg-red-700 text-white hover:bg-red-800"
                    disabled={!codeMatches || Boolean(busy)}
                    onClick={() =>
                      void run('delete', () => api.deleteArchivedSubject(subject.id, typedCode.trim()), onDeleted)
                    }
                  >
                    {busy === 'delete' ? 'Deleting…' : 'Delete permanently'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <Button
                  type="button"
                  className="rounded-none"
                  disabled={Boolean(busy)}
                  onClick={() => void run('export', () => downloadSubjectAttendance(subject.id, subject.code))}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {busy === 'export' ? 'Preparing…' : 'Export all attendance records'}
                </Button>
                {lifecycle.counts.classPhotos > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void run('photos', () => downloadPhotoReport({ subjectId: subject.id }, subject.code))
                    }
                  >
                    <Images className="mr-2 h-4 w-4" />
                    {busy === 'photos' ? 'Preparing…' : 'Download class photos (PDF)'}
                  </Button>
                ) : null}
                {canManage ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-none"
                      disabled={Boolean(busy)}
                      onClick={() => void run('restore', () => api.restoreSubject(subject.id), onRestored)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {busy === 'restore' ? 'Restoring…' : 'Restore subject (cancels deletion)'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-none border-red-700 text-red-700 hover:bg-red-50 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950/40"
                      disabled={Boolean(busy)}
                      onClick={() => setConfirmingDelete(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete permanently…
                    </Button>
                  </>
                ) : null}
              </div>
            )}
          </div>
        ) : !error ? (
          <p className="mt-4 text-sm text-zinc-500">Loading the archive details…</p>
        ) : null}

        {error ? (
          <div role="alert" className="mt-4 border-l-4 border-l-red-700 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
            <p>{error}</p>
            {!lifecycle ? (
              <button type="button" className="mt-2 font-bold underline" onClick={() => void load()}>
                Try again
              </button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
