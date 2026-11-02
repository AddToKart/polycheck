import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import * as Crypto from 'expo-crypto'
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
import { api } from '../services/api-client'
import { shareCsvFile } from '../services/file-sharing'
import { useTheme } from '../theme/ThemeContext'
import { useCampusToast } from './CampusToast'
import { CampusButton, CampusCard } from './CampusPrimitives'

type BulkImportMode = 'students' | 'enrollments'
type ImportStep = 'input' | 'map' | 'review' | 'report'
type AnyRow = StudentImportRow | EnrollImportRow

interface BulkImportSheetProps {
  visible: boolean
  onClose: () => void
  mode: BulkImportMode
  sectionId?: string
  onCompleted?: () => void
}

interface ChunkPlan {
  rows: AnyRow[]
  rowChecksum?: string
}

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

const FIELD_LABELS: Partial<Record<keyof ImportColumnMapping, string>> = {
  fullName: 'Student name (verification)',
  program: 'Program (verification)',
  yearLevel: 'Year level (verification)',
}

function chunkRows<T>(items: T[], size: number): T[][] {
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

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${guarded.replace(/"/g, '""')}"`
}

function csv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function BulkImportSheet({ visible, onClose, mode, sectionId, onCompleted }: BulkImportSheetProps) {
  const { isDark } = useTheme()
  const { showToast } = useCampusToast()
  const [step, setStep] = useState<ImportStep>('input')
  const [text, setText] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ImportColumnMapping>({})
  const [openField, setOpenField] = useState<keyof ImportColumnMapping | null>(null)
  const [conflictMode, setConflictMode] = useState<ImportConflictMode>('skip_existing')
  const [localIssues, setLocalIssues] = useState<ImportIssue[]>([])
  const [issues, setIssues] = useState<ImportIssue[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [chunks, setChunks] = useState<ChunkPlan[]>([])
  const [credentials, setCredentials] = useState<ImportCredential[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [completedCounts, setCompletedCounts] = useState({ created: 0, updated: 0, skipped: 0, failed: 0 })
  const runIdRef = useRef('')
  const stopRequestedRef = useRef(false)

  const fields = mode === 'students' ? STUDENT_FIELDS : ENROLL_FIELDS
  const blockingCount = localIssues.filter((issue) => BLOCKING_CODES.has(issue.code)).length

  const reset = useCallback(() => {
    setStep('input')
    setText('')
    setHeaders([])
    setRawRows([])
    setMapping({})
    setOpenField(null)
    setConflictMode('skip_existing')
    setLocalIssues([])
    setIssues([])
    setSummary({})
    setChunks([])
    setCredentials([])
    setBusy(false)
    setProgress(0)
    setError('')
    setCompletedCounts({ created: 0, updated: 0, skipped: 0, failed: 0 })
    stopRequestedRef.current = false
    runIdRef.current = Crypto.randomUUID()
  }, [])

  useEffect(() => {
    if (visible) reset()
  }, [visible, reset])

  const parseInput = async () => {
    setError('')
    const parsed = parseCsv(text)
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setError('Paste the master list first (include the header row).')
      return
    }
    if (parsed.rows.length > IMPORT_MAX_ROWS) {
      setError(`This list has ${parsed.rows.length} rows. The limit is ${IMPORT_MAX_ROWS.toLocaleString()}.`)
      return
    }
    setHeaders(parsed.headers)
    setRawRows(parsed.rows)
    setMapping(suggestColumnMapping(parsed.headers))
    setStep('map')
    if (parsed.errors.length > 0) showToast('warning', 'CSV parsed with warnings', parsed.errors[0])
  }

  const pasteFromClipboard = async () => {
    try {
      const value = await Clipboard.getStringAsync()
      if (!value.trim()) {
        showToast('info', 'Clipboard empty', 'Copy the master list from Sheets or Files first.')
        return
      }
      setText(value)
    } catch {
      showToast('error', 'Clipboard unavailable', 'Paste the list manually.')
    }
  }

  const validateRows = async () => {
    if (mapping.studentId === undefined || (mode === 'students' && mapping.fullName === undefined)) {
      setError('Map the required columns first.')
      return
    }
    setBusy(true)
    setError('')
    setIssues([])
    try {
      const built = mode === 'students'
        ? buildStudentRows(rawRows, mapping)
        : buildEnrollRows(rawRows, mapping)
      if (built.rows.length === 0) {
        setLocalIssues(built.issues)
        setError('No importable rows. Fix the blocking issues and paste again.')
        return
      }
      setLocalIssues(built.issues)
      const plans: ChunkPlan[] = chunkRows(built.rows as AnyRow[], IMPORT_CHUNK_SIZE).map((rows) => ({ rows }))
      const collected: ImportIssue[] = []
      const summaries: Array<Record<string, unknown>> = []
      for (let index = 0; index < plans.length; index += 1) {
        const result = await validateChunk(plans[index], index)
        plans[index].rowChecksum = result.rowChecksum
        collected.push(...result.issues)
        summaries.push(result.summary as unknown as Record<string, unknown>)
      }
      setChunks(plans)
      setIssues(collected)
      setSummary(mergeSummaries(summaries))
      setStep('review')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Validation failed.')
    } finally {
      setBusy(false)
    }
  }

  const validateChunk = async (plan: ChunkPlan, index: number): Promise<StudentImportResult | EnrollImportResult> => {
    if (mode === 'students') {
      return api.importStudents({
        mode: 'validate',
        conflictMode,
        rows: plan.rows as StudentImportRow[],
        idempotencyKey: `${runIdRef.current}-v-${index}`.slice(0, 128),
      })
    }
    if (!sectionId) throw new Error('Section is required.')
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
        idempotencyKey: `${runIdRef.current}-e-${index}`.slice(0, 128),
      })
    }
    if (!sectionId) throw new Error('Section is required.')
    return api.importSectionEnrollments(sectionId, {
      mode: 'execute',
      rows: plan.rows as EnrollImportRow[],
      rowChecksum: plan.rowChecksum,
      idempotencyKey: `${runIdRef.current}-e-${index}`.slice(0, 128),
    })
  }

  const executeImport = async () => {
    setBusy(true)
    setError('')
    setProgress(0)
    stopRequestedRef.current = false
    const collectedCredentials: ImportCredential[] = []
    const counts = { created: 0, updated: 0, skipped: 0, failed: 0 }
    try {
      for (let index = 0; index < chunks.length; index += 1) {
        const result = await executeChunk(chunks[index], index)
        const numeric = result.summary as unknown as Record<string, number>
        counts.created += numeric.new ?? numeric.enrollable ?? 0
        counts.updated += numeric.update ?? 0
        counts.skipped += numeric.skip ?? 0
        counts.failed += numeric.invalid ?? 0
        if ('credentials' in result && result.credentials) {
          collectedCredentials.push(...result.credentials)
        }
        setProgress(index + 1)
        if (stopRequestedRef.current) break
      }
      setCredentials(collectedCredentials)
      setCompletedCounts(counts)
      setStep('report')
      showToast('success', 'Import finished', collectedCredentials.length > 0 ? 'Share the temporary credentials now; they are shown once.' : 'The roster was updated.')
      onCompleted?.()
    } catch (cause) {
      setCredentials(collectedCredentials)
      setCompletedCounts(counts)
      setError(
        `${cause instanceof Error ? cause.message : 'Import chunk failed.'} Committed chunks are safe to retry.`,
      )
    } finally {
      setBusy(false)
    }
  }

  const shareCredentials = async () => {
    const contents = csv([
      ['Row', 'Student number', 'Temporary password'],
      ...credentials.map((credential) => [credential.rowNumber, credential.studentId, credential.tempPassword]),
    ])
    try {
      await shareCsvFile(contents, 'polycheck-temporary-credentials.csv', 'Share temporary credentials')
    } catch (cause) {
      showToast('error', 'Unable to share credentials', cause instanceof Error ? cause.message : 'Try again.')
    }
  }

  const copyIssues = async () => {
    if (issues.length === 0) return
    const contents = csv([
      ['Row', 'Column', 'Code', 'Message'],
      ...issues.map((issue) => [issue.rowNumber, issue.column ?? '', issue.code, issue.message]),
    ])
    await Clipboard.setStringAsync(contents)
    showToast('success', 'Issues copied', 'Paste into a note or spreadsheet to review them.')
  }

  const goBack = () => {
    if (busy) return
    if (step === 'review') setStep('map')
    else if (step === 'map') setStep('input')
    else onClose()
  }

  const close = () => {
    if (busy) return
    reset()
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1 justify-end bg-black/80" onPress={close}>
        <Pressable onPress={() => undefined} className="max-h-[94%] rounded-t-[36px] border-t-2 border-x border-maroon/20 bg-white px-5 pb-10 pt-4 shadow-2xl dark:border-golden/25 dark:bg-surface-dark">
          <View className="mb-4 h-1.5 w-14 self-center rounded-full bg-maroon/30 dark:bg-golden/40" />
          <View className="mb-3 flex-row items-start gap-4">
            <View className="flex-1">
              <Text className="font-heading text-2xl text-ink dark:text-white">
                {mode === 'students' ? 'Import students' : 'Import section roster'}
              </Text>
              <Text className="mt-2 font-sans text-xs leading-5 text-muted dark:text-zinc-400">
                {step === 'input'
                  ? 'Paste the master list from Sheets or Files as CSV (header row included).'
                  : step === 'map'
                    ? `Confirm how ${headers.length} columns map to Polycheck fields.`
                    : step === 'review'
                      ? 'Review the validation summary before committing.'
                      : 'Import finished. Hand out temporary credentials in person.'}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close import" testID="bulk-import-close" onPress={close} className="h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/10">
              <MaterialIcons name="close" size={21} color={isDark ? '#FFFFFF' : '#181113'} />
            </Pressable>
          </View>

          {error ? (
            <View className="mb-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
              <Text accessibilityRole="alert" className="font-sans text-xs leading-5 text-red-700 dark:text-red-300">{error}</Text>
            </View>
          ) : null}

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} className="mt-1">
            {step === 'input' ? (
              <View className="gap-4" testID="bulk-import-input">
                <TextInput
                  multiline
                  accessibilityLabel="Paste CSV master list"
                  testID="bulk-import-paste-input"
                  value={text}
                  onChangeText={setText}
                  placeholder={'Student No.,Name,Program,Year Level\n2024-00001-MN-0,Dela Cruz Juan,BSIT,1st Year'}
                  placeholderTextColor={isDark ? '#71717A' : '#8A8284'}
                  className="min-h-52 rounded-2xl border border-line bg-zinc-50 px-4 py-3 font-mono text-xs text-ink dark:border-line-dark dark:bg-black/30 dark:text-white"
                  textAlignVertical="top"
                />
                <View className="flex-row gap-2">
                  <CampusButton className="flex-1" variant="secondary" label="Paste from clipboard" icon="content-paste" onPress={() => void pasteFromClipboard()} />
                  <CampusButton className="flex-1" label="Continue" icon="arrow-forward" testID="bulk-import-continue" disabled={!text.trim()} onPress={() => void parseInput()} />
                </View>
                <Text className="font-sans text-[11px] leading-5 text-muted dark:text-zinc-400">
                  CSV only. Up to {IMPORT_MAX_ROWS.toLocaleString()} rows. Excel files should be saved as CSV with the student-number column formatted as text.
                </Text>
              </View>
            ) : null}

            {step === 'map' ? (
              <View className="gap-3" testID="bulk-import-map">
                {fields.map(({ key, required }) => {
                  const selected = mapping[key]
                  return (
                    <View key={key} className="rounded-2xl border border-line bg-zinc-50 p-3 dark:border-line-dark dark:bg-black/20">
                      <Text className="font-sans-bold text-[11px] uppercase tracking-wider text-muted dark:text-zinc-400">
                        {FIELD_LABELS[key] ?? mappingFieldLabel(key)}
                        {required ? ' *' : ''}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Map ${mappingFieldLabel(key)} column`}
                        onPress={() => setOpenField((current) => (current === key ? null : key))}
                        className="mt-2 min-h-11 flex-row items-center justify-between rounded-xl border border-line bg-white px-3 dark:border-line-dark dark:bg-surface-dark"
                      >
                        <Text className="font-sans text-sm text-ink dark:text-white">
                          {selected === undefined ? 'Not mapped' : headers[selected] || `Column ${selected + 1}`}
                        </Text>
                        <MaterialIcons name={openField === key ? 'expand-less' : 'expand-more'} size={20} color={isDark ? '#FFDF00' : '#7B1113'} />
                      </Pressable>
                      {openField === key ? (
                        <View className="mt-2 flex-row flex-wrap gap-2">
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                              setMapping((current) => {
                                const next = { ...current }
                                delete next[key]
                                return next
                              })
                              setOpenField(null)
                            }}
                            className={`min-h-9 justify-center rounded-full border px-3 ${selected === undefined ? 'border-maroon bg-maroon/10 dark:border-golden' : 'border-line dark:border-line-dark'}`}
                          >
                            <Text className="font-sans text-xs text-ink dark:text-white">Not mapped</Text>
                          </Pressable>
                          {headers.map((header, index) => (
                            <Pressable
                              key={`${header}-${index}`}
                              accessibilityRole="button"
                              onPress={() => {
                                setMapping((current) => ({ ...current, [key]: index }))
                                setOpenField(null)
                              }}
                              className={`min-h-9 justify-center rounded-full border px-3 ${selected === index ? 'border-maroon bg-maroon/10 dark:border-golden' : 'border-line dark:border-line-dark'}`}
                            >
                              <Text className="font-sans text-xs text-ink dark:text-white">{header || `Column ${index + 1}`}</Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  )
                })}
                {mode === 'students' ? (
                  <View className="rounded-2xl border border-line p-3 dark:border-line-dark">
                    <Text className="font-sans-bold text-[11px] uppercase tracking-wider text-muted dark:text-zinc-400">Existing students</Text>
                    <View className="mt-2 flex-row gap-2">
                      {([
                        { id: 'skip_existing' as const, label: 'Skip existing' },
                        { id: 'update_existing' as const, label: 'Update profiles' },
                      ]).map((option) => (
                        <Pressable
                          key={option.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: conflictMode === option.id }}
                          onPress={() => setConflictMode(option.id)}
                          className={`min-h-10 flex-1 items-center justify-center rounded-xl border px-3 ${conflictMode === option.id ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line dark:border-line-dark'}`}
                        >
                          <Text className={`font-sans-bold text-xs ${conflictMode === option.id ? 'text-white dark:text-maroon-dark' : 'text-ink dark:text-white'}`}>{option.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
                <View className="mt-1 flex-row gap-2">
                  <CampusButton className="flex-1" variant="secondary" label="Back" icon="arrow-back" onPress={goBack} />
                  <CampusButton className="flex-1" label={busy ? 'Validating…' : 'Validate'} icon="rule" testID="bulk-import-validate" disabled={busy} onPress={() => void validateRows()} />
                </View>
              </View>
            ) : null}

            {step === 'review' ? (
              <View className="gap-3" testID="bulk-import-review">
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { label: 'Importable', value: chunks.reduce((total, plan) => total + plan.rows.length, 0) },
                    { label: 'Valid', value: summary.valid ?? 0 },
                    { label: 'Issues', value: issues.length + localIssues.length },
                    { label: 'Blocking', value: blockingCount },
                  ].map((tile) => (
                    <View key={tile.label} className="min-w-[45%] flex-1 rounded-2xl border border-line px-3 py-2 dark:border-line-dark">
                      <Text className="font-sans text-[10px] uppercase tracking-wider text-muted dark:text-zinc-400">{tile.label}</Text>
                      <Text className="mt-1 font-sans-bold text-lg text-ink dark:text-white">{tile.value.toLocaleString()}</Text>
                    </View>
                  ))}
                </View>

                {blockingCount > 0 ? (
                  <View className="rounded-2xl border border-amber-400 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
                    <Text className="font-sans-bold text-xs text-amber-900 dark:text-amber-200">{blockingCount} row(s) cannot be imported</Text>
                    <Text className="mt-1 font-sans text-[11px] text-amber-900/80 dark:text-amber-200/80">Fix them in the source list and start again. Only importable rows are committed.</Text>
                  </View>
                ) : null}

                {issues.length + localIssues.length > 0 ? (
                  <CampusCard className="p-3">
                    <Text className="font-sans-bold text-[11px] uppercase tracking-wider text-muted dark:text-zinc-400">First issues</Text>
                    {[...localIssues, ...issues].slice(0, 8).map((issue, index) => (
                      <Text key={`${issue.rowNumber}-${issue.code}-${index}`} className="mt-2 font-sans text-[11px] leading-4 text-ink dark:text-zinc-300">
                        Row {issue.rowNumber || '—'} · {issue.code} · {issue.message}
                      </Text>
                    ))}
                    <Pressable accessibilityRole="button" onPress={() => void copyIssues()} className="mt-3 min-h-10 flex-row items-center gap-2 self-start rounded-xl bg-maroon/5 px-3 dark:bg-golden/10">
                      <MaterialIcons name="content-copy" size={16} color={isDark ? '#FFDF00' : '#7B1113'} />
                      <Text className="font-sans-bold text-xs text-maroon dark:text-golden">Copy full issue list</Text>
                    </Pressable>
                  </CampusCard>
                ) : null}

                {busy ? (
                  <View className="gap-2">
                    <View className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                      <View className="h-2 rounded-full bg-maroon dark:bg-golden" style={{ width: `${Math.round((progress / Math.max(1, chunks.length)) * 100)}%` }} />
                    </View>
                    <Text className="font-sans text-xs text-muted dark:text-zinc-400">Chunk {Math.min(progress + 1, chunks.length)} of {chunks.length}…</Text>
                  </View>
                ) : null}

                <View className="mt-1 flex-row gap-2">
                  <CampusButton className="flex-1" variant="secondary" label="Back" icon="arrow-back" disabled={busy} onPress={goBack} />
                  {busy ? (
                    <CampusButton className="flex-1" variant="secondary" label="Stop after chunk" icon="stop" onPress={() => { stopRequestedRef.current = true }} />
                  ) : (
                    <CampusButton className="flex-1" label="Import now" icon="check" disabled={busy} onPress={() => void executeImport()} />
                  )}
                </View>
                {error && progress > 0 && progress < chunks.length ? (
                  <CampusButton label="Retry remaining" icon="refresh" disabled={busy} onPress={() => void executeImport()} />
                ) : null}
              </View>
            ) : null}

            {step === 'report' ? (
              <View className="gap-3">
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { label: 'Created', value: completedCounts.created },
                    { label: 'Updated', value: completedCounts.updated },
                    { label: 'Skipped', value: completedCounts.skipped },
                    { label: 'Failed', value: completedCounts.failed + blockingCount },
                  ].map((tile) => (
                    <View key={tile.label} className="min-w-[45%] flex-1 rounded-2xl border border-line px-3 py-2 dark:border-line-dark">
                      <Text className="font-sans text-[10px] uppercase tracking-wider text-muted dark:text-zinc-400">{tile.label}</Text>
                      <Text className="mt-1 font-sans-bold text-lg text-ink dark:text-white">{tile.value.toLocaleString()}</Text>
                    </View>
                  ))}
                </View>

                {credentials.length > 0 ? (
                  <View className="rounded-2xl border border-golden/50 bg-golden/10 p-4 dark:bg-golden/5">
                    <Text className="font-sans-bold text-sm text-maroon-dark dark:text-golden">Temporary credentials — display once</Text>
                    <Text className="mt-1 font-sans text-[11px] leading-5 text-zinc-700 dark:text-zinc-300">Print or hand out in person. Never message or email these passwords.</Text>
                    <ScrollView className="mt-2 max-h-48 rounded-xl border border-line bg-white dark:border-line-dark dark:bg-surface-dark">
                      {credentials.map((credential) => (
                        <View key={`${credential.studentId}-${credential.rowNumber}`} className="flex-row items-center justify-between border-b border-line px-3 py-2 dark:border-line-dark">
                          <Text className="font-mono text-[11px] text-ink dark:text-white">{credential.studentId}</Text>
                          <Text className="font-mono text-[11px] text-maroon dark:text-golden">{credential.tempPassword}</Text>
                        </View>
                      ))}
                    </ScrollView>
                    <CampusButton className="mt-3" label="Share credentials CSV" icon="share" variant="gold" onPress={() => void shareCredentials()} />
                  </View>
                ) : null}

                {issues.length + localIssues.length > 0 ? (
                  <CampusButton variant="secondary" label="Copy issue list" icon="content-copy" onPress={() => void copyIssues()} />
                ) : null}

                <CampusButton className="mt-1" label="Done" icon="check" onPress={close} />
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
