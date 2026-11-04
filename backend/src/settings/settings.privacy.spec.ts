import { BadRequestException } from '@nestjs/common'
import { PRIVACY_DATA_INVENTORY } from '@polycheck/shared'
import { SettingsService } from './settings.service'
import type { PrivacyShredRecord } from '../common/constants/privacy'

const LAST_RUN: PrivacyShredRecord = {
  lastRunAt: '2026-11-02T19:00:00.000Z',
  recordsShredded: 12,
  attemptsShredded: 3,
}

describe('SettingsService privacy center (F6)', () => {
  function build(
    options: {
      rows?: Map<string, string>
      users?: { covered: number; totalActive: number }
      shredRecord?: unknown
      version?: string
      staleCoordinates?: { attendanceRecords: number; scanAttempts: number }
    } = {},
  ) {
    const rows = options.rows ?? new Map<string, string>()
    const upsert = jest.fn(async ({ create }: { create: { key: string; value: string } }) => {
      rows.set(create.key, create.value)
      return create
    })
    const prisma = {
      institutionSetting: {
        findUnique: jest.fn(async ({ where }: { where: { key: string } }) =>
          rows.has(where.key) ? { value: rows.get(where.key), key: where.key } : null,
        ),
        upsert,
      },
      user: {
        count: jest
          .fn()
          .mockResolvedValueOnce(options.users?.covered ?? 0)
          .mockResolvedValueOnce(options.users?.totalActive ?? 0),
      },
      attendanceRecord: {
        count: jest.fn().mockResolvedValue(options.staleCoordinates?.attendanceRecords ?? 0),
      },
      scanAttempt: {
        count: jest.fn().mockResolvedValue(options.staleCoordinates?.scanAttempts ?? 0),
      },
    }
    const redis = {
      setJson: jest.fn(async () => true),
      getJson: jest.fn(async () => options.shredRecord ?? null),
    }
    const config = {
      get: jest.fn(() => options.version ?? '2026-09-05'),
      getOrThrow: jest.fn(() => options.version ?? '2026-09-05'),
    }
    const service = new SettingsService(prisma as never, config as never, undefined, redis as never)
    return { prisma, redis, upsert, service }
  }

  afterEach(() => {
    jest.useRealTimers()
    // The module-level in-memory fallback would otherwise leak between cases.
    ;(SettingsService as unknown as { lastShredRun: PrivacyShredRecord | null }).lastShredRun = null
  })

  it('returns the canonical default snapshot when nothing is configured yet', async () => {
    const { service } = build()

    await expect(service.getPrivacyCenterSnapshot()).resolves.toEqual({
      retentionDays: 30,
      consent: { covered: 0, totalActive: 0, version: '2026-09-05' },
      ephemeral: {
        coordinatesBeyondRetention: 0,
        lastRunAt: null,
        recordsShredded: null,
        attemptsShredded: null,
      },
      dataInventory: PRIVACY_DATA_INVENTORY,
      breaches: [],
    })
  })

  it('counts consent coverage against the active accounts and the current notice version', async () => {
    const { prisma, service } = build({ users: { covered: 7, totalActive: 9 } })

    const snapshot = await service.getPrivacyCenterSnapshot()

    expect(snapshot.consent).toEqual({ covered: 7, totalActive: 9, version: '2026-09-05' })
    expect(prisma.user.count).toHaveBeenNthCalledWith(1, {
      where: { isActive: true, privacyConsentVersion: '2026-09-05' },
    })
    expect(prisma.user.count).toHaveBeenNthCalledWith(2, { where: { isActive: true } })
  })

  it('counts live coordinates older than the configured retention cutoff', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-04T00:00:00.000Z'))
    const { prisma, service } = build({
      users: { covered: 0, totalActive: 0 },
      staleCoordinates: { attendanceRecords: 2, scanAttempts: 3 },
    })

    const snapshot = await service.getPrivacyCenterSnapshot()

    expect(snapshot.ephemeral.coordinatesBeyondRetention).toBe(5)
    const expectedCutoff = new Date('2026-10-05T00:00:00.000Z')
    const where = {
      timestamp: { lt: expectedCutoff },
      OR: [{ latitude: { not: null } }, { longitude: { not: null } }],
    }
    expect(prisma.attendanceRecord.count).toHaveBeenCalledWith({ where })
    expect(prisma.scanAttempt.count).toHaveBeenCalledWith({ where })
  })

  it('clamps hand-edited retention rows into the documented 7–90 window', async () => {
    const clampedHigh = build({ rows: new Map([['geolocation_retention_days', '96']]) })
    await expect(clampedHigh.service.getPrivacyCenterSnapshot()).resolves.toMatchObject({ retentionDays: 90 })

    const clampedLow = build({ rows: new Map([['geolocation_retention_days', '2']]) })
    await expect(clampedLow.service.getPrivacyCenterSnapshot()).resolves.toMatchObject({ retentionDays: 7 })

    const configured = build({ rows: new Map([['geolocation_retention_days', '60']]) })
    await expect(configured.service.getPrivacyCenterSnapshot()).resolves.toMatchObject({ retentionDays: 60 })
  })

  it('reads the last shred run through Redis and memoizes it in-memory afterwards', async () => {
    const { redis, service } = build({ shredRecord: LAST_RUN })

    await expect(service.getPrivacyCenterSnapshot()).resolves.toMatchObject({
      ephemeral: { lastRunAt: LAST_RUN.lastRunAt, recordsShredded: 12, attemptsShredded: 3 },
    })
    expect(redis.getJson).toHaveBeenCalledWith('privacy:shred:last')
    // Second read is served from the static fallback without touching Redis again.
    redis.getJson.mockClear()
    await expect(service.getPrivacyCenterSnapshot()).resolves.toMatchObject({
      ephemeral: { lastRunAt: LAST_RUN.lastRunAt, recordsShredded: 12, attemptsShredded: 3 },
    })
    expect(redis.getJson).not.toHaveBeenCalled()
  })

  it('ignores malformed shred records from Redis instead of echoing them', async () => {
    const { service } = build({ shredRecord: { lastRunAt: 'not-a-date', recordsShredded: -1 } })

    await expect(service.getPrivacyCenterSnapshot()).resolves.toMatchObject({
      ephemeral: { lastRunAt: null, recordsShredded: null, attemptsShredded: null },
    })
  })

  it('records shred runs persistently and keeps the failing-Redis path fail-open', async () => {
    const { redis, service } = build()

    await service.recordPrivacyShredRun(LAST_RUN)
    expect(redis.setJson).toHaveBeenCalledWith('privacy:shred:last', LAST_RUN, 172_800)
    await expect(service.getPrivacyCenterSnapshot()).resolves.toMatchObject({
      ephemeral: { lastRunAt: LAST_RUN.lastRunAt, recordsShredded: 12, attemptsShredded: 3 },
    })

    const nonDistributed = build()
    nonDistributed.redis.setJson.mockResolvedValueOnce(false)
    await expect(nonDistributed.service.recordPrivacyShredRun(LAST_RUN)).resolves.toBeUndefined()

    const failing = build()
    failing.redis.setJson.mockRejectedValueOnce(new Error('redis down'))
    await expect(failing.service.recordPrivacyShredRun(LAST_RUN)).resolves.toBeUndefined()
  })

  it('validates geolocation_retention_days through the shared integer range', async () => {
    const { service, upsert } = build({ rows: new Map() })

    await service.set('geolocation_retention_days', '45', 'admin-1')
    expect(upsert).toHaveBeenCalledWith({
      where: { key: 'geolocation_retention_days' },
      create: { key: 'geolocation_retention_days', value: '45', updatedBy: 'admin-1' },
      update: { value: '45', updatedBy: 'admin-1' },
    })

    await expect(service.set('geolocation_retention_days', '6', 'admin-1')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.set('geolocation_retention_days', '91', 'admin-1')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.set('geolocation_retention_days', 'twelve', 'admin-1')).rejects.toThrow(
      'geolocation_retention_days must be a whole number',
    )
  })
})
