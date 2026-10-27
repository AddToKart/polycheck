'use client'

import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Send, X } from 'lucide-react'
import type { AttendanceRecord } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import {
  EXCUSE_REASON_OPTIONS,
  fileToDataUrl,
  validateExcuseEvidence,
  validateExcuseForm,
  type ExcuseFormErrors,
} from '@/lib/excuse'
import { useNotifications } from '@/lib/notifications'
import StatusBadge from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface StudentExcuseDialogProps {
  record: AttendanceRecord | null
  subjectName: string
  onClose: () => void
  onSubmitted: () => void
}

interface EvidenceState {
  name: string
  size: number
  data: string
}

export function StudentExcuseDialog({ record, subjectName, onClose, onSubmitted }: StudentExcuseDialogProps) {
  const { addNotification } = useNotifications()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [evidence, setEvidence] = useState<EvidenceState | null>(null)
  const [errors, setErrors] = useState<ExcuseFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    setReason('')
    setDescription('')
    setEvidence(null)
    setErrors({})
    setSubmitError('')
    setSubmitting(false)
  }, [record?.id])

  const handleEvidence = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const fileError = validateExcuseEvidence(file)
    if (fileError) {
      setErrors((current) => ({ ...current, evidence: fileError }))
      event.target.value = ''
      return
    }
    try {
      const data = await fileToDataUrl(file)
      setEvidence({ name: file.name, size: file.size, data })
      setErrors((current) => ({ ...current, evidence: undefined }))
    } catch (cause) {
      setErrors((current) => ({
        ...current,
        evidence: cause instanceof Error ? cause.message : 'The selected photo could not be read.',
      }))
    }
  }

  const removeEvidence = () => {
    setEvidence(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!record) return
    setSubmitError('')
    const validation = validateExcuseForm({
      reason,
      description,
      evidenceBytes: evidence?.size,
      evidenceData: evidence?.data,
    })
    if (!validation.ok) {
      setErrors(validation.errors)
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      await api.requestExcuse(record.id, validation.value)
      addNotification('success', 'Excuse Requested', 'Your teacher will review the request.')
      onSubmitted()
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'The excuse request could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={Boolean(record)} onOpenChange={(open) => { if (!open && !submitting) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto dark:border-golden/15 dark:bg-surface-dark">
        <DialogHeader>
          <DialogTitle className="dark:text-white">Request an excuse</DialogTitle>
          <DialogDescription>
            Explain why you could not attend. The teacher reviews every request.
          </DialogDescription>
        </DialogHeader>

        {record ? (
          <div className="mt-2 space-y-4">
            <div className="space-y-1 border-b border-zinc-200 pb-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              <p>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">Subject:</span> {subjectName}
              </p>
              <p>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">Date:</span>{' '}
                {new Date(record.timestamp).toLocaleDateString()} at{' '}
                {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">Status:</span>{' '}
                <StatusBadge status={record.status} />
              </p>
            </div>

            <div>
              <label htmlFor="excuse-reason" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-zinc-500">
                Reason <span aria-hidden="true">*</span>
              </label>
              <select
                id="excuse-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-invalid={Boolean(errors.reason)}
                aria-describedby={errors.reason ? 'excuse-reason-error' : undefined}
                className="h-10 w-full rounded-none border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-maroon focus:ring-2 focus:ring-maroon/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">Select a reason</option>
                {EXCUSE_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {errors.reason ? (
                <p id="excuse-reason-error" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.reason}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="excuse-description" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-zinc-500">
                Description <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="excuse-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? 'excuse-description-error' : undefined}
                placeholder="Describe what happened (at least 10 characters)…"
                className="w-full resize-none rounded-none border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-maroon focus:ring-2 focus:ring-maroon/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              {errors.description ? (
                <p id="excuse-description-error" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.description}</p>
              ) : null}
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-zinc-500">
                Supporting photo <span className="font-medium normal-case tracking-normal text-zinc-400">(optional, max 5 MB)</span>
              </span>
              {evidence ? (
                <div className="flex items-center gap-3 border border-zinc-200 p-2 dark:border-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={evidence.data} alt="Selected excuse evidence" className="h-12 w-12 shrink-0 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-zinc-700 dark:text-zinc-300">{evidence.name}</p>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-400">
                      {(evidence.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={removeEvidence}
                    className="p-1 text-zinc-400 transition-colors hover:text-red-600"
                    aria-label="Remove attached photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    id="excuse-evidence"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => void handleEvidence(event)}
                  />
                  <label
                    htmlFor="excuse-evidence"
                    className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-none border border-zinc-300 bg-white px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-maroon hover:text-maroon dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-golden dark:hover:text-golden"
                  >
                    <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                    Attach photo
                  </label>
                </div>
              )}
              {errors.evidence ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.evidence}</p>
              ) : null}
            </div>

            {submitError ? (
              <div role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                {submitError}
              </div>
            ) : null}

            <div className="flex justify-end gap-3 pt-2">
              <DialogClose asChild>
                <Button variant="outline" className="rounded-none text-xs font-bold uppercase tracking-widest" disabled={submitting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="rounded-none bg-maroon text-white text-xs font-bold uppercase tracking-widest hover:bg-maroon-dark"
              >
                <Send className="h-3 w-3" aria-hidden="true" />
                {submitting ? 'Submitting…' : 'Submit request'}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

