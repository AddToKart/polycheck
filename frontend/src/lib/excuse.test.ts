import { describe, expect, it } from 'vitest'
import {
  EXCUSE_REASON_OPTIONS,
  MAX_EXCUSE_EVIDENCE_BYTES,
  validateExcuseEvidence,
  validateExcuseForm,
} from './excuse'

describe('excuse form validation', () => {
  it('covers every shared excuse reason', () => {
    expect(EXCUSE_REASON_OPTIONS.map((option) => option.value)).toEqual([
      'medical',
      'family_emergency',
      'school_activity',
      'transportation',
      'bereavement',
      'other',
    ])
  })

  it('requires a reason and a descriptive explanation', () => {
    const missing = validateExcuseForm({ reason: '', description: '' })
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.errors.reason).toMatch(/select a reason/i)
      expect(missing.errors.description).toMatch(/at least 10 characters/i)
    }

    const short = validateExcuseForm({ reason: 'medical', description: 'Too short' })
    expect(short.ok).toBe(false)
  })

  it('accepts a valid request and trims the description', () => {
    const result = validateExcuseForm({
      reason: 'family_emergency',
      description: '  A family emergency required me to travel home.  ',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.reason).toBe('family_emergency')
      expect(result.value.description).toBe('A family emergency required me to travel home.')
    }
  })

  it('rejects invalid reasons and oversized evidence', () => {
    const invalidReason = validateExcuseForm({
      reason: 'vacation',
      description: 'A sufficiently long explanation.',
    })
    expect(invalidReason.ok).toBe(false)
    if (!invalidReason.ok) expect(invalidReason.errors.reason).toMatch(/valid/i)

    const oversized = validateExcuseForm({
      reason: 'medical',
      description: 'A sufficiently long explanation.',
      evidenceBytes: MAX_EXCUSE_EVIDENCE_BYTES + 1,
    })
    expect(oversized.ok).toBe(false)
    if (!oversized.ok) expect(oversized.errors.evidence).toMatch(/5 MB/i)
  })

  it('validates evidence type and size before reading the file', () => {
    expect(validateExcuseEvidence({ size: 1_024, type: 'image/png' })).toBeNull()
    expect(validateExcuseEvidence({ size: 1_024, type: 'application/pdf' })).toMatch(/image file/i)
    expect(
      validateExcuseEvidence({ size: MAX_EXCUSE_EVIDENCE_BYTES + 1, type: 'image/jpeg' }),
    ).toMatch(/5 MB/i)
  })
})
