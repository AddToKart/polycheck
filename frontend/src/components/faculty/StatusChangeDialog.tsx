'use client'

import { useState } from 'react'
import type { AttendanceStatus, EditableAttendanceStatus } from '@polycheck/shared'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const CHOICES: readonly EditableAttendanceStatus[] = ['present', 'late', 'incomplete', 'absent']

const label = (status: AttendanceStatus) => status.charAt(0).toUpperCase() + status.slice(1)

interface StatusChangeDialogProps {
  studentName: string
  /** What is being changed, for example "this meeting" or a date. */
  context: string
  current: AttendanceStatus
  /** Already picked when the professor pressed a status button. */
  initial?: EditableAttendanceStatus
  onConfirm: (status: EditableAttendanceStatus) => void
  onClose: () => void
}

/** Nothing about a student's attendance changes until this is confirmed. */
export function StatusChangeDialog({
  studentName,
  context,
  current,
  initial,
  onConfirm,
  onClose,
}: StatusChangeDialogProps) {
  const [next, setNext] = useState<EditableAttendanceStatus | null>(initial ?? null)
  const changes = next !== null && next !== current

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-none" role="alertdialog">
        <DialogHeader>
          <DialogTitle>Change attendance status?</DialogTitle>
          <DialogDescription>
            {studentName}, {context}. This replaces the recorded status and is logged as set by you.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="New status">
          {CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={next === choice}
              disabled={choice === current}
              onClick={() => setNext(choice)}
              className={`h-10 border text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                next === choice
                  ? 'border-maroon bg-maroon text-white dark:border-golden dark:bg-golden dark:text-maroon-dark'
                  : 'border-zinc-300 text-zinc-700 hover:border-maroon dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-golden'
              }`}
            >
              {label(choice)}
              {choice === current ? ' (now)' : ''}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm" aria-live="polite">
          {changes ? (
            <>
              <strong>{label(current)}</strong> will change to <strong>{label(next)}</strong>.
            </>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">Choose the new status.</span>
          )}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-none" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="rounded-none" disabled={!changes} onClick={() => changes && onConfirm(next)}>
            Confirm change
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
