'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, Mail, Upload } from 'lucide-react'
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
  type StudentImportDeliveryMode,
  type StudentImportResult,
  type StudentImportRow,
} from '@polycheck/shared'
import { api, type ActivationStatus } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useNotifications } from '@/lib/notifications'
import { downloadCsv } from '@/lib/import/csv-download'
import { fingerprintHeaders, loadMappingProfile, saveMappingProfile } from '@/lib/import/mapping-profiles'
import { parseSpreadsheetFile, SpreadsheetParseError, type SpreadsheetSheet } from '@/lib/import/spreadsheet-parser'

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
  const [workbook, setWorkbook] = useState<{ file: File; sheets: SpreadsheetSheet[]; sheetName: string } | null>(null)
  const [mapping, setMapping] = useState<ImportColumnMapping>({})
  const [conflictMode, setConflictMode] = useState<ImportConflictMode>('skip_existing')
  const [validatedConflictMode, setValidatedConflictMode] = useState<ImportConflictMode>('skip_existing')
  const [deliveryMode, setDeliveryMode] = useState<StudentImportDeliveryMode>('temporary_password')
  const [validatedDeliveryMode, setValidatedDeliveryMode] = useState<StudentImportDeliveryMode>('temporary_password')
  const [activationStatus, setActivationStatus] = useState<ActivationStatus | null>(null)
  const [activationReport, setActivationReport] = useState<{ queued: number; fallbackTemporary: number } | null>(null)
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
  // Email delivery is offered only when an admin enabled it AND the server can actually send.
  const activationAvailable = Boolean(activationStatus?.enabled && activationStatus.configured)
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
    setWorkbook(null)
    setMapping({})
    setConflictMode('skip_existing')
    setValidatedConflictMode('skip_existing')
    setDeliveryMode('temporary_password')
    setValidatedDeliveryMode('temporary_password')
    setActivationReport(null)
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

  // Offer email delivery only when the server says it can actually send; any failure just hides it.
  useEffect(() => {
    if (!open || mode !== 'students') return
    let active = true
    api
      .getActivationStatus()
      .then((status) => {
        if (active) setActivationStatus(status)
      })
      .catch(() => {
        if (active) setActivationStatus(null)
      })
    return () => {
      active = false
    }
  }, [open, mode])

  /** Shared by the CSV and Excel paths: validate size, pick the remembered or suggested mapping, move on. */
  const applyTable = async (
    name: string,
    parsed: { headers: string[]; rows: string[][]; errors: string[] },
    source: 'CSV' | 'Excel',
  ) => {
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setError(`No rows were found in that ${source === 'CSV' ? 'CSV' : 'sheet'}. Export the master list again and retry.`)
      return false
    }
    if (parsed.rows.length > IMPORT_MAX_ROWS) {
      setError(`This file has ${parsed.rows.length} rows. The limit is ${IMPORT_MAX_ROWS.toLocaleString()} per import.`)
      return false
    }
    // A layout confirmed before maps itself: this browser's memory first, then the shared profiles other
    // administrators confirmed; anything new gets the heuristic suggestion. Never blocks on the network.
    const nextMapping =
      loadMappingProfile(parsed.headers) ??
      (await loadSharedMapping(mode, parsed.headers)) ??
      suggestColumnMapping(parsed.headers)
    setFileName(name)
    setHeaders(parsed.headers)
    setRawRows(parsed.rows)
    setMapping(nextMapping)
    setStep('map')
    if (parsed.errors.length > 0) {
      addNotification('warning', `${source} parsed with warnings`, parsed.errors[0])
    }
    return true
  }

  const readWorkbook = async (file: File, sheetName?: string) => {
    try {
      const parsed = await parseSpreadsheetFile(file, sheetName)
      if (await applyTable(file.name, parsed, 'Excel')) {
        setWorkbook({ file, sheets: parsed.sheets, sheetName: parsed.sheetName })
      }
    } catch (cause) {
      setError(
        cause instanceof SpreadsheetParseError
          ? cause.message
          : 'That Excel file could not be read. Re-save it from Excel as .xlsx or CSV and try again.',
      )
    }
  }

  const handleFile = async (file: File) => {
    setError('')
    const name = file.name.toLowerCase()
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      setError('PDF master lists are not supported yet. Upload the Excel (.xlsx) or CSV version, or ask the registrar for it.')
      return
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || file.type.includes('spreadsheetml') || file.type === 'application/vnd.ms-excel') {
      await readWorkbook(file)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('That file is larger than 5 MB. Split the master list and import it in batches.')
      return
    }
    try {
      setWorkbook(null)
      await applyTable(file.name, parseCsv(await file.text()), 'CSV')
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
      saveMappingProfile(headers, mapping)
      void saveSharedMapping(mode, headers, mapping)
      setChunks(plans)
      setServerIssues(issues)
      setSummary(mergeSummaries(summaries))
      setValidatedConflictMode(conflictMode)
      setValidatedDeliveryMode(deliveryMode)
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
        ...(deliveryMode === 'activation_email' ? { deliveryMode } : {}),
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
        // The checksum was minted for the validated mode, so execute must use exactly that one.
        ...(validatedDeliveryMode === 'activation_email' ? { deliveryMode: validatedDeliveryMode } : {}),
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

    const activationTotals = { queued: 0, fallbackTemporary: 0 }
    let sawActivation = false
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
        if ('activation' in result && result.activation) {
          activationTotals.queued += result.activation.queued
          activationTotals.fallbackTemporary += result.activation.fallbackTemporary
          sawActivation = true
        }
        setProgress(index + 1)
        if (stopRequestedRef.current) break
      } catch (cause) {
        failure = cause instanceof Error ? cause.message : 'Import chunk failed.'
        break
      }
    }

    setCredentials(collectedCredentials)
    setActivationReport(sawActivation ? activationTotals : null)
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
        : sawActivation
          ? 'Activation emails are on their way to the new students.'
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
                <p className="font-bold text-zinc-900 dark:text-zinc-100">Drop a CSV or Excel file here, or choose a file</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">CSV up to 5 MB, Excel (.xlsx) up to 10 MB, 5,000 rows per import.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
            {workbook && workbook.sheets.filter((sheet) => sheet.rowCount > 0).length > 1 ? (
              <div className="space-y-1.5">
                <Label htmlFor="import-sheet">Sheet</Label>
                <select
                  id="import-sheet"
                  value={workbook.sheetName}
                  onChange={(event) => void readWorkbook(workbook.file, event.target.value)}
                  className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {workbook.sheets
                    .filter((sheet) => sheet.rowCount > 0)
                    .map((sheet) => (
                      <option key={sheet.name} value={sheet.name}>
                        {sheet.name} ({Math.max(0, sheet.rowCount - 1).toLocaleString()} rows)
                      </option>
                    ))}
                </select>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  This workbook has several sheets. Import one sheet at a time.
                </p>
              </div>
            ) : null}

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

            {mode === 'students' && activationAvailable ? (
              <fieldset className="space-y-2 border border-zinc-200 p-3 dark:border-zinc-700">
                <legend className="px-1 text-xs font-bold uppercase tracking-widest text-zinc-500">How new students get access</legend>
                <label className="flex items-start gap-2 text-sm">
                  <input type="radio" checked={deliveryMode === 'temporary_password'} onChange={() => setDeliveryMode('temporary_password')} className="mt-1" />
                  <span>Temporary passwords (shown once, hand them out in person).</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="radio" checked={deliveryMode === 'activation_email'} onChange={() => setDeliveryMode('activation_email')} className="mt-1" />
                  <span>
                    Email an activation link. Students choose their own password. Rows without an email still get a
                    temporary password.
                  </span>
                </label>
                {deliveryMode !== validatedDeliveryMode ? (
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Re-validate to apply the new delivery method before continuing.</p>
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

            {mode === 'enrollments' ? <MissingAccountsNotice issues={allIssues} /> : null}

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
                  disabled={
                    (blockingIssues.length > 0 && !skipInvalid) ||
                    conflictMode !== validatedConflictMode ||
                    deliveryMode !== validatedDeliveryMode
                  }
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
                {mode === 'students' && validatedDeliveryMode === 'activation_email' ? (
                  <li>Students with an email receive a single-use activation link; the others get a temporary password shown once in the report.</li>
                ) : mode === 'students' ? (
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

            {activationReport ? (
              <div role="status" className="flex items-start gap-2 border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  <span className="font-bold">{activationReport.queued.toLocaleString()}</span> activation email
                  {activationReport.queued === 1 ? '' : 's'} queued
                  {activationReport.fallbackTemporary > 0
                    ? `, and ${activationReport.fallbackTemporary.toLocaleString()} student${activationReport.fallbackTemporary === 1 ? '' : 's'} without an email got a temporary password below`
                    : ''}
                  . Delivery can take a few minutes; you can follow it in User Management under “Awaiting activation”.
                </p>
              </div>
            ) : null}

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

            {mode === 'enrollments' ? <MissingAccountsNotice issues={allIssues} /> : null}

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

/** The shared profile for this layout, or null (offline, not allowed, unknown layout, slow server). */
async function loadSharedMapping(
  mode: 'students' | 'enrollments',
  headers: string[],
): Promise<ImportColumnMapping | null> {
  try {
    const result = await Promise.race([
      api.getImportMappingProfile(mode, fingerprintHeaders(headers)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_500)),
    ])
    return (result?.mapping as ImportColumnMapping | null | undefined) ?? null
  } catch {
    return null
  }
}

/** Share a confirmed layout with the other administrators. Best effort: a failure is invisible. */
async function saveSharedMapping(
  mode: 'students' | 'enrollments',
  headers: string[],
  mapping: ImportColumnMapping,
): Promise<void> {
  try {
    await api.saveImportMappingProfile({ mode, fingerprint: fingerprintHeaders(headers), headers, mapping })
  } catch {
    // Sharing is a convenience; the local profile already saved.
  }
}

/**
 * Teachers can only enroll students who already have an account (the registrar creates
 * accounts). Say so plainly, with the count, instead of leaving a column of "not found" rows.
 */
function MissingAccountsNotice({ issues }: { issues: ImportIssue[] }) {
  const missing = new Set(issues.filter((issue) => issue.code === 'STUDENT_NOT_FOUND').map((issue) => issue.rowNumber)).size
  if (missing === 0) return null
  return (
    <div role="status" className="flex items-start gap-2 border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-bold">{missing.toLocaleString()}</span> student{missing === 1 ? ' has' : 's have'} no Polycheck
        account yet. Ask the registrar to import the master list first (accounts and activation emails), then run this
        import again — students who are already enrolled are skipped.
      </p>
    </div>
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
