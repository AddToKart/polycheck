'use client'

import { useState } from 'react'
import { Archive } from 'lucide-react'
import { ARCHIVE_EVIDENCE_RETENTION_DAYS, type Subject } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { describeMutationError } from '@/lib/run-mutation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Hides a finished subject. The confirmation says what happens to its evidence, and when. */
export function ArchiveSubjectButton({ subject, onArchived }: { subject: Subject; onArchived: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const archive = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.archiveSubject(subject.id)
      setOpen(false)
      onArchived()
    } catch (cause) {
      setError(describeMutationError(cause, 'Could not archive this subject.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 rounded-none text-[10px] font-bold uppercase tracking-widest"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        <Archive className="mr-1 h-4 w-4" /> Archive subject
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle>Archive {subject.code}?</DialogTitle>
            <DialogDescription>For the end of a semester. You can restore it later.</DialogDescription>
          </DialogHeader>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
            <li>The subject and its sections disappear from your lists and your students&rsquo; lists.</li>
            <li>Nothing in it can be changed while it is archived.</li>
            <li>
              After {ARCHIVE_EVIDENCE_RETENTION_DAYS} days its class photos, excuse photos, location data and scan
              logs are <strong>permanently erased</strong>.
            </li>
            <li>Attendance results are kept.</li>
          </ul>
          {error ? (
            <p role="alert" className="mt-4 border-l-4 border-l-red-700 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-none" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-none" disabled={busy} onClick={() => void archive()}>
              {busy ? 'Archiving…' : 'Archive subject'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
