'use client'

import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { describeMutationError } from '@/lib/run-mutation'
import { downloadPhotoReport, type PhotoReportScope } from '@/lib/download'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface PhotoReportButtonProps {
  scope: PhotoReportScope
  /** Used in the file name, for example the section name. */
  label: string
  text?: string
  /** Asks for an optional date range first, for a section's whole semester. */
  chooseDates?: boolean
  className?: string
}

/** Saves class photos, with their time stamps, as one PDF for the Quality Assurance Coordinator. */
export function PhotoReportButton({
  scope,
  label,
  text = 'Save photos as PDF',
  chooseDates = false,
  className,
}: PhotoReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rangeError = from && to && to < from ? 'The end date must be on or after the start date.' : null

  const download = async () => {
    if (busy || rangeError) return
    setBusy(true)
    setError(null)
    try {
      await downloadPhotoReport(scope, label, { from: from || undefined, to: to || undefined })
      setOpen(false)
    } catch (cause) {
      setError(describeMutationError(cause, 'The PDF could not be made.'))
    } finally {
      setBusy(false)
    }
  }

  const problem = (message: string) => (
    <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
      {message}
    </p>
  )
  const spinner = busy ? (
    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
  ) : (
    <FileDown className="mr-1.5 h-3.5 w-3.5" />
  )

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        disabled={busy && !chooseDates}
        onClick={() => {
          setError(null)
          if (chooseDates) setOpen(true)
          else void download()
        }}
      >
        {!chooseDates ? spinner : <FileDown className="mr-1.5 h-3.5 w-3.5" />}
        {text}
      </Button>
      {!chooseDates && error ? problem(error) : null}
      {chooseDates ? (
        <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
          <DialogContent className="max-w-md rounded-none">
            <DialogHeader>
              <DialogTitle>Class photos as PDF</DialogTitle>
              <DialogDescription>
                Photos are grouped by class meeting, each with its date and time stamp. Leave the dates empty to
                include every photo.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="photo-report-from">From class date</Label>
                <Input id="photo-report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="photo-report-to">To class date</Label>
                <Input id="photo-report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            <Button type="button" className="mt-4 w-full" disabled={busy || Boolean(rangeError)} onClick={() => void download()}>
              {spinner}
              {busy ? 'Making the PDF…' : 'Download PDF'}
            </Button>
            <div className="mt-2">{rangeError ? problem(rangeError) : error ? problem(error) : null}</div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
