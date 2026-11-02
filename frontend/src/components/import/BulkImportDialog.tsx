'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react'
import {
  buildEnrollRows,
  buildStudentRows,
  IMPORT_CHUNK_SIZE,
  IMPORT_MAX_ROWS,
  mappingFieldLabel,
  parseCsv,
  suggestColumnMapping,
  type EnrollImportResult,
  type EnrollImportRow,
  type ImportColumnMapping,
  type ImportConflictMode,
  type ImportCredential,
  type ImportIssue,
  type StudentImportResult,
  type StudentImportRow,
} from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useNotifications } from '@/lib/notifications'
import { downloadCsv } from '@/lib/import/csv-download'

type ImportMode = 'students' | 'enrollments'
type Step = 'upload' | 'map' | 'validate' | 'confirm' | 'report'
type AnyRow = StudentImportRow | EnrollImportRow

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: ImportMode
  sectionId?: string
  onCompleted?: () => void
}

interface ChunkPlan {
  rows: AnyRow[]
  rowChecksum?: string
}

interface ChunkReport {
  index: number
  created: number
  updated: number
  skipped: number
  failed: number
}

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_DISPLAY_ISSUES = 100
const BLOCKING_CODES = new Set([
  'MISSING_REQUIRED_FIELD',
  'INVALID_STUDENT_NUMBER',
  'EXCEL_MANGLED_STUDENT_NUMBER',
  'DUPLICATE_IN_FILE',
])

const STUDENT_FIELDS: Array<{ key: keyof ImportColumnMapping; required?: boolean }> = [
  { key: 'studentId', required: true },
  { key: 'fullName', required: true },
  { key: 'email' },
  { key: 'program' },
  { key: 'yearLevel' },
  { key: 'department' },
]

const ENROLL_FIELDS: Array<{ key: keyof ImportColumnMapping; required?: boolean }> = [
  { key: 'studentId', required: true },
  { key: 'fullName' },
  { key: 'program' },
  { key: 'yearLevel' },
]

const FIELD_LABELS: Record<ImportMode, Partial<Record<keyof ImportColumnMapping, string>>> = {
  students: {},
  enrollments: {
    fullName: 'Student name (verification)',
    program: 'Program (verification)',
    yearLevel: 'Year level (verification)',
  },
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
}

function mergeSummaries(summaries: Array<Record<string, unknown>>): Record<string, number> {
  const merged: Record<string, number> = {}
  for (const summary of summaries) {
    for (const [key, value] of Object.entries(summary)) {
      if (typeof value === 'number') merged[key] = (merged[key] ?? 0) + value
    }
  }
  return merged
}

function issueRowsCsv(issues: ImportIssue[]): unknown[][] {
  return [
    ['Row', 'Column', 'Code', 'Message'],
    ...issues.map((issue) => [issue.rowNumber, issue.column ?? '', issue.code, issue.message]),
  ]
}

export function BulkImportDialog({ open, onOpenChange, mode, sectionId, onCompleted }: BulkImportDialogProps) {
  const { addNotification } = useNotifications()
  const [step, setStep] = useState<Step>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState<ImportColumnMapping>({})
  const [conflictMode, setConflictMode] = useState<ImportConflictMode>('skip_existing')
  const [validatedConflictMode, setValidatedConflictMode] = useState<ImportConflictMode>('skip_existing')
  const [localIssues, setLocalIssues] = useState<ImportIssue[]>([])
  const [chunks, setChunks] = useState<ChunkPlan[]>([])
  const [serverIssues, setServerIssues] = useState<ImportIssue[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [skipInvalid, setSkipInvalid] = useState(false)
  const [validating, setValidating] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState<ImportCredential[]>([])
  const [reports, setReports] = useState<ChunkReport[]>([])
  const [stopped, setStopped] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const runIdRef = useRef('')
  const stopRequestedRef = useRef(false)

  const fields = mode === 'students' ? STUDENT_FIELDS : ENROLL_FIELDS
  const blockingIssues = useMemo(
    () => localIssues.filter((issue) => BLOCKING_CODES.has(issue.code)),
    [localIssues],
  )
  const allIssues = useMemo(() => [...localIssues, ...serverIssues], [localIssues, serverIssues])

  const reset = useCallback(() => {
    setStep('upload')
    setHeaders([])
    setRawRows([])
    setFileName('')
    setMapping({})
    setConflictMode('skip_existing')
    setValidatedConflictMode('skip_existing')
    setLocalIssues([])
    setChunks([])
    setServerIssues([])
    setSummary({})
    setSkipInvalid(false)
    setValidating(false)
    setExecuting(false)
    setProgress(0)
    setError('')
    setCredentials([])
    setReports([])
    setStopped(false)
    stopRequestedRef.current = false
    runIdRef.current =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `run-${Date.now()}`
  }, [])

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  const handleFile = async (file: File) => {
    setError('')
    if (file.size > MAX_FILE_BYTES) {
      setError('That file is larger than 5 MB. Split the master list and import it in batches.')
      return
    }
    try {
      const text = await file.text()
      const parsed = parseCsv(text)
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError('No rows were found in that CSV. Export the master list again and retry.')
        return
      }
      if (parsed.rows.length > IMPORT_MAX_ROWS) {
        setError(`This file has ${parsed.rows.length} rows. The limit is ${IMPORT_MAX_ROWS.toLocaleString()} per import.`)
        return
      }
      const suggested = suggestColumnMapping(parsed.headers)
      let nextMapping = suggested
      try {
        const remembered = window.localStorage.getItem('polycheck-import-mapping')
        if (remembered) {
          const stored = JSON.parse(remembered) as { headers?: string[]; mapping?: ImportColumnMapping }
          if (stored.headers && JSON.stringify(stored.headers) === JSON.stringify(parsed.headers) && stored.mapping) {
            nextMapping = stored.mapping
          }
        }
      } catch {
        // Ignore unavailable localStorage and use the suggested mapping.
      }
      setFileName(file.name)
      setHeaders(parsed.headers)
      setRawRows(parsed.rows)
      setMapping(nextMapping)
      setStep('map')
      if (parsed.errors.length > 0) {
        addNotification('warning', 'CSV parsed with warnings', parsed.errors[0])
      }
    } catch {
      setError('That file could not be read as CSV.')
    }
  }

  const runValidation = async () => {
    if (mapping.studentId === undefined || (mode === 'students' && mapping.fullName === undefined)) {
      setError('Map the required columns before validating.')
      return
    }
    setError('')
    setValidating(true)
    setServerIssues([])
    setSummary({})
    try {
      const built = mode === 'students'
        ? buildStudentRows(rawRows, mapping)
        : buildEnrollRows(rawRows, mapping)
      if (built.rows.length === 0) {
        setLocalIssues(built.issues)
        setError('No importable rows were found. Fix the blocking issues and upload again.')
        return
      }
      if (built.rows.length > IMPORT_MAX_ROWS) {
        setError(`This file has ${built.rows.length} importable rows. The limit is ${IMPORT_MAX_ROWS.toLocaleString()}.`)
        return
      }
      setLocalIssues(built.issues)
      setSkipInvalid(false)
      setCredentials([])
      setReports([])

      const rowChunks = chunk(built.rows as AnyRow[], IMPORT_CHUNK_SIZE)
      const plans: ChunkPlan[] = rowChunks.map((rows) => ({ rows }))
      const issues: ImportIssue[] = []
      const summaries: Array<Record<string, unknown>> = []
      let hasMoreIssues = false

      for (let index = 0; index < plans.length; index += 1) {
        const result = await validateChunk(plans[index], index)
        plans[index].rowChecksum = result.rowChecksum
        issues.push(...result.issues)
        summaries.push(result.summary as unknown as Record<string, unknown>)
        hasMoreIssues = hasMoreIssues || result.hasMoreIssues
      }

      if (hasMoreIssues) {
        issues.push({
          rowNumber: 0,
          code: 'FIELD_UPDATE_PREVIEW',
          message: 'More issues exist than are shown. Download the issues CSV for the full list.',
        })
      }
      try {
        window.localStorage.setItem('polycheck-import-mapping', JSON.stringify({ headers, mapping }))
      } catch {
        // Remembering the mapping is a convenience only.
      }
      setChunks(plans)
      setServerIssues(issues)
      setSummary(mergeSummaries(summaries))
      setValidatedConflictMode(conflictMode)
      setStep('validate')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Validation failed.')
    } finally {
      setValidating(false)
    }
  }

  const validateChunk = async (
    plan: ChunkPlan,
    index: number,
  ): Promise<StudentImportResult | EnrollImportResult> => {
    if (mode === 'students') {
      return api.importStudents({
        mode: 'validate',
        conflictMode,
        rows: plan.rows as StudentImportRow[],
        idempotencyKey: `${runIdRef.current}-validate-${index}`,
      })
    }
    if (!sectionId) throw new Error('Section is required for enrollment imports.')
    return api.previewEnrollImport(sectionId, plan.rows as EnrollImportRow[])
  }

  const executeChunk = async (plan: ChunkPlan, index: number): Promise<StudentImportResult | EnrollImportResult> => {
    if (!plan.rowChecksum) throw new Error('Validate the rows again before importing.')
    if (mode === 'students') {
      return api.importStudents({
        mode: 'execute',
        conflictMode,
        rows: plan.rows as StudentImportRow[],
        rowChecksum: plan.rowChecksum,
        idempotencyKey: `${runIdRef.current}-execute-${index}`,
      })
    }
    if (!sectionId) throw new Error('Section is required for enrollment imports.')
    return api.importSectionEnrollments(sectionId, {
      mode: 'execute',
      rows: plan.rows as EnrollImportRow[],
      rowChecksum: plan.rowChecksum,
      idempotencyKey: `${runIdRef.current}-execute-${index}`,
    })
  }

  const runCommit = async (startIndex = 0, plans: ChunkPlan[] = chunks) => {
    setExecuting(true)
    setError('')
    setStopped(false)
    setProgress(startIndex)
    stopRequestedRef.current = false
    const collectedCredentials: ImportCredential[] = []
    const collectedReports: ChunkReport[] = []
    let failure: string | null = null

    for (let index = startIndex; index < plans.length; index += 1) {
      try {
        const result = await executeChunk(plans[index], index)
        const numeric = result.summary as unknown as Record<string, number>
        collectedReports.push({
          index,
          created: numeric.new ?? numeric.enrollable ?? 0,
          updated: numeric.update ?? 0,
          skipped: numeric.skip ?? 0,
          failed: numeric.invalid ?? 0,
        })
        if ('credentials' in result && result.credentials) {
          collectedCredentials.push(...result.credentials)
        }
        setProgress(index + 1)
        if (stopRequestedRef.current) break
      } catch (cause) {
        failure = cause instanceof Error ? cause.message : 'Import chunk failed.'
        break
      }
    }

    setCredentials(collectedCredentials)
    setReports(collectedReports)
    setExecuting(false)
    if (failure) {
      setError(`${failure} Chunks already committed are safe to retry; the import is idempotent.`)
      return
    }
    if (stopRequestedRef.current && collectedReports.length < plans.length - startIndex) {
      setError('Import stopped after the current chunk. The remaining rows were not imported.')
      return
    }
    setStep('report')
    addNotification(
      'success',
      'Import completed',
      collectedCredentials.length > 0
        ? 'Download the credentials CSV now — temporary passwords are shown only once.'
        : 'The roster was updated successfully.',
    )
    onCompleted?.()
  }

  const retryRemaining = async () => {
    const remaining = chunks.slice(progress)
    if (remaining.length === 0) return
    setValidating(true)
    setError('')
    try {
      const refreshed: ChunkPlan[] = []
      for (let index = 0; index < remaining.length; index += 1) {
        const result = await validateChunk(remaining[index], progress + index)
        refreshed.push({ rows: remaining[index].rows, rowChecksum: result.rowChecksum })
      }
      const nextChunks = [...chunks]
      nextChunks.splice(progress, remaining.length, ...refreshed)
      setChunks(nextChunks)
      setValidating(false)
      await runCommit(progress, nextChunks)
    } catch (cause) {
      setValidating(false)
      setError(cause instanceof Error ? cause.message : 'Could not re-validate the remaining rows.')
    }
  }

  const downloadCredentials = () => {
    downloadCsv('polycheck-temporary-credentials.csv', [
      ['Row', 'Student number', 'Temporary password'],
      ...credentials.map((credential) => [credential.rowNumber, credential.studentId, credential.tempPassword]),
    ])
  }

  const downloadIssues = () => {
    downloadCsv('polycheck-import-issues.csv', issueRowsCsv(allIssues))
  }

  const downloadFailedRows = () => {
    const failedRowNumbers = new Set(allIssues.map((issue) => issue.rowNumber))
    const failed: unknown[][] = [
      [...headers, 'Issue codes'],
      ...rawRows
        .map((row, index) => ({ row, rowNumber: index + 2 }))
        .filter(({ rowNumber }) => failedRowNumbers.has(rowNumber))
        .map(({ row, rowNumber }) => [
          ...row,
          allIssues.filter((issue) => issue.rowNumber === rowNumber).map((issue) => issue.code).join(' '),
        ]),
    ]
    downloadCsv('polycheck-failed-rows.csv', failed)
  }

  const close = (nextOpen: boolean) => {
    if (executing) return
    onOpenChange(nextOpen)
    if (!nextOpen) reset()
  }

  const mergeColumn = (key: keyof ImportColumnMapping, value: string) => {
    setMapping((current) => {
      const next = { ...current }
      if (value === '') delete next[key]
      else next[key] = Number(value)
      return next
    })
  }

  const steps: Array<{ id: Step; label: string }> = [
    { id: 'upload', label: 'Upload' },
    { id: 'map', label: 'Map columns' },
    { id: 'validate', label: 'Validate' },
    { id: 'confirm', label: 'Confirm' },
    { id: 'report', label: 'Report' },
  ]
  const currentStepIndex = steps.findIndex((item) => item.id === step)

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'students' ? 'Import students' : 'Import section enrollment'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'students'
              ? 'Register students from a CSV master list. Passwords are generated once and must be handed out in person.'
              : 'Enroll your section from a CSV class list. Existing accounts are matched by student number.'}
          </DialogDescription>
        </DialogHeader>

        <ol className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest" aria-label="Import steps">
          {steps.map((item, index) => (
            <li
              key={item.id}
              aria-current={item.id === step ? 'step' : undefined}
              className={
                item.id === step
                  ? 'border-b-2 border-maroon px-1 pb-1 text-maroon dark:border-golden dark:text-golden'
                  : index < currentStepIndex
                    ? 'px-1 pb-1 text-emerald-600 dark:text-emerald-400'
                    : 'px-1 pb-1 text-zinc-400'
              }
            >
              {index + 1}. {item.label}
            </li>
          ))}
        </ol>

        {error ? (
          <div role="alert" className="mt-4 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {step === 'upload' ? (
          <div className="mt-5 space-y-4">
            <div
              className="flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-zinc-300 px-6 py-12 text-center transition-colors hover:border-golden dark:border-zinc-700"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const file = event.dataTransfer.files[0]
                if (file) void handleFile(file)
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click()
              }}
            >
              <Upload className="h-8 w-8 text-maroon dark:text-golden" aria-hidden="true" />
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">Drop a CSV here or choose a file</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Up to 5 MB and 5,000 rows. Excel files must be exported as CSV.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleFile(file)
                  event.target.value = ''
                }}
              />
            </div>
            {fileName ? <p className="text-xs text-zinc-500 dark:text-zinc-400">Selected: {fileName}</p> : null}
          </div>
        ) : null}

        {step === 'map' ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Found {rawRows.length.toLocaleString()} rows and {headers.length} columns in <span className="font-semibold">{fileName}</span>. Confirm the mapping:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map(({ key, required }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`map-${key}`}>
                    {FIELD_LABELS[mode][key] ?? mappingFieldLabel(key)}
                    {required ? <span className="text-red-500"> *</span> : null}
                  </Label>
                  <select
                    id={`map-${key}`}
                    value={mapping[key] ?? ''}
                    onChange={(event) => mergeColumn(key, event.target.value)}
                    className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">Not mapped</option>
                    {headers.map((header, index) => (
                      <option key={`${header}-${index}`} value={index}>
                        {header || `Column ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => void runValidation()} disabled={validating}>
                {validating ? 'Validating…' : 'Validate rows'}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'validate' ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-2 sm:grid-cols-4">
              <SummaryTile label="Rows in file" value={rawRows.length} />
              <SummaryTile label="Importable" value={chunks.reduce((total, item) => total + item.rows.length, 0)} />
              <SummaryTile label="Server-valid" value={summary.valid ?? 0} />
              <SummaryTile label="Issues" value={allIssues.length} />
            </div>

            {mode === 'students' ? (
              <fieldset className="space-y-2 border border-zinc-200 p-3 dark:border-zinc-700">
                <legend className="px-1 text-xs font-bold uppercase tracking-widest text-zinc-500">Existing students</legend>
                <label className="flex items-start gap-2 text-sm">
                  <input type="radio" checked={conflictMode === 'skip_existing'} onChange={() => setConflictMode('skip_existing')} className="mt-1" />
                  <span>Skip existing accounts (recommended).</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="radio" checked={conflictMode === 'update_existing'} onChange={() => setConflictMode('update_existing')} className="mt-1" />
                  <span>Update profile fields (name, email, program, year, department) without touching passwords.</span>
                </label>
                {conflictMode !== validatedConflictMode ? (
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Re-validate to apply the new rule before continuing.</p>
                ) : null}
              </fieldset>
            ) : null}

            {blockingIssues.length > 0 ? (
              <div className="border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  {blockingIssues.length} row{blockingIssues.length === 1 ? '' : 's'} cannot be imported
                </p>
                <p className="mt-1 text-xs">Fix them in the CSV and re-upload, or explicitly continue with the valid rows only.</p>
                <label className="mt-2 flex items-center gap-2 text-xs font-semibold">
                  <input type="checkbox" checked={skipInvalid} onChange={(event) => setSkipInvalid(event.target.checked)} />
                  Continue with the valid rows only
                </label>
              </div>
            ) : null}

            <IssueTable issues={allIssues} onDownload={downloadIssues} />

            <div className="flex flex-wrap justify-between gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('map')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void runValidation()} disabled={validating}>
                  Re-validate
                </Button>
                <Button
                  onClick={() => setStep('confirm')}
                  disabled={(blockingIssues.length > 0 && !skipInvalid) || conflictMode !== validatedConflictMode}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 'confirm' ? (
          <div className="mt-5 space-y-4">
            <div className="border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
              <p className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                Ready to import {chunks.reduce((total, item) => total + item.rows.length, 0).toLocaleString()} students in {chunks.length} chunk{chunks.length === 1 ? '' : 's'}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-600 dark:text-zinc-400">
                <li>Each chunk commits atomically; stopping after a chunk keeps earlier chunks.</li>
                {mode === 'students' ? (
                  <li>Temporary passwords are generated server-side and shown once in the report.</li>
                ) : (
                  <li>Students without accounts are reported, not auto-created, unless the institution enables provisioning.</li>
                )}
              </ul>
            </div>

            {executing ? (
              <div className="space-y-2" role="status" aria-live="polite">
                <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-700">
                  <div className="h-2 bg-maroon dark:bg-golden" style={{ width: `${Math.round((progress / Math.max(1, chunks.length)) * 100)}%` }} />
                </div>
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  Chunk {Math.min(progress + 1, chunks.length)} of {chunks.length}…
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-between gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('validate')} disabled={executing}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                {executing ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      stopRequestedRef.current = true
                      setStopped(true)
                    }}
                    disabled={stopped}
                  >
                    {stopped ? 'Stopping…' : 'Stop after this chunk'}
                  </Button>
                ) : null}
                <Button onClick={() => void runCommit()} disabled={executing || validating}>
                  {executing ? 'Importing…' : 'Import now'}
                </Button>
              </div>
            </div>

            {error && progress > 0 && progress < chunks.length ? (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => void retryRemaining()} disabled={validating || executing}>
                  {validating ? 'Re-validating…' : 'Retry remaining chunks'}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 'report' ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-2 border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Import finished
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              <SummaryTile label="Created" value={reports.reduce((total, item) => total + item.created, 0)} />
              <SummaryTile label="Updated" value={reports.reduce((total, item) => total + item.updated, 0)} />
              <SummaryTile label="Skipped" value={reports.reduce((total, item) => total + item.skipped, 0)} />
              <SummaryTile label="Failed" value={reports.reduce((total, item) => total + item.failed, 0) + localIssues.filter((issue) => BLOCKING_CODES.has(issue.code)).length} />
            </div>

            {credentials.length > 0 ? (
              <section className="space-y-2 border border-golden/50 bg-golden/10 p-4 dark:bg-golden/5">
                <h3 className="text-sm font-bold text-maroon-dark dark:text-golden">Temporary credentials — display once</h3>
                <p className="text-xs text-zinc-700 dark:text-zinc-300">
                  Print or hand these out in person. Do not email or message them. Lost passwords require an admin reset.
                </p>
                <div className="max-h-48 overflow-y-auto border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-surface-dark">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800">
                      <tr>
                        <th className="px-3 py-2 text-left">Student number</th>
                        <th className="px-3 py-2 text-left">Temporary password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {credentials.map((credential) => (
                        <tr key={`${credential.studentId}-${credential.rowNumber}`} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="px-3 py-1.5 font-mono">{credential.studentId}</td>
                          <td className="px-3 py-1.5 font-mono">{credential.tempPassword}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button variant="outline" onClick={downloadCredentials}>Download credentials CSV</Button>
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {allIssues.length > 0 ? <Button variant="outline" onClick={downloadIssues}>Download issues CSV</Button> : null}
              {allIssues.length > 0 ? <Button variant="outline" onClick={downloadFailedRows}>Download failed rows CSV</Button> : null}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => close(false)}>Close</Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-zinc-200 px-3 py-2 dark:border-zinc-700">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">{value.toLocaleString()}</p>
    </div>
  )
}

function IssueTable({ issues, onDownload }: { issues: ImportIssue[]; onDownload: () => void }) {
  const visible = issues.slice(0, MAX_DISPLAY_ISSUES)
  if (visible.length === 0) {
    return <p className="text-sm text-emerald-700 dark:text-emerald-400">No issues found.</p>
  }
  return (
    <div className="space-y-2">
      <div className="max-h-56 overflow-y-auto border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th className="px-3 py-2 text-left">Row</th>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Message</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((issue, index) => (
              <tr key={`${issue.rowNumber}-${issue.code}-${index}`} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-1.5">{issue.rowNumber || '—'}</td>
                <td className="px-3 py-1.5 font-mono">{issue.code}</td>
                <td className="px-3 py-1.5">{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {issues.length > MAX_DISPLAY_ISSUES ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Showing the first {MAX_DISPLAY_ISSUES} of {issues.length} issues.</p>
      ) : null}
      <Button variant="outline" size="sm" onClick={onDownload}>Download issues CSV</Button>
    </div>
  )
}
