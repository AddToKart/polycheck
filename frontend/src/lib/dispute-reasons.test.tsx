import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DisputeReason } from '@polycheck/shared'
import {
  DISPUTE_ICONS,
  DISPUTE_LABELS,
  disputeReasonIcon,
  disputeReasonLabel,
} from './dispute-reasons'

describe('dispute reason presentation', () => {
  it('labels and icons every reason the shared union declares', () => {
    // A missing entry is the DD-C3 crash class: <Icon/> where Icon is undefined.
    for (const reason of Object.keys(DISPUTE_ICONS) as DisputeReason[]) {
      expect(disputeReasonLabel(reason)).not.toBe('Unknown')
      expect(disputeReasonIcon(reason)).toBeTypeOf('object')
    }
    expect(DISPUTE_LABELS.missing_scan_evidence).toBe('Missing Scan Evidence')
    expect(DISPUTE_ICONS.missing_scan_evidence).toBeTypeOf('object')
    expect(DISPUTE_LABELS.implausible_client_timestamp).toBe('Implausible Client Timestamp')
    expect(DISPUTE_ICONS.implausible_client_timestamp).toBeTypeOf('object')
  })

  it('renders a missing_scan_evidence record without an invalid element', () => {
    const Icon = disputeReasonIcon('missing_scan_evidence')
    expect(() => render(<Icon aria-hidden="true" />)).not.toThrow()
  })

  it('falls back instead of crashing on an unknown wire value', () => {
    const unknown = 'future_reason_from_the_backend' as DisputeReason
    expect(disputeReasonLabel(unknown)).toBe('Unknown')
    const Icon = disputeReasonIcon(unknown)
    expect(Icon).toBe(DISPUTE_ICONS.other)
    expect(() => render(<Icon aria-hidden="true" />)).not.toThrow()
    expect(disputeReasonLabel(undefined)).toBe('Unknown')
    expect(disputeReasonIcon(undefined)).toBe(DISPUTE_ICONS.other)
  })
})
