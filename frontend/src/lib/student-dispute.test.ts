import { describe, expect, it } from 'vitest'
import { ApiHttpError } from '@/lib/api-client'
import {
  DISPUTE_SUBMIT_FALLBACK_MESSAGE,
  describeDisputeSubmitError,
  isDisputeDescriptionValid,
} from './student-dispute'

describe('student dispute helpers', () => {
  it('requires 10 trimmed characters', () => {
    expect(isDisputeDescriptionValid('')).toBe(false)
    expect(isDisputeDescriptionValid('   too short   ')).toBe(false)
    expect(isDisputeDescriptionValid('  valid reason  ')).toBe(true)
  })

  it('prefers the typed API message so validation errors are visible', () => {
    expect(describeDisputeSubmitError(new ApiHttpError('Description is too short', 400))).toBe(
      'Description is too short',
    )
  })

  it('falls back to a neutral retry hint for network-shaped failures', () => {
    expect(describeDisputeSubmitError(new TypeError('Failed to fetch'))).toBe(
      DISPUTE_SUBMIT_FALLBACK_MESSAGE,
    )
    expect(describeDisputeSubmitError(undefined)).toBe(DISPUTE_SUBMIT_FALLBACK_MESSAGE)
  })
})
