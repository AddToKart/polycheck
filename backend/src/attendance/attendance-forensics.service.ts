import { Injectable, NotFoundException } from '@nestjs/common'
import type { AttendanceRecord, ScanAttempt } from '../prisma/client'
import type { Prisma } from '../prisma/client'
import type { RequestUser } from '../auth/authenticated-principal'
import type { DisputeRecommendation, QRTokenPayload, RecordTimeline, RecordTimelineEvent } from '@polycheck/shared'
import { decodeTokenPayload, verifyQRToken } from '@polycheck/shared'
import { AttendanceScopeService } from './attendance-scope.service'
import { PrismaService } from '../prisma/prisma.service'

const MAX_TIMELINE_EVENTS = 200
// Local evidence older than these thresholds conflicts with its arrival time.
const NETWORK_DELAY_SIGNAL_MS = 60_000
const STALE_OFFLINE_MS = 30 * 60_000
// GPS fixes this imprecise are a conflicting signal even when accepted.
const ACCURACY_SIGNAL_METERS = 100
const TOKEN_ISSUED_AT_SLACK_MS = 30_000
// Attempt outcomes that mean the evidence was committed, not denied.
const OUTCOME_ACCEPTED = new Set([
  'pending',
  'flagged',
  'present',
  'late',
  'absent',
  'disputed',
  'excused',
  'incomplete',
])

// Events sharing an instant keep a fixed semantic order on the rail.
const KIND_ORDER: Record<RecordTimelineEvent['kind'], number> = {
  activation: 0,
  signature: 1,
  scan: 2,
  queue: 3,
  network: 4,
  sync: 5,
  dispute: 6,
  decision: 7,
  excuse: 8,
}

const FORENSICS_SESSION_SELECT = {
  id: true,
  teacherId: true,
  mode: true,
  date: true,
  startTime: true,
  endTime: true,
  qrGeneratedAt: true,
  startQrGeneratedAt: true,
  endQrGeneratedAt: true,
  geofenceRadiusMeters: true,
} satisfies Prisma.SessionSelect

type ForensicsSession = Prisma.SessionGetPayload<{ select: typeof FORENSICS_SESSION_SELECT }>

type ForensicsRecord = AttendanceRecord & {
  acceptedScanAttempt?: ScanAttempt | null
  checkInAttempt?: ScanAttempt | null
  checkOutAttempt?: ScanAttempt | null
  session: ForensicsSession
}

interface TokenEvidence {
  token: string
  payload: QRTokenPayload
  signatureVerified: boolean | null
  sessionMatch: boolean
}

function maskDeviceId(deviceId: string | null | undefined) {
  return deviceId ? `…${deviceId.slice(-4)}` : null
}

function isAcceptedAttempt(attempt: ScanAttempt | null | undefined) {
  return Boolean(attempt && OUTCOME_ACCEPTED.has(attempt.outcome))
}

function clockOf(timestamp: string) {
  return timestamp.slice(11, 19)
}

function primaryAttempt(record: ForensicsRecord): ScanAttempt | null {
  const online = record.session.mode === 'online'
  return (online ? (record.checkInAttempt ?? record.acceptedScanAttempt) : record.acceptedScanAttempt) ?? null
}

@Injectable()
export class AttendanceForensicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: AttendanceScopeService,
  ) {}

  async buildTimeline(user: RequestUser, recordId: string): Promise<RecordTimeline> {
    const scope = await this.scope.recordScope(user)
    const record = (await this.prisma.attendanceRecord.findFirst({
      where: { AND: [{ id: recordId }, scope] },
      include: {
        acceptedScanAttempt: true,
        checkInAttempt: true,
        checkOutAttempt: true,
        session: { select: FORENSICS_SESSION_SELECT },
      },
    })) as unknown as ForensicsRecord
    if (!record) throw new NotFoundException('Attendance record not found')
    const teacher = await this.prisma.user.findUnique({
      where: { id: record.session.teacherId },
      select: { teacherPublicKey: true },
    })

    const events: RecordTimelineEvent[] = []
    this.collectActivationEvents(record.session, events)
    const attempts = await this.prisma.scanAttempt.findMany({
      where: { sessionId: record.sessionId, studentId: record.studentId },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    })
    for (const attempt of attempts) this.collectAttemptEvents(attempt, events)
    const evidence = this.collectTokenEvidence(record, events, teacher?.teacherPublicKey ?? null)
    this.collectRecordEvents(record, events)

    events.sort((a, b) => a.at.localeCompare(b.at) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
    const deduped: RecordTimelineEvent[] = []
    for (const event of events) {
      const previous = deduped[deduped.length - 1]
      if (previous && previous.at === event.at && previous.kind === event.kind) continue
      deduped.push(event)
      if (deduped.length >= MAX_TIMELINE_EVENTS) break
    }

    return {
      recordId: record.id,
      events: deduped,
      recommendation: this.recommend(record, evidence),
    }
  }

  private collectActivationEvents(session: ForensicsSession, events: RecordTimelineEvent[]) {
    if (session.mode === 'in_person') {
      if (session.qrGeneratedAt) {
        events.push({
          kind: 'activation',
          at: session.qrGeneratedAt.toISOString(),
          label: 'Attendance window opened (QR activated by teacher)',
          source: 'session',
        })
      }
      return
    }
    if (session.startQrGeneratedAt) {
      events.push({
        kind: 'activation',
        at: session.startQrGeneratedAt.toISOString(),
        label: 'Check-in checkpoint armed (zero-GPS window)',
        source: 'session',
      })
    }
    if (session.endQrGeneratedAt) {
      events.push({
        kind: 'activation',
        at: session.endQrGeneratedAt.toISOString(),
        label: 'Check-out checkpoint armed (zero-GPS window)',
        source: 'session',
      })
    }
  }

  private collectAttemptEvents(attempt: ScanAttempt, events: RecordTimelineEvent[]) {
    const accepted = isAcceptedAttempt(attempt)
    const radius = attempt.geofenceRadiusMeters ?? null
    const distance = attempt.distanceMeters ?? null
    const insideGeofence = distance !== null && radius !== null ? distance <= radius : undefined
    events.push({
      kind: 'scan',
      at: attempt.timestamp.toISOString(),
      label: accepted
        ? `Scan accepted${attempt.checkpoint ? ` at the ${attempt.checkpoint} checkpoint` : ''}`
        : `Scan denied: ${attempt.reason ?? 'unknown reason'}`,
      source: 'scan_attempt',
      detail: {
        ...(distance !== null ? { distanceMeters: distance } : {}),
        ...(radius !== null ? { radiusMeters: radius } : {}),
        ...(insideGeofence !== undefined ? { insideGeofence } : {}),
        ...(attempt.mocked === true ? { mocked: true } : {}),
        ...(attempt.pinVerified !== null && attempt.pinVerified !== undefined
          ? { pinVerified: attempt.pinVerified }
          : {}),
        ...(attempt.inputChannel ? { channel: attempt.inputChannel } : {}),
        ...(maskDeviceId(attempt.deviceId) ? { deviceIdMasked: maskDeviceId(attempt.deviceId) as string } : {}),
      },
    })
    if (attempt.offline) {
      events.push({
        kind: 'queue',
        at: attempt.timestamp.toISOString(),
        label: 'Queued on device during the outage, waiting for sync',
        source: 'scan_attempt',
        detail: attempt.clientAttemptId ? { receiptId: attempt.clientAttemptId.slice(0, 8) } : undefined,
      })
    }
    if (attempt.clientScannedAt) {
      const delayMs = attempt.receivedAt.getTime() - attempt.clientScannedAt.getTime()
      if (delayMs > NETWORK_DELAY_SIGNAL_MS) {
        events.push({
          kind: 'network',
          at: attempt.receivedAt.toISOString(),
          label: `Scan arrived via sync ${Math.round(delayMs / 60_000)} minutes after capture`,
          source: 'scan_attempt',
        })
      }
    }
  }

  private collectTokenEvidence(
    record: ForensicsRecord,
    events: RecordTimelineEvent[],
    teacherKey: string | null,
  ): TokenEvidence | null {
    const candidates: { token: string | null; checkpoint: string | null }[] = [
      { token: record.tokenSnapshot, checkpoint: null },
      { token: record.checkInToken, checkpoint: 'start' },
      { token: record.checkOutToken, checkpoint: 'end' },
    ]
    for (const candidate of candidates) {
      if (!candidate.token) continue
      const payload = decodeTokenPayload(candidate.token)
      if (!payload || !Number.isFinite(payload.issuedAt)) continue
      events.push({
        kind: 'signature',
        at: new Date(payload.issuedAt).toISOString(),
        label: 'Local ED25519 signature generated',
        source: 'token',
      })
      return {
        token: candidate.token,
        payload,
        signatureVerified: teacherKey ? verifyQRToken(candidate.token, teacherKey) !== null : null,
        sessionMatch: payload.sessionId === record.sessionId,
      }
    }
    return null
  }

  private collectRecordEvents(record: ForensicsRecord, events: RecordTimelineEvent[]) {
    if (record.syncedAt) {
      if (record.syncedAt.getTime() - record.createdAt.getTime() > NETWORK_DELAY_SIGNAL_MS) {
        events.push({
          kind: 'network',
          at: record.createdAt.toISOString(),
          label: 'Server created the pending roster row (offline flow, synced later)',
          source: 'record',
        })
      }
      events.push({
        kind: 'sync',
        at: record.syncedAt.toISOString(),
        label: 'Attendance record committed on the server',
        source: 'record',
      })
    }
    if (record.disputeReason) {
      events.push({
        kind: 'dispute',
        at: (record.syncedAt ?? record.createdAt).toISOString(),
        label: `Flagged for teacher review: ${record.disputeReason}`,
        source: 'record',
      })
    }
    if (record.disputeResolved) {
      events.push({
        kind: 'decision',
        at: record.updatedAt.toISOString(),
        label: 'Dispute resolved by the teacher',
        source: 'record',
      })
    }
    if (record.excuseStatus === 'approved' || record.excuseStatus === 'rejected') {
      events.push({
        kind: 'decision',
        at: (record.excuseReviewedAt ?? record.updatedAt).toISOString(),
        label: `Excuse request ${record.excuseStatus} by the teacher`,
        source: 'record',
      })
    } else if (record.excuseStatus === 'requested') {
      events.push({
        kind: 'excuse',
        at: record.updatedAt.toISOString(),
        label: 'Student requested an attendance excuse',
        source: 'record',
      })
    }
  }

  /** Deterministic recommendation matrix (WF-LD10 / F8.A). */
  private recommend(record: ForensicsRecord, evidence: TokenEvidence | null): DisputeRecommendation {
    const online = record.session.mode === 'online'
    const primary = primaryAttempt(record)
    const disputeReason = record.disputeReason ?? undefined
    if (primary?.mocked === true) {
      return {
        verdict: 'reject',
        rationale: 'Mocked GPS evidence is recorded against the accepted scan attempt.',
      }
    }
    if (disputeReason === 'concurrent_session_conflict') {
      return {
        verdict: 'reject',
        rationale: 'Student is recorded as present in a concurrent session on the same school day.',
      }
    }
    if (record.manuallySet && !primary) {
      return {
        verdict: 'review',
        rationale: 'Record was set manually by the teacher without scan evidence.',
      }
    }

    const signals: string[] = []
    if (!primary) signals.push('No accepted scan attempt is linked to this record')
    else {
      const radius = record.session.geofenceRadiusMeters ?? null
      if (
        primary.accuracyMeters !== null &&
        primary.accuracyMeters !== undefined &&
        primary.accuracyMeters > ACCURACY_SIGNAL_METERS
      ) {
        signals.push(`GPS accuracy of ${Math.round(primary.accuracyMeters)}m weakens the location proof`)
      }
      if (primary.offline) {
        const delayMs = primary.receivedAt.getTime() - (primary.clientScannedAt ?? primary.receivedAt).getTime()
        if (delayMs > STALE_OFFLINE_MS) {
          signals.push(`Offline evidence arrived ${Math.round(delayMs / 60_000)} minutes after the scan`)
        }
      }
      if (!online) {
        if (primary.distanceMeters === null || radius === null) {
          signals.push('Geofence distance is unavailable for the accepted attempt')
        } else if (primary.distanceMeters > radius) {
          signals.push(`Accepted scan sits ${Math.round(primary.distanceMeters)}m outside the ${radius}m geofence`)
        }
      }
      if (online && (primary.pinVerified === null || primary.pinVerified === undefined)) {
        signals.push('Meeting PIN verification is not recorded on the attempt')
      }
    }
    if (!evidence) {
      signals.push('No signed QR token is attached to this record')
    } else if (!evidence.sessionMatch) {
      signals.push('Signed token does not belong to this session')
    } else if (evidence.signatureVerified === false) {
      signals.push('QR signature failed verification against the teacher signing key')
    } else if (evidence.signatureVerified === null) {
      signals.push('Teacher signing key is unavailable, so the signature cannot be checked')
    } else if (primary && !this.insideWindow(evidence, primary)) {
      signals.push('Scan fell outside the signed token validity window')
    }
    if (disputeReason) signals.push(`Record carries the dispute reason: ${disputeReason}`)

    if (
      primary &&
      evidence &&
      evidence.signatureVerified === true &&
      evidence.sessionMatch &&
      this.insideWindow(evidence, primary) &&
      signals.length === 0
    ) {
      return {
        verdict: 'accept',
        rationale: `Cryptographic proof confirms student presence at ${clockOf(primary.timestamp.toISOString())}`,
      }
    }
    if (signals.length === 0) {
      return { verdict: 'review', rationale: 'Evidence collected, but no decisive scan proof is on file.' }
    }
    return { verdict: 'review', rationale: signals.join('; ') }
  }

  private insideWindow(evidence: TokenEvidence, attempt: ScanAttempt) {
    const issuedAt = evidence.payload.issuedAt
    const validityMs =
      evidence.payload.validitySeconds !== undefined
        ? evidence.payload.validitySeconds * 1000
        : evidence.payload.validityMinutes * 60_000
    const windowEnd = issuedAt + validityMs + evidence.payload.gracePeriodMinutes * 60_000
    const scannedAt = attempt.timestamp.getTime()
    return scannedAt <= windowEnd && scannedAt >= issuedAt - TOKEN_ISSUED_AT_SLACK_MS
  }
}
