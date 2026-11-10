import { describe, expect, it } from "vitest";
import {
  computeRecordHash,
  generateLedgerSalt,
  ledgerDateOf,
  type RecordHashInput,
} from "./ledger";

const baseInput: RecordHashInput = {
  prevHash: null,
  studentId: "stu-1",
  timestampIso: "2026-07-14T01:00:00.000Z",
  sessionId: "sess-1",
  salt: "abcd1234abcd1234abcd1234abcd1234",
};

describe("attendance hash chain math", () => {
  it("hashes the canonical genesis byte string (empty prevHash segment)", () => {
    expect(computeRecordHash(baseInput)).toBe(
      "b0268f0f86e02e698809ae192822bd71429005ca3794f6f73e81f1a0d133f6a4",
    );
  });

  it("hashes the canonical linked byte string (prevHash first segment)", () => {
    expect(computeRecordHash({ ...baseInput, prevHash: "prev" })).toBe(
      "3e05224c4d1abbcc6ec58d23b472af65ef8808f4eaef3b3fc7aeca023ed25251",
    );
  });

  it('uses the empty string for null prevHash, not the literal "null"', () => {
    expect(computeRecordHash({ ...baseInput, prevHash: null })).not.toBe(
      computeRecordHash({ ...baseInput, prevHash: "null" }),
    );
  });

  it("changes the digest for every hashed field", () => {
    const hash = computeRecordHash(baseInput);
    expect(computeRecordHash({ ...baseInput, studentId: "stu-2" })).not.toEqual(
      hash,
    );
    expect(
      computeRecordHash({
        ...baseInput,
        timestampIso: "2026-07-14T01:00:01.000Z",
      }),
    ).not.toEqual(hash);
    expect(
      computeRecordHash({ ...baseInput, sessionId: "sess-2" }),
    ).not.toEqual(hash);
    expect(
      computeRecordHash({
        ...baseInput,
        salt: "ffff1234abcd1234abcd1234abcd1234",
      }),
    ).not.toEqual(hash);
  });

  it("is deterministic for identical inputs", () => {
    expect(computeRecordHash(baseInput)).toEqual(
      computeRecordHash({ ...baseInput }),
    );
  });

  it("always yields a sha256-sized lowercase hex digest", () => {
    expect(computeRecordHash(baseInput)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates 32-hex-char salts and keeps them unique", () => {
    const first = generateLedgerSalt();
    const second = generateLedgerSalt();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).toMatch(/^[0-9a-f]{32}$/);
    expect(first).not.toEqual(second);
  });

  it("derives anchor dates from ISO timestamps or legacy strings", () => {
    expect(ledgerDateOf(new Date("2026-07-14T23:30:00.000Z"))).toBe(
      "2026-07-14",
    );
    expect(ledgerDateOf("2026-07-15T00:00:00.000Z")).toBe("2026-07-15");
  });
});
