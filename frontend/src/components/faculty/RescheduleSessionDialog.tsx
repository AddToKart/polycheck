'use client'

import { useState } from 'react'
import { formatCampusDate, sessionTimeIssue, SESSION_ROOM_MAX_LENGTH, type Session } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { describeMutationError } from '@/lib/run-mutation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface RescheduleSessionDialogProps {
  session: Session
  /** Shown under the title, for example the subject and section. */
  label: string
  onClose: () => void
  onSaved: (session: Session) => void
}

/** Moves a class that has not started to another date, time or room. */
export function RescheduleSessionDialog({ session, label, onClose, onSaved }: RescheduleSessionDialogProps) {
  const [date, setDate] = useState(session.date)
  const [startTime, setStartTime] = useState(session.startTime)
  const [endTime, setEndTime] = useState(session.endTime)
  const [room, setRoom] = useState(session.room ?? '')
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const today = formatCampusDate()

  const moved = date !== session.date || startTime !== session.startTime || endTime !== session.endTime
  const changed = moved || room.trim() !== (session.room ?? '').trim()
  const problem = !date
    ? 'Choose a date.'
    : (sessionTimeIssue(startTime, endTime) ??
      (moved && date < today ? 'A class cannot be moved to a past date.' : null))

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving || problem || !changed) return
    setSaving(true)
    setFailure(null)
    try {
      onSaved(await api.rescheduleSession(session.id, { date, startTime, endTime, room: room.trim() }))
    } catch (cause) {
      setFailure(describeMutationError(cause, 'The class could not be moved.'))
    } finally {
      setSaving(false)
    }
  }

  const message = failure ?? (changed ? problem : null)

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-md rounded-none">
        <DialogHeader>
          <DialogTitle>Reschedule class</DialogTitle>
          <DialogDescription>
            {label}. It will be labelled Rescheduled, with the original date kept.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="mt-4 space-y-4" noValidate>
          <div className="space-y-1">
            <Label htmlFor="reschedule-date">New date</Label>
            <Input
              id="reschedule-date"
              type="date"
              min={today}
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                setFailure(null)
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="reschedule-start">Start time</Label>
              <Input
                id="reschedule-start"
                type="time"
                value={startTime}
                onChange={(event) => {
                  setStartTime(event.target.value)
                  setFailure(null)
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reschedule-end">End time</Label>
              <Input
                id="reschedule-end"
                type="time"
                value={endTime}
                onChange={(event) => {
                  setEndTime(event.target.value)
                  setFailure(null)
                }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="reschedule-room">Room</Label>
            <Input
              id="reschedule-room"
              value={room}
              maxLength={SESSION_ROOM_MAX_LENGTH}
              onChange={(event) => {
                setRoom(event.target.value)
                setFailure(null)
              }}
            />
          </div>
          {message ? (
            <p role="alert" className="border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {message}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-none" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-none" disabled={saving || !changed || Boolean(problem)}>
              {saving ? 'Saving…' : 'Reschedule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
