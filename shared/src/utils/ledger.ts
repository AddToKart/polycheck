/**
 * Canonical attendance hash chain (WF-LD11, F9).
 *
 * recordHash = SHA-256 over the exact UTF-8 byte string
 *   `${prevHash ?? ''}|${studentId}|${timestampIso}|${sessionId}|${salt}`
 *
 * Canonical-form rules:
 * - `prevHash` is the previous record's hex digest, or the empty string for
 *   the first record in its session (the generator, not "null").
 * - `timestampIso` is the record's scan-moment timestamp in
 *   `Date.toISOString()` form (millisecond-preserving, UTC, Z suffix) - the
 *   hash covers the scan moment, never the sync-arrival time.
 * - `salt` is a per-record random 32-hex-char value stored alongside the
 *   record so the stored hash remains re-computable.
 * - Pipes are separators; identifiers are not escaped, so the byte string is
 *   only unambiguous as a whole. Consumers must never parse it.
 *
 * This module is the backend-only implementation (node:crypto). It is
 * exported through the `@polycheck/shared/ledger` entry and must never be
 * imported by the web or Android clients - they consume only the
 * `LedgerVerifyResult` type.
 */
import { createHash, randomBytes } from "node:crypto";

export interface RecordHashInput {
  prevHash: string | null;
  studentId: string;
  timestampIso: string;
  sessionId: string;
  salt: string;
}

export function computeRecordHash(input: RecordHashInput): string {
  const canonical = `${input.prevHash ?? ""}|${input.studentId}|${input.timestampIso}|${input.sessionId}|${input.salt}`;
  return createHash("sha256").update(canonical).digest("hex");
}

export function generateLedgerSalt(): string {
  return randomBytes(16).toString("hex");
}

export function ledgerDateOf(timestamp: Date | string): string {
  return (
    typeof timestamp === "string" ? timestamp : timestamp.toISOString()
  ).slice(0, 10);
}

export type LedgerBreakReason =
  "hash_mismatch" | "link_mismatch" | "anchor_mismatch";

/**
 * Outcome of a ledger re-scan.
 *
 * - `verified` — at least one record was recomputed and every chain, link and
 *   anchor check passed.
 * - `broken` — a hash, link or anchor check failed; `brokenAt` says where.
 * - `insufficient_data` — there was nothing to verify: the table holds no
 *   attendance rows at all, or every row still lacks a chain entry (a fresh
 *   seed before the ledger backfill ran). This is never a pass: an unanchored
 *   table must not be reported as an intact ledger.
 */
export type LedgerVerifyStatus = "verified" | "broken" | "insufficient_data";

export interface LedgerVerifyResult {
  /**
   * Verdict of the re-scan. The backend always sends it; the field is optional
   * only because the read-only Android-RN client still types its fixtures
   * against this interface. A consumer that receives no `status` must treat it
   * as a legacy response: `verified ? "verified" : "broken"`.
   */
  status?: LedgerVerifyStatus;
  /** Derived from `status`; kept so existing clients keep working. */
  verified: boolean;
  recordsChecked: number;
  sessionsChecked: number;
  /**
   * Attendance rows that carry no `recordHash` and are therefore off-chain.
   * Always sent by the backend; optional for the same compatibility reason as
   * `status` (absent means 0).
   */
  unhashedRecords?: number;
  lastAnchorDate?: string;
  brokenAt?: {
    sessionId: string;
    recordId: string;
    reason: LedgerBreakReason;
  };
}
