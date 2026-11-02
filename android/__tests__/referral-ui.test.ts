import { REFERRAL_STATUS_LABELS, type AtRiskReferral } from '@polycheck/shared'
import {
  CHED_NOTICE_FILENAME,
  REFERRAL_STATUS_PILL_CLASSES,
  REFERRAL_STATUS_TEXT_CLASSES,
  REFERRAL_TRANSITION_LABELS,
  REFERRAL_TRANSITION_TARGETS,
  canManageReferrals,
  chedNoticeDownloadPath,
  describeReferralError,
  groupReferralsByStatus,
  isReferralNoticeEligible,
  referralTransitionOptions,
  validateReferralNote,
} from '../lib/institution-settings'

// F5 (WF-LD7): pure referral-queue derivations used by the at-risk screen.

const referral = (overrides: Partial<AtRiskReferral> = {}): AtRiskReferral => ({
  id: 'ref-1',
  studentId: 's-001',
  studentName: 'Maria Santos',
  sectionId: 'sec-001',
  sectionName: 'Section A',
  subjectName: 'Data Structures',
  professorName: 'Prof. Reyes',
  generatedById: 't-001',
  generatedByName: 'Prof. Reyes',
  status: 'generated',
  createdAt: '2026-11-01T08:00:00.000Z',
  updatedAt: '2026-11-01T08:00:00.000Z',
  ...overrides,
})

describe('CHED notice eligibility', () => {
  it('flags only below-threshold and at-risk standings', () => {
    expect(isReferralNoticeEligible({ status: 'below_threshold' })).toBe(true)
    expect(isReferralNoticeEligible({ status: 'at_risk' })).toBe(true)
    expect(isReferralNoticeEligible({ status: 'on_track' })).toBe(false)
    expect(isReferralNoticeEligible({ status: 'insufficient_data' })).toBe(false)
  })
})

describe('referral triage permissions', () => {
  it('lets super admins and department heads manage the queue', () => {
    expect(canManageReferrals({ role: 'super_admin' })).toBe(true)
    expect(canManageReferrals({ role: 'teacher', isDepartmentHead: true })).toBe(true)
  })

  it('keeps plain teachers and students read-only', () => {
    expect(canManageReferrals({ role: 'teacher' })).toBe(false)
    expect(canManageReferrals({ role: 'teacher', isDepartmentHead: false })).toBe(false)
    expect(canManageReferrals({ role: 'student' })).toBe(false)
    expect(canManageReferrals(null)).toBe(false)
  })
})

describe('referral transition options', () => {
  it('offers every triage target except the current status', () => {
    expect(referralTransitionOptions('generated')).toEqual([
      'acknowledged',
      'counseling_scheduled',
      'resolved',
    ])
    expect(referralTransitionOptions('acknowledged')).toEqual(['counseling_scheduled', 'resolved'])
    expect(referralTransitionOptions('counseling_scheduled')).toEqual(['acknowledged', 'resolved'])
    expect(referralTransitionOptions('resolved')).toEqual(['acknowledged', 'counseling_scheduled'])
  })

  it('labels every transition target', () => {
    for (const status of REFERRAL_TRANSITION_TARGETS) {
      expect(REFERRAL_TRANSITION_LABELS[status]).toBeTruthy()
    }
    expect(REFERRAL_TRANSITION_LABELS.acknowledged).toBe('Acknowledge')
    expect(REFERRAL_TRANSITION_LABELS.counseling_scheduled).toBe('Schedule counseling')
    expect(REFERRAL_TRANSITION_LABELS.resolved).toBe('Mark resolved')
  })
})

describe('groupReferralsByStatus', () => {
  it('groups in lifecycle order and drops empty groups', () => {
    const grouped = groupReferralsByStatus([
      referral({ id: 'r-resolved', status: 'resolved' }),
      referral({ id: 'r-generated', status: 'generated' }),
      referral({ id: 'r-generated-2', status: 'generated' }),
      referral({ id: 'r-counseling', status: 'counseling_scheduled' }),
    ])
    expect(grouped.map((group) => group.status)).toEqual([
      'generated',
      'counseling_scheduled',
      'resolved',
    ])
    expect(grouped[0].rows.map((row) => row.id)).toEqual(['r-generated', 'r-generated-2'])
    expect(grouped.map((group) => group.rows.length)).toEqual([2, 1, 1])
  })

  it('returns no groups for an empty queue', () => {
    expect(groupReferralsByStatus([])).toEqual([])
  })
})

describe('referral status pills', () => {
  it('covers every referral status with tone and label', () => {
    for (const status of Object.keys(REFERRAL_STATUS_LABELS) as Array<keyof typeof REFERRAL_STATUS_LABELS>) {
      expect(REFERRAL_STATUS_PILL_CLASSES[status]).toBeTruthy()
      expect(REFERRAL_STATUS_TEXT_CLASSES[status]).toBeTruthy()
      expect(REFERRAL_STATUS_LABELS[status]).toBeTruthy()
    }
    expect(Object.keys(REFERRAL_STATUS_PILL_CLASSES)).toHaveLength(4)
  })
})

describe('describeReferralError', () => {
  it('maps typed referral error codes to friendly copy', () => {
    expect(describeReferralError({ code: 'referral_active' })).toBe(
      'An active CHED referral already exists for this student in this section.',
    )
    expect(describeReferralError({ code: 'student_not_at_risk' })).toBe(
      'This student is no longer flagged as at risk — refresh the list before issuing another notice.',
    )
  })

  it('falls back to the server message and a generic line', () => {
    expect(describeReferralError(new Error('Section is outside your scope'))).toBe(
      'Section is outside your scope',
    )
    expect(describeReferralError({ code: 'unknown_code' })).toBe('Unable to issue the CHED notice.')
    expect(describeReferralError(null)).toBe('Unable to issue the CHED notice.')
  })
})

describe('validateReferralNote', () => {
  it('accepts empty and whitespace notes as optional', () => {
    expect(validateReferralNote('')).toEqual({ ok: true })
    expect(validateReferralNote('   ')).toEqual({ ok: true })
  })

  it('trims a valid note', () => {
    expect(validateReferralNote('  Advising guidance counseling. ')).toEqual({
      ok: true,
      note: 'Advising guidance counseling.',
    })
  })

  it('accepts exactly 500 characters and rejects 501', () => {
    expect(validateReferralNote('x'.repeat(500))).toEqual({ ok: true, note: 'x'.repeat(500) })
    expect(validateReferralNote('x'.repeat(501))).toEqual({
      ok: false,
      message: 'Note must be 500 characters or fewer',
    })
  })
})

describe('CHED notice document path', () => {
  it('targets the authenticated notice endpoint with a pdf format', () => {
    expect(chedNoticeDownloadPath('ref-1')).toBe('/docs/at-risk-notice/ref-1?format=pdf')
    expect(chedNoticeDownloadPath('ref/with spaces')).toBe(
      '/docs/at-risk-notice/ref%2Fwith%20spaces?format=pdf',
    )
    expect(CHED_NOTICE_FILENAME).toBe('PUP-CHED-Drop-Notice.pdf')
  })
})
