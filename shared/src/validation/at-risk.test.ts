import { describe, expect, it } from 'vitest'
import {
  GenerateAtRiskReferralSchema,
  ReferralStatusEnum,
  UpdateAtRiskReferralSchema,
} from './at-risk'
import {
  ATTENDANCE_ANOMALY_EVENT,
  FINALE_COUNT_STATUSES,
  KIOSK_JOIN_EVENT,
  KIOSK_JOINED_EVENT,
  KIOSK_LEAVE_EVENT,
  SESSION_FINALE_EVENT,
  type SessionFinaleSummary,
} from '../types/session'
import { REFERRAL_STATUS_LABELS, type AtRiskReferral, type ReferralStatus } from '../types/at-risk'
import type { AttendanceAnomalyEvent } from '../types/attendance'

describe('at-risk referral validation (F5)', () => {
  it('accepts a canonical generate payload', () => {
    const parsed = GenerateAtRiskReferralSchema.parse({
      studentId: 'stu-1',
      sectionId: 'sec-1',
      note: '  Two consecutive absences  ',
    })
    expect(parsed).toEqual({ studentId: 'stu-1', sectionId: 'sec-1', note: 'Two consecutive absences' })
  })

  it('requires both student and section identifiers', () => {
    expect(GenerateAtRiskReferralSchema.safeParse({ studentId: '', sectionId: 'sec-1' }).success).toBe(false)
    expect(GenerateAtRiskReferralSchema.safeParse({ studentId: 'stu-1', sectionId: '' }).success).toBe(false)
  })

  it('bounds the note at 500 trimmed characters', () => {
    expect(GenerateAtRiskReferralSchema.safeParse({ studentId: 's', sectionId: 'c', note: 'x'.repeat(500) }).success).toBe(
      true,
    )
    expect(GenerateAtRiskReferralSchema.safeParse({ studentId: 's', sectionId: 'c', note: 'x'.repeat(501) }).success).toBe(
      false,
    )
  })

  it('bounds the identifiers at 64 characters', () => {
    expect(
      GenerateAtRiskReferralSchema.safeParse({ studentId: 'x'.repeat(65), sectionId: 'sec-1' }).success,
    ).toBe(false)
  })

  it('accepts every referral status for patch payloads and rejects unknown ones', () => {
    const statuses: ReferralStatus[] = ['generated', 'acknowledged', 'counseling_scheduled', 'resolved']
    for (const status of statuses) {
      expect(UpdateAtRiskReferralSchema.parse({ status })).toEqual({ status })
    }
    expect(UpdateAtRiskReferralSchema.safeParse({ status: 'dismissed' }).success).toBe(false)
    expect(ReferralStatusEnum.safeParse('generated').success).toBe(true)
  })

  it('rejects long notes on status updates', () => {
    expect(UpdateAtRiskReferralSchema.safeParse({ status: 'acknowledged', note: 'x'.repeat(501) }).success).toBe(false)
  })

  it('labels every status and exposes the realtime event-name constants', () => {
    expect(REFERRAL_STATUS_LABELS.generated).toBe('Generated')
    expect(REFERRAL_STATUS_LABELS.resolved).toBe('Resolved')
    expect(ATTENDANCE_ANOMALY_EVENT).toBe('attendance:anomaly')
    expect(SESSION_FINALE_EVENT).toBe('session:finale')
    expect(KIOSK_JOIN_EVENT).toBe('kiosk:join')
    expect(KIOSK_JOINED_EVENT).toBe('kiosk:joined')
    expect(KIOSK_LEAVE_EVENT).toBe('kiosk:leave')
  })

  it('shapes the finale summary with all finale count statuses (F1)', () => {
    const recap: SessionFinaleSummary = {
      sessionId: 'sess-1',
      endedAt: '2026-11-02T03:30:00.000Z',
      counts: { present: 30, late: 3, absent: 5, excused: 1, incomplete: 2, disputed: 0, pending: 1 },
      capacity: 42,
    }
    expect(FINALE_COUNT_STATUSES).toEqual([
      'present',
      'late',
      'absent',
      'excused',
      'incomplete',
      'disputed',
      'pending',
    ])
    expect(Object.keys(recap.counts)).toEqual([...FINALE_COUNT_STATUSES])
    expect(recap.capacity).toBe(42)
  })

  it('shapes the anomaly event payload (F2)', () => {
    const anomaly: AttendanceAnomalyEvent = {
      sessionId: 'sess-1',
      studentId: 'stu-1',
      studentName: 'Juan Dela Cruz',
      studentNumber: '2023-0001',
      latitude: 14.87,
      longitude: 120.999,
      distanceMeters: 124,
      geofenceRadiusMeters: 50,
      reason: 'outside_geofence',
      timestamp: '2026-11-02T03:11:00.000Z',
    }
    expect(anomaly.reason).toBe('outside_geofence')
    expect(REFERRAL_STATUS_LABELS[anomaly.reason as ReferralStatus]).toBeUndefined()
  })
})
