import { describe, expect, it } from 'vitest'
import {
  consentCoveragePercent,
  clampRetentionDays,
  GEOLOCATION_RETENTION_DEFAULT_DAYS,
  GEOLOCATION_RETENTION_MAX_DAYS,
  GEOLOCATION_RETENTION_MIN_DAYS,
  PRIVACY_DATA_INVENTORY,
  type PrivacyCenterSnapshot,
} from './privacy'

describe('privacy data inventory', () => {
  it('completes every row: data, purpose, lawful basis, and lifetime are non-empty', () => {
    expect(PRIVACY_DATA_INVENTORY.length).toBeGreaterThanOrEqual(7)
    for (const row of PRIVACY_DATA_INVENTORY) {
      expect(row.data.length).toBeGreaterThan(5)
      expect(row.purpose.length).toBeGreaterThan(5)
      expect(row.lawfulBasis).toMatch(/RA 10173/)
      expect(row.lifetime.length).toBeGreaterThan(5)
      expect(row.lawfulBasis.length).toBeGreaterThan(5)
    }
  })

  it('declares each data category exactly once', () => {
    const categories = PRIVACY_DATA_INVENTORY.map((row) => row.data)
    expect(new Set(categories).size).toBe(categories.length)
  })
})

describe('retention window helpers', () => {
  it('clamps hand-edited retention values into the documented 7–90 window', () => {
    expect(GEOLOCATION_RETENTION_MIN_DAYS).toBe(7)
    expect(GEOLOCATION_RETENTION_MAX_DAYS).toBe(90)
    expect(clampRetentionDays(GEOLOCATION_RETENTION_DEFAULT_DAYS)).toBe(GEOLOCATION_RETENTION_DEFAULT_DAYS)
    expect(clampRetentionDays(0)).toBe(7)
    expect(clampRetentionDays(2)).toBe(7)
    expect(clampRetentionDays(30)).toBe(30)
    expect(clampRetentionDays(90)).toBe(90)
    expect(clampRetentionDays(96)).toBe(90)
    expect(clampRetentionDays(3650)).toBe(90)
    expect(clampRetentionDays(12.4)).toBe(12)
    expect(clampRetentionDays(Number.NaN)).toBe(GEOLOCATION_RETENTION_DEFAULT_DAYS)
  })
})

describe('consentCoveragePercent', () => {
  it('rounds to whole percentages and saturates at 0–100', () => {
    expect(consentCoveragePercent(3, 4)).toBe(75)
    expect(consentCoveragePercent(2, 3)).toBe(67)
    expect(consentCoveragePercent(0, 10)).toBe(0)
    expect(consentCoveragePercent(10, 10)).toBe(100)
    expect(consentCoveragePercent(20, 10)).toBe(100)
  })

  it('returns null when the denominator is zero or non-numeric', () => {
    expect(consentCoveragePercent(0, 0)).toBeNull()
    expect(consentCoveragePercent(5, Number.NaN)).toBeNull()
    expect(consentCoveragePercent(Number.NaN, 5)).toBeNull()
  })
})

describe('PrivacyCenterSnapshot shape', () => {
  it('builds the canonical default every consumer can rely on', () => {
    const snapshot: PrivacyCenterSnapshot = {
      retentionDays: GEOLOCATION_RETENTION_DEFAULT_DAYS,
      consent: { covered: 0, totalActive: 0, version: '' },
      ephemeral: {
        coordinatesBeyondRetention: null,
        lastRunAt: null,
        recordsShredded: null,
        attemptsShredded: null,
      },
      dataInventory: PRIVACY_DATA_INVENTORY,
      breaches: [],
    }
    expect(Object.keys(snapshot)).toEqual([
      'retentionDays',
      'consent',
      'ephemeral',
      'dataInventory',
      'breaches',
    ])
    expect(snapshot.ephemeral.lastRunAt).toBeNull()
    expect(snapshot.ephemeral.recordsShredded).toBeNull()
    expect(snapshot.ephemeral.attemptsShredded).toBeNull()
    expect(snapshot.breaches).toEqual([])
    expect(snapshot.dataInventory).toBe(PRIVACY_DATA_INVENTORY)
  })
})
