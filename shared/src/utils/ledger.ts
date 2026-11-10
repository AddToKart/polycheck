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

export interface LedgerVerifyResult {
  verified: boolean;
  recordsChecked: number;
  sessionsChecked: number;
  lastAnchorDate?: string;
  brokenAt?: {
    sessionId: string;
    recordId: string;
    reason: LedgerBreakReason;
  };
}
