/**
 * RA 10173 (Data Privacy Act) compliance & transparency contracts (F6, WF-LD8).
 *
 * The privacy center is honest, not aspirational: every number on the tab is
 * computed from production data at render time. These shared constants keep the
 * data inventory identical across the web tab, the Android mirror, the
 * `GET /settings/privacy-center` snapshot, and the DPO summary PDF.
 */

/** Documented clamp for `geolocation_retention_days` (7–90, default 30). */
export const GEOLOCATION_RETENTION_MIN_DAYS = 7
export const GEOLOCATION_RETENTION_MAX_DAYS = 90
export const GEOLOCATION_RETENTION_DEFAULT_DAYS = 30

/** Snapshot of the consent ledger for the current onboarding notice version. */
export interface PrivacyConsentSnapshot {
  /** Active accounts whose stored consent version matches the current notice. */
  covered: number
  /** Every active account (all roles) — the coverage denominator. */
  totalActive: number
  /** Privacy notice version accounts are consenting to (PRIVACY_NOTICE_VERSION). */
  version: string
}

/**
 * Last nightly telemetry shred, read from Redis (48 h) with an in-memory
 * fallback. `null` counts mean no shred run is visible to this instance yet —
 * represented as "unknown", never as "zero".
 */
export interface PrivacyEphemeralSnapshot {
  lastRunAt: string | null
  recordsShredded: number | null
  attemptsShredded: number | null
}

/** One row of the plain-language "what we store and why" inventory. */
export interface PrivacyDataInventoryRow {
  /** What is stored, in plain language. */
  data: string
  /** Why it exists (purpose of processing). */
  purpose: string
  /** RA 10173 lawful basis (§12/§13). */
  lawfulBasis: string
  /** How long it lives and how it is removed. */
  lifetime: string
}

/**
 * Breach register: intentionally empty until a real incident surface exists.
 * The snapshot and the DPO summary always render "None recorded" from this.
 */
export type PrivacyBreachLog = readonly []

/** Response served by GET /settings/privacy-center. */
export interface PrivacyCenterSnapshot {
  retentionDays: number
  consent: PrivacyConsentSnapshot
  ephemeral: PrivacyEphemeralSnapshot
  dataInventory: readonly PrivacyDataInventoryRow[]
  breaches: PrivacyBreachLog
}

/**
 * The published data inventory. Lifetime copy describes the policies this
 * system actually enforces (§12/§13 legitimate educational interests for
 * academic records; consent obtained at onboarding covers the geolocation
 * processing that closes the loop against proxy check-ins).
 */
export const PRIVACY_DATA_INVENTORY: readonly PrivacyDataInventoryRow[] = [
  {
    data: 'Account identity (full name, student number, program and year level, faculty department)',
    purpose: 'Roster building, digital student ID, and official class records',
    lawfulBasis: 'RA 10173 §13 — legitimate educational interests',
    lifetime: 'While the account is active; deleted with the account',
  },
  {
    data: 'Attendance record (session occurrence, status, timestamps, signed QR token snapshot)',
    purpose: 'The official attendance record of record for each class meeting',
    lawfulBasis: 'RA 10173 §13 — legitimate educational interests',
    lifetime: 'Retained with academic-year records; status/decisional data is never shredded',
  },
  {
    data: 'Check-in GPS coordinates and accuracy (in-person sessions only)',
    purpose: 'Verify the student is physically inside the class geofence at scan time (anti-proxy check-in)',
    lawfulBasis: 'RA 10173 §12(b)/§13 — consent obtained at onboarding',
    lifetime: 'Shredded (nulled) after geolocation_retention_days (7–90, default 30) by the nightly job',
  },
  {
    data: 'Scan attempt telemetry (device claims, accuracy, mock flags, input channel, risk signals)',
    purpose: 'Audit trail and anti-cheat review for rejected or suspicious scan attempts',
    lawfulBasis: 'RA 10173 §13 — legitimate educational interests',
    lifetime: 'Coordinates/accuracy/risk signals shredded on the same retention schedule; unlinked denied attempts pruned after 90 days',
  },
  {
    data: 'Signed QR tokens and their hashes (issued at activation, valid 1–15 minutes)',
    purpose: 'Cryptographic proof that a check-in was scanned from a teacher-signed code and was not replayed',
    lawfulBasis: 'RA 10173 §13 — legitimate educational interests',
    lifetime: 'Stored with the attendance record they validated',
  },
  {
    data: 'Dispute and excuse submissions (reason, description, decision stamps)',
    purpose: 'Let students contest attendance entries and let instructors resolve them with evidence',
    lawfulBasis: 'RA 10173 §13 — legitimate educational interests; consent',
    lifetime: 'Retained with the academic-year record; decision outcome kept after coordinate shredding',
  },
  {
    data: 'Proof-of-class photos and report screenshots (image attachments)',
    purpose: 'Verify that a class meeting occurred and document reported issues',
    lawfulBasis: 'RA 10173 §13 — legitimate educational interests',
    lifetime: 'Teacher-managed deletion for proofs; screenshot attachments follow the report lifecycle',
  },
  {
    data: 'Audit trail (who did what, from where, when — including institution settings changes)',
    purpose: 'Tamper-evident accountability log with daily external anchors',
    lawfulBasis: 'RA 10173 §13 — legitimate educational interests',
    lifetime: 'Default 7-year retention (AUDIT_LOG_RETENTION_DAYS)',
  },
]

/**
 * Clamp a hand-edited retention row into the documented 7–90 window. Invalid
 * or non-finite values fall back to the 30-day default.
 */
export function clampRetentionDays(value: number): number {
  if (!Number.isFinite(value)) return GEOLOCATION_RETENTION_DEFAULT_DAYS
  return Math.min(
    GEOLOCATION_RETENTION_MAX_DAYS,
    Math.max(GEOLOCATION_RETENTION_MIN_DAYS, Math.round(value)),
  )
}

/**
 * Consent coverage percentage for the privacy tab and the DPO summary.
 * Returns null when the denominator is zero or non-numeric — callers render
 * "0 active accounts" instead of a meaningless 0% or NaN.
 */
export function consentCoveragePercent(covered: number, totalActive: number): number | null {
  if (!Number.isFinite(covered) || !Number.isFinite(totalActive) || totalActive <= 0) return null
  return Math.min(100, Math.max(0, Math.round((covered / totalActive) * 100)))
}
