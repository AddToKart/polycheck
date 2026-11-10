import type { SessionMode } from "./session";

export type AttendanceStatus =
  | "present"
  | "late"
  | "absent"
  | "pending"
  | "disputed"
  | "excused"
  | "incomplete";

export type ExcuseStatus = "requested" | "approved" | "rejected";

export type ExcuseReason =
  | "medical"
  | "family_emergency"
  | "school_activity"
  | "transportation"
  | "bereavement"
  | "other";

export type ExcuseDecision = "approve" | "reject";

export type StudentDisputeReason =
  | "outside_geofence"
  | "expired_token"
  | "duplicate_submission"
  | "invalid_signature"
  | "device_mismatch"
  | "suspicious_coordinates"
  | "other";

export type SystemDisputeReason =
  | "delayed_offline_sync"
  | "invalid_timestamp"
  | "token_mismatch"
  | "session_inactive"
  | "not_enrolled"
  | "qr_expired"
  | "rate_limited"
  | "mocked_location"
  | "rooted_device"
  | "hook_detected"
  | "emulator_detected"
  | "concurrent_session_conflict";

export type DisputeReason = StudentDisputeReason | SystemDisputeReason;

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  sectionId: string;
  studentId: string;
  studentName: string;
  studentProgram?: string;
  timestamp: string;
  status: AttendanceStatus;
  coordinates: {
    latitude: number | null;
    longitude: number | null;
  };
  mode?: SessionMode;
  checkInTime?: string | null;
  checkInStatus?: AttendanceStatus | null;
  checkOutTime?: string | null;
  checkOutStatus?: AttendanceStatus | null;
  deviceId?: string;
  tokenSnapshot?: string;
  isSynced: boolean;
  syncedAt?: string;
  disputeReason?: DisputeReason;
  disputeResolved?: boolean;
  disputeDescription?: string;
  manuallySet?: boolean;
  notes?: string;
  excuseStatus?: ExcuseStatus;
  excuseReason?: ExcuseReason;
  excuseDescription?: string;
  excuseEvidencePath?: string;
  excuseReviewedBy?: string;
  excuseReviewedAt?: string;
  excuseReviewNote?: string;
}

export interface AttendanceSummary {
  sectionId: string;
  subjectName: string;
  totalSessions: number;
  present: number;
  late: number;
  absent: number;
  disputed: number;
  excused: number;
  incomplete: number;
}

// ── F2 (WF-LD4): live geofence anomaly broadcast on scan denial ──

/**
 * Emitted on `ATTENDANCE_ANOMALY_EVENT` to the session room when an in-person
 * scan is denied with coordinates (geofence / mocked / accuracy reasons, plus
 * duplicate/replay denials). Online-mode events are never emitted (the server
 * omits the event entirely when coordinates are null).
 */
export interface AttendanceAnomalyEvent {
  sessionId: string
  studentId: string
  studentName?: string
  studentNumber?: string
  latitude: number | null
  longitude: number | null
  distanceMeters?: number | null
  geofenceRadiusMeters?: number | null
  /** Validator denial reason (`outside_geofence`, `mocked_location`, …). */
  reason: string
  timestamp: string
}

// ── Blackbox forensics (F8) ──

export interface ScanAttemptView {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  studentNumber?: string;
  timestamp: string;
  clientScannedAt?: string | null;
  receivedAt: string;
  coordinates: { latitude: number | null; longitude: number | null };
  accuracyMeters?: number | null;
  distanceMeters?: number | null;
  geofenceRadiusMeters?: number | null;
  outcome: "accepted" | "denied" | "pending";
  denialReason?: string | null;
  mocked?: boolean | null;
  pinVerified?: boolean | null;
  offline?: boolean | null;
  inputChannel?: string | null;
  checkpoint?: string | null;
  deviceIdMasked?: string | null;
}

export type RecordTimelineEventKind =
  | "activation"
  | "scan"
  | "signature"
  | "queue"
  | "network"
  | "sync"
  | "dispute"
  | "decision"
  | "excuse";

export interface RecordTimelineEvent {
  kind: RecordTimelineEventKind;
  at: string;
  label: string;
  source: "session" | "scan_attempt" | "token" | "record" | "audit";
  detail?: {
    distanceMeters?: number;
    radiusMeters?: number;
    insideGeofence?: boolean;
    mocked?: boolean;
    pinVerified?: boolean;
    channel?: string;
    deviceIdMasked?: string;
    receiptId?: string;
  };
}

export interface RecordTimeline {
  recordId: string;
  events: RecordTimelineEvent[];
  recommendation: DisputeRecommendation;
}

export type DisputeRecommendation = {
  verdict: "accept" | "review" | "reject";
  rationale: string;
};

export const RECORD_TIMELINE_EVENT_KIND_LABELS: Record<
  RecordTimelineEventKind,
  string
> = {
  activation: "Activation",
  scan: "Scan attempt",
  signature: "Signature",
  queue: "Queued on device",
  network: "Network",
  sync: "Sync",
  dispute: "Dispute",
  decision: "Decision",
  excuse: "Excuse",
};

export const DISPUTE_RECOMMENDATION_LABELS: Record<
  DisputeRecommendation["verdict"],
  string
> = {
  accept: "Accept",
  review: "Review",
  reject: "Reject",
};
