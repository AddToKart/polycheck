import {
  ExcuseReasonSchema,
  RequestExcuseSchema,
  type ExcuseReason,
} from '@polycheck/shared'

/** Matches the shared upload schema (7 MB base64 ceiling) with a 5 MB file cap. */
export const MAX_EXCUSE_EVIDENCE_BYTES = 5 * 1024 * 1024
export const MAX_EXCUSE_EVIDENCE_DATA_LENGTH = 7_000_000

export const EXCUSE_REASON_LABELS: Record<ExcuseReason, string> = {
  medical: 'Medical reason',
  family_emergency: 'Family emergency',
  school_activity: 'School activity',
  transportation: 'Transportation / travel issue',
  bereavement: 'Bereavement',
  other: 'Other',
}

export const EXCUSE_REASON_OPTIONS: { value: ExcuseReason; label: string }[] = (
  ['medical', 'family_emergency', 'school_activity', 'transportation', 'bereavement', 'other'] as const
).map((value) => ({ value, label: EXCUSE_REASON_LABELS[value] }))

export interface ExcuseFormErrors {
  reason?: string
  description?: string
  evidence?: string
}

export interface ExcuseFormInput {
  reason: string
  description: string
  evidenceBytes?: number
  evidenceData?: string
}

export interface ValidatedExcuse {
  reason: ExcuseReason
  description: string
  evidenceData?: string
}

export type ExcuseValidationResult =
  | { ok: true; value: ValidatedExcuse }
  | { ok: false; errors: ExcuseFormErrors }

/** Returns a human-readable error for an invalid evidence file, or null. */
export function validateExcuseEvidence(file: { size: number; type: string }): string | null {
  if (!file.type.startsWith('image/')) return 'Attach an image file (JPG, PNG, or HEIC).'
  if (file.size > MAX_EXCUSE_EVIDENCE_BYTES) return 'The selected photo is larger than 5 MB.'
  return null
}

/**
 * Excuse modal validation. Mirrors the shared `RequestExcuseSchema` plus the
 * 5 MB evidence guard enforced by the upload UI.
 */
export function validateExcuseForm(input: ExcuseFormInput): ExcuseValidationResult {
  const errors: ExcuseFormErrors = {}

  const reason = ExcuseReasonSchema.safeParse(input.reason)
  if (!input.reason.trim()) errors.reason = 'Select a reason for the excuse.'
  else if (!reason.success) errors.reason = 'Select a valid excuse reason.'

  const description = RequestExcuseSchema.shape.description.safeParse(input.description)
  if (!description.success) {
    errors.description = description.error.issues[0]?.message ?? 'Describe the reason in at least 10 characters.'
  }

  if (input.evidenceBytes !== undefined && input.evidenceBytes > MAX_EXCUSE_EVIDENCE_BYTES) {
    errors.evidence = 'The selected photo is larger than 5 MB.'
  } else if (input.evidenceData && input.evidenceData.length > MAX_EXCUSE_EVIDENCE_DATA_LENGTH) {
    errors.evidence = 'The selected photo is too large to upload.'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      reason: reason.success ? reason.data : 'other',
      description: input.description.trim(),
      ...(input.evidenceData ? { evidenceData: input.evidenceData } : {}),
    },
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('The selected photo could not be read.'))
    reader.readAsDataURL(file)
  })
}
