'use client'

import type { FormEvent } from 'react'
import { CheckCircle, Flag, GraduationCap, XCircle } from 'lucide-react'
import type { AttendanceRecord } from '@polycheck/shared'
import StatusBadge from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  DISPUTE_DESCRIPTION_MAX_LENGTH,
  DISPUTE_DESCRIPTION_MIN_LENGTH,
  isDisputeDescriptionValid,
} from '@/lib/student-dispute'

interface StudentDisputeDialogProps {
  record: AttendanceRecord | null
  reason: string
  description: string
  feedback: { type: 'success' | 'error'; message: string } | null
  subjectName: string
  submitting: boolean
  onClose: () => void
  onReasonChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onSubmit: () => void
}

export function StudentDisputeDialog(props: StudentDisputeDialogProps) {
  const descriptionValid = isDisputeDescriptionValid(props.description)
  const showLengthHint = props.description.length > 0 && !descriptionValid
  return (
    <Dialog open={Boolean(props.record)} onOpenChange={(open) => { if (!open) props.onClose() }}>
      <DialogContent className="max-w-[92vw] sm:max-w-lg">
        <DialogHeader><DialogTitle>Dispute Attendance Record</DialogTitle><DialogDescription>Report an issue with this attendance record.</DialogDescription></DialogHeader>
        {props.record ? (
          <div className="space-y-4 mt-2">
            <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <p><span className="font-bold text-zinc-900 dark:text-zinc-100">Student:</span> {props.record.studentName}</p>
              <p><span className="font-bold text-zinc-900 dark:text-zinc-100">Date:</span> {new Date(props.record.timestamp).toLocaleDateString()} at {new Date(props.record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <p><span className="font-bold text-zinc-900 dark:text-zinc-100">Session:</span> {props.subjectName}</p>
              <p><span className="font-bold text-zinc-900 dark:text-zinc-100">Status:</span> <StatusBadge status={props.record.status} /></p>
            </div>
            <div>
              <label htmlFor="dispute-reason" className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Reason</label>
              <select id="dispute-reason" value={props.reason} onChange={(event) => props.onReasonChange(event.target.value)} className="w-full h-10 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-900 dark:text-zinc-100 focus:border-maroon focus:ring-2 focus:ring-maroon/30 outline-none transition-colors">
                <option value="">Select a reason</option>
                <option value="outside_geofence">Wrong location</option>
                <option value="expired_token">Wrong time</option>
                <option value="duplicate_submission">I was present</option>
                <option value="invalid_signature">Technical issue</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <label htmlFor="dispute-description" className="block text-xs font-bold uppercase tracking-widest text-zinc-500">Description</label>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {props.description.length}/{DISPUTE_DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
              <textarea
                id="dispute-description"
                value={props.description}
                onChange={(event) => props.onDescriptionChange(event.target.value)}
                rows={3}
                maxLength={DISPUTE_DESCRIPTION_MAX_LENGTH}
                aria-describedby="dispute-description-hint"
                aria-invalid={showLengthHint}
                className="w-full rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-maroon focus:ring-2 focus:ring-maroon/30 outline-none transition-colors resize-none"
                placeholder="Describe the issue..."
              />
              <p id="dispute-description-hint" className={`mt-1 text-[10px] font-bold uppercase tracking-widest ${showLengthHint ? 'text-red-500' : 'text-zinc-400'}`}>
                At least {DISPUTE_DESCRIPTION_MIN_LENGTH} characters required
              </p>
            </div>
            {props.feedback ? <div role={props.feedback.type === 'error' ? 'alert' : 'status'} className={`text-xs font-bold uppercase tracking-widest px-3 py-2 ${props.feedback.type === 'success' ? 'text-golden bg-maroon-dark' : 'text-white bg-red-600'}`}>{props.feedback.message}</div> : null}
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <DialogClose asChild><Button variant="outline" className="rounded-none text-xs font-bold uppercase tracking-widest">Cancel</Button></DialogClose>
              <Button onClick={props.onSubmit} disabled={!props.reason || !descriptionValid || props.submitting} className="rounded-none bg-maroon text-white hover:bg-maroon-dark text-xs font-bold uppercase tracking-widest">
                <Flag className="w-3 h-3 mr-2" />
                {props.submitting ? 'Submitting...' : 'Submit Dispute'}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

interface StudentEnrollmentDialogProps {
  open: boolean
  code: string
  loading: boolean
  success: boolean
  error: string
  onOpenChange: (open: boolean) => void
  onCodeChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}

export function StudentEnrollmentDialog(props: StudentEnrollmentDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl text-maroon dark:text-golden font-heading font-bold"><GraduationCap className="w-5 h-5 text-maroon dark:text-golden" />Enroll in a Subject</DialogTitle><DialogDescription>Enter the enrollment code provided by your instructor.</DialogDescription></DialogHeader>
        <div className="space-y-4 mt-2">
          {props.success ? (
            <div className="border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4 flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" /><div><p className="text-sm font-bold text-green-700 dark:text-green-300">Successfully enrolled!</p><p className="text-xs text-green-600 dark:text-green-400 mt-1">You can now access your new subject from the dashboard.</p></div></div>
          ) : (
            <form onSubmit={props.onSubmit} className="space-y-4">
              <Input value={props.code} onChange={(event) => props.onCodeChange(event.target.value)} placeholder="Enter enrollment code" className="text-lg text-center tracking-widest font-mono uppercase rounded-none h-12" autoFocus />
              {props.error ? <div className="border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3 flex items-start gap-2"><XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><p className="text-xs text-red-600 dark:text-red-400">{props.error}</p></div> : null}
              <div className="flex flex-wrap justify-end gap-3 pt-2"><DialogClose asChild><Button type="button" variant="outline" className="rounded-none text-xs font-bold uppercase tracking-widest h-10">Cancel</Button></DialogClose><Button type="submit" disabled={props.loading} className="rounded-none bg-maroon text-white hover:bg-maroon-dark text-xs font-bold uppercase tracking-widest h-10 px-6">{props.loading ? 'Enrolling...' : 'Enroll'}</Button></div>
            </form>
          )}
          {props.success ? <div className="flex justify-end pt-2"><Button onClick={() => props.onOpenChange(false)} className="rounded-none bg-maroon text-white hover:bg-maroon-dark text-xs font-bold uppercase tracking-widest h-10 px-6">Close</Button></div> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
