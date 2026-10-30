'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bug, Paperclip, X } from 'lucide-react'
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  REPORT_SEVERITIES,
  REPORT_SEVERITY_LABELS,
} from '@polycheck/shared'
import { REPORT_STATUS_LABELS } from '@polycheck/shared'
import { CreateSystemReportSchema } from '@polycheck/shared/validation'
import type { ReportCategory, ReportSeverity } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { collectWebReportTelemetry } from '@/lib/report-telemetry'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNotifications } from '@/lib/notifications'

const MAX_SCREENSHOT_BYTES = 5_000_000

const CATEGORY_HINTS: Record<ReportCategory, string> = {
  scanner_camera: 'QR camera not opening, unreadable codes, black screen.',
  geofence_gps: 'False outside-geofence, poor location accuracy, GPS timeout.',
  ui_display: 'Layout glitch, cut-off text, dark mode contrast.',
  enrollment_roster: 'Invalid section code, missing from the class list.',
  account_login: 'Session dropped, device binding / cooldown.',
  feedback_suggestion: 'Feature ideas and general feedback.',
}

/**
 * Accessible issue intake for students and teachers. Placement is decided by
 * the host surface (sidebar, profile); the dialog never navigates away.
 */
export function ReportIssueDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { addNotification } = useNotifications()
  const [category, setCategory] = useState<ReportCategory>('scanner_camera')
  const [severity, setSeverity] = useState<ReportSeverity>('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [screenshot, setScreenshot] = useState<{ dataUrl: string; name: string } | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setCategory('scanner_camera')
    setSeverity('medium')
    setTitle('')
    setDescription('')
    setScreenshot(null)
    setError('')
  }, [open])

  const attachFile = (file: File | undefined | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Attachments must be images (PNG, JPEG, or WebP).')
      return
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setError('Screenshots must be 5 MB or smaller.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setScreenshot({ dataUrl: reader.result, name: file.name })
        setError('')
      }
    }
    reader.readAsDataURL(file)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const telemetry = collectWebReportTelemetry()
    const parsed = CreateSystemReportSchema.safeParse({
      category,
      severity,
      title,
      description,
      ...(screenshot ? { screenshotData: screenshot.dataUrl } : {}),
      ...telemetry,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.')
      return
    }
    setSubmitting(true)
    try {
      await api.createSystemReport(parsed.data)
      onOpenChange(false)
      addNotification(
        'success',
        'Report submitted',
        'Thanks! Super admins will review it — track the status in Profile → My reports.',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit the report. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-maroon/5 text-maroon dark:bg-golden/10 dark:text-golden">
            <Bug className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl">Report an issue</DialogTitle>
          <DialogDescription>
            Tell us what went wrong or share feedback. Diagnostics like your page, browser, and connection are
            attached automatically — no personal files are ever collected.
          </DialogDescription>
        </DialogHeader>

        <form className="mt-3 space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="space-y-2">
            <Label htmlFor="report-category">Category</Label>
            <select
              id="report-category"
              className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              value={category}
              onChange={(event) => setCategory(event.target.value as ReportCategory)}
            >
              {REPORT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {REPORT_CATEGORY_LABELS[item]}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{CATEGORY_HINTS[category]}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-severity">Severity</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Severity">
              {REPORT_SEVERITIES.map((item) => {
                const selected = severity === item
                return (
                  <button
                    key={item}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-testid={`severity-${item}`}
                    onClick={() => setSeverity(item)}
                    className={
                      selected
                        ? 'rounded-full bg-maroon px-3.5 py-1.5 text-xs font-bold text-white'
                        : 'rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                    }
                  >
                    {REPORT_SEVERITY_LABELS[item]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-title">Title</Label>
            <Input
              id="report-title"
              value={title}
              minLength={5}
              maxLength={120}
              placeholder="5-120 characters summarizing the issue"
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-description">Description</Label>
            <textarea
              id="report-description"
              value={description}
              minLength={10}
              maxLength={4_000}
              rows={5}
              placeholder="What happened? What did you expect? Steps to reproduce help a lot."
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Optional screenshot</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" aria-hidden="true" />
                {screenshot ? 'Replace image' : 'Attach image'}
              </Button>
              {screenshot ? (
                <span className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {/* object/data URLs are not optimizable next/image sources */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screenshot.dataUrl}
                    alt={`Screenshot preview ${screenshot.name}`}
                    className="h-10 w-10 rounded border border-zinc-200 object-cover dark:border-zinc-800"
                  />
                  <span className="max-w-40 truncate">{screenshot.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove screenshot ${screenshot.name}`}
                    className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    onClick={() => setScreenshot(null)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ) : null}
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              data-testid="report-file-input"
              onChange={(event) => {
                attachFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 border-l-4 border-red-600 bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-maroon text-white hover:bg-maroon-dark">
              {submitting ? 'Submitting…' : 'Submit report'}
            </Button>
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Reports are visible only to administrators. Track yours under Profile → My reports ({REPORT_STATUS_LABELS.open.toLowerCase()} by default).
          </p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
