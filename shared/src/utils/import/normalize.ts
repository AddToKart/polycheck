import type { ImportIssueCode } from '../../types/bulk-import'
import { STUDENT_ID_PATTERN } from '../../validation/bulk-import'

export interface NormalizedValue<T> {
  value?: T
  issue?: ImportIssueCode
}

export function normalizeFullName(raw: string): NormalizedValue<string> {
  const value = raw.replace(/\s+/g, ' ').trim()
  if (value.length < 2) return { issue: 'MISSING_REQUIRED_FIELD' }
  return { value: value.slice(0, 150) }
}

/**
 * PUP student numbers are `YYYY-NNNNN-XX-N`. Excel silently mangles
 * leading-zero/numeric columns, so detect those shapes explicitly and tell the
 * user to re-export with the SN column formatted as text.
 */
export function normalizeStudentId(raw: string): NormalizedValue<string> {
  let value = raw.replace(/\s+/g, '').trim().toUpperCase()
  if (!value) return { issue: 'MISSING_REQUIRED_FIELD' }
  if (value.endsWith('.0') && /^\d/.test(value)) value = value.slice(0, -2)

  if (
    /^\d+(\.\d+)?$/.test(value) ||
    /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(value) ||
    /^\d{5,}$/.test(value)
  ) {
    return { issue: 'EXCEL_MANGLED_STUDENT_NUMBER' }
  }
  if (!STUDENT_ID_PATTERN.test(value)) {
    return { issue: 'INVALID_STUDENT_NUMBER' }
  }
  return { value }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(raw: string): NormalizedValue<string> {
  const value = raw.trim().toLowerCase()
  if (!value) return {}
  if (!EMAIL_PATTERN.test(value) || value.length > 254) return { issue: 'INVALID_EMAIL' }
  return { value }
}

export function normalizeProgram(raw: string): NormalizedValue<string> {
  const value = raw.replace(/\s+/g, ' ').trim()
  if (!value) return {}
  if (value.length < 2) return { issue: 'PROGRAM_TOO_SHORT' }
  return { value: value.slice(0, 150) }
}

export function normalizeDepartment(raw: string): string | undefined {
  const value = raw.replace(/\s+/g, ' ').trim()
  return value ? value.slice(0, 100) : undefined
}

export function normalizeYearLevel(raw: string): NormalizedValue<number> {
  const value = raw.trim()
  if (!value) return {}
  const numeric = value.match(/^(\d{1,2})(?:st|nd|rd|th)?\s*(?:year|yr)?$/i)
  const prefixed = value.match(/^(?:year|yr)\s*(\d{1,2})$/i)
  const parsed = Number(numeric?.[1] ?? prefixed?.[1])
  if (!Number.isInteger(parsed)) return { issue: 'YEAR_LEVEL_OUT_OF_RANGE' }
  if (parsed < 1 || parsed > 8) return { issue: 'YEAR_LEVEL_OUT_OF_RANGE' }
  return { value: parsed }
}
