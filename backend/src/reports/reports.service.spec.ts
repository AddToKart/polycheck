import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { ReportsService } from './reports.service'

const studentUser = { id: 'student-1', role: 'student' } as never
const teacherUser = { id: 'teacher-9', role: 'teacher' } as never
const adminUser: never = { id: 'admin-1', role: 'super_admin', scope: 'institution' } as never
const departmentAdmin: never = { id: 'admin-2', role: 'super_admin', scope: 'department' } as never

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'report-1',
    userId: 'student-1',
    userRole: 'student',
    category: 'scanner_camera',
    severity: 'high',
    title: 'Camera crashed on scan',
    description: 'The scanner shows a black screen on my Pixel.',
    status: 'open',
    deviceInfo: 'Android 14',
    appVersion: 'Expo v1.2.0',
    route: '/(tabs)/scan',
    networkType: 'cellular',
    screenshotUrl: '/uploads/report-1.png',
    adminNotes: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: new Date('2026-10-30T01:00:00.000Z'),
    updatedAt: new Date('2026-10-30T01:00:00.000Z'),
    user: {
      id: 'student-1',
      fullName: 'Juan Dela Cruz',
      role: 'student',
      studentId: '2024-00001-MN-0',
      email: 'amreyes@iskolar.pup.edu.ph',
      department: 'CCIS',
    },
    ...overrides,
  }
}

const VALID_SCREENSHOT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('ReportsService', () => {
  function build(
    reportOverrides: Record<string, unknown> = {},
    options: { test?: unknown; findUnique?: jest.Mock; findMany?: jest.Mock; groupBy?: jest.Mock } = {},
  ) {
    const prisma: any = {
      systemReport: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          makeRow({ ...data, ...reportOverrides }),
        ),
        findUnique: options.findUnique ?? jest.fn().mockResolvedValue(null),
        findMany: options.findMany ?? jest.fn().mockResolvedValue([makeRow()]),
        count: jest.fn().mockResolvedValue(1),
        groupBy: options.groupBy ?? jest.fn().mockResolvedValue([]),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          makeRow({
            ...reportOverrides,
            status: data.status,
            adminNotes: (data.adminNotes as string | null) ?? null,
            resolvedAt: (data.resolvedAt as Date | null) ?? null,
            resolvedBy: (data.resolvedBy as string | null) ?? null,
          }),
        ),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    }
    prisma.$transaction = jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma))
    const redis = { consumeRateLimit: jest.fn().mockResolvedValue(true) }
    const storage = { store: jest.fn().mockResolvedValue('/uploads/report-1.png'), read: jest.fn() }
    const config = { get: jest.fn(() => 5_000_000) }
    const notifications = { notify: jest.fn().mockResolvedValue(undefined) }
    const service = new ReportsService(
      prisma as never,
      redis as never,
      storage as never,
      config as never,
      notifications as never,
    )
    return { service, prisma, redis, storage, config, notifications }
  }

  it('accepts submissions from students and stamps server-side identity + telemetry', async () => {
    const { service, prisma } = build()

    await service.create(studentUser, {
      category: 'geofence_gps',
      severity: 'high',
      title: 'Kept saying outside geofence',
      description: 'Standing inside the classroom and the app rejects the scan.',
      screenshotData: VALID_SCREENSHOT,
      deviceInfo: ' Android 14 ',
      route: ' /(tabs)/scan ',
      networkType: 'cellular',
    } as never)

    const created = prisma.systemReport.create.mock.calls[0][0]
    expect(created.data).toMatchObject({
      userId: 'student-1',
      userRole: 'student',
      category: 'geofence_gps',
      severity: 'high',
      title: 'Kept saying outside geofence',
      description: 'Standing inside the classroom and the app rejects the scan.',
      deviceInfo: 'Android 14',
      route: '/(tabs)/scan',
      screenshotUrl: '/uploads/report-1.png',
    })
    expect(created.include.user.select).toMatchObject({ fullName: true })
  })

  it('rejects admins from the submit stream', async () => {
    const { service } = build()
    await expect(
      service.create(adminUser, {
        category: 'ui_display',
        severity: 'low',
        title: 'Not allowed',
        description: 'admins cannot submit',
      } as never),
    ).rejects.toThrow(ForbiddenException)
  })

  it('rate limits submissions per account', async () => {
    const { service, redis } = build()
    redis.consumeRateLimit.mockResolvedValueOnce(false)
    await expect(
      service.create(studentUser, {
        category: 'ui_display',
        severity: 'low',
        title: 'rate limit',
        description: 'too many submissions',
      } as never),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS })
  })

  it('keeps the report alive when screenshot storage fails', async () => {
    const { service, prisma, storage } = build()
    storage.store.mockRejectedValueOnce(new Error('disk full'))

    const result = await service.create(teacherUser, {
      category: 'ui_display',
      severity: 'medium',
      title: 'Dark mode contrast',
      description: 'Buttons are invisible in dark mode.',
      screenshotData: VALID_SCREENSHOT,
    } as never)

    expect(result).toMatchObject({ title: 'Dark mode contrast' })
    const data = prisma.systemReport.create.mock.calls[0][0].data
    expect(data.screenshotUrl).toBeUndefined()
  })

  it('returns the submitter stream with the streaming endpoint', async () => {
    const { service, prisma } = build()
    prisma.systemReport.findMany.mockResolvedValue([makeRow()])

    const rows = await service.myReports(studentUser)

    expect(prisma.systemReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'student-1' }, orderBy: { createdAt: 'desc' }, take: 100 }),
    )
    expect(rows[0]).toMatchObject({ screenshotUrl: '/api/reports/report-1/screenshot' })
    expect(rows[0].user).toMatchObject({ fullName: 'Juan Dela Cruz' })
  })

  it('rejects non-admins from triage routes', async () => {
    const { service } = build()
    await expect(service.list(studentUser, {} as never)).rejects.toThrow(ForbiddenException)
    await expect(service.stats(teacherUser)).rejects.toThrow(ForbiddenException)
  })

  it('composes filters for the admin directory', async () => {
    const { service, prisma } = build()
    prisma.systemReport.count.mockResolvedValue(0)
    prisma.systemReport.findMany.mockResolvedValue([])

    await service.list(adminUser, {
      category: 'geofence_gps',
      severity: 'critical',
      status: 'open',
      role: 'student',
      search: 'gps',
      startDate: '2026-10-01',
      endDate: '2026-10-02',
      limit: '10',
      offset: '5',
    } as never)

    expect(prisma.systemReport.findMany.mock.calls[0][0]).toMatchObject({
      where: {
        AND: expect.arrayContaining([
          { category: 'geofence_gps' },
          { severity: 'critical' },
          { status: 'open' },
          { userRole: 'student' },
          {
            OR: [
              { title: { contains: 'gps', mode: 'insensitive' } },
              { description: { contains: 'gps', mode: 'insensitive' } },
            ],
          },
          { createdAt: expect.objectContaining({ gte: new Date('2026-10-01T00:00:00.000Z') }) },
        ]),
      },
      take: 10,
      skip: 5,
    })
    expect(prisma.systemReport.count.mock.calls[0][0]).toEqual({ where: { AND: expect.any(Array) } })
  })

  it('rejects invalid calendar dates', async () => {
    const { service } = build()
    await expect(service.list(adminUser, { startDate: '2026-13-40' } as never)).rejects.toThrow(
      'Dates must use a real YYYY-MM-DD calendar date',
    )
  })

  it('aggregates cockpit stats', async () => {
    const { service, prisma } = build()
    prisma.systemReport.count.mockImplementation(
      async (args?: { where?: { severity?: unknown; category?: { in?: unknown }; resolvedAt?: unknown } }) => {
        const where = args?.where
        if (
          where?.severity === 'critical' ||
          (where?.severity as { equals?: unknown } | undefined)?.equals === 'critical'
        )
          return 2
        return where?.category?.in ? 3 : where?.resolvedAt ? 4 : 9
      },
    )
    prisma.systemReport.groupBy.mockResolvedValue([
      { status: 'open', _count: { _all: 5 } },
      { status: 'in_review', _count: { _all: 2 } },
    ])

    const stats = await service.stats(adminUser)

    expect(stats).toEqual({
      total: 9,
      open: 5,
      inReview: 2,
      resolved: 0,
      dismissed: 0,
      scannerAndGps: 3,
      resolvedThisMonth: 4,
      critical: 2,
    })
  })

  it('resolves a report: stamps resolution, audits, and notifies the submitter', async () => {
    const { service, prisma, notifications } = build()
    prisma.systemReport.findUnique.mockResolvedValueOnce(makeRow())

    await service.updateStatus(
      adminUser,
      'report-1',
      { status: 'resolved', adminNotes: 'Calibrated Room 302 geofence; verified.' } as never,
      '203.0.113.5',
    )

    const updateArgs = prisma.systemReport.update.mock.calls[0][0]
    expect(updateArgs.where).toEqual({ id: 'report-1' })
    expect(updateArgs.data).toMatchObject({
      status: 'resolved',
      adminNotes: 'Calibrated Room 302 geofence; verified.',
      resolvedAt: expect.any(Date),
      resolvedBy: 'admin-1',
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-1',
        action: 'admin.report.status_changed',
        entityType: 'system_report',
        metadata: expect.objectContaining({
          from: 'open',
          to: 'resolved',
          ipAddress: '203.0.113.5',
          noteUpdated: true,
        }),
      }),
    })
    expect(notifications.notify).toHaveBeenCalledWith(
      'student-1',
      expect.objectContaining({ type: 'system_report_resolved', title: 'Your report was resolved' }),
    )
  })

  it('clears resolution stamps when a resolved report moves back', async () => {
    const { service, prisma, notifications } = build()
    prisma.systemReport.findUnique.mockResolvedValueOnce(makeRow({ status: 'resolved', adminNotes: 'old note' }))

    await service.updateStatus(adminUser, 'report-1', { status: 'open' } as never)

    expect(prisma.systemReport.update.mock.calls[0][0].data).toMatchObject({
      status: 'open',
      resolvedAt: null,
      resolvedBy: null,
    })
    expect(notifications.notify).not.toHaveBeenCalled()
  })

  it('is read-only for department-scoped super admins', async () => {
    const { service, prisma } = build()
    prisma.systemReport.findUnique.mockResolvedValueOnce(makeRow())

    await expect(
      service.updateStatus(departmentAdmin, 'report-1', { status: 'in_review' } as never),
    ).rejects.toMatchObject({
      response: { message: 'Department administrators have read-only access to system reports' },
    })
    expect(prisma.systemReport.update).not.toHaveBeenCalled()
  })

  it('rate limits triage updates and misses report 404s', async () => {
    const { service, redis, prisma } = build()
    prisma.systemReport.findUnique.mockResolvedValueOnce(makeRow())
    redis.consumeRateLimit.mockResolvedValue(false)

    await expect(service.updateStatus(adminUser, 'report-1', { status: 'in_review' } as never)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    })
  })

  it('marks missing reports as 404 on triage', async () => {
    const { service, prisma } = build()
    prisma.systemReport.findUnique.mockResolvedValueOnce(null)

    await expect(service.updateStatus(adminUser, 'missing', { status: 'open' } as never)).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('streams screenshots only to the owner or a super admin', async () => {
    const { service, prisma, storage } = build()
    const buffer = Buffer.from('png')
    storage.read.mockResolvedValue({ buffer, contentType: 'image/png' })
    prisma.systemReport.findUnique.mockResolvedValue({ userId: 'student-1', screenshotUrl: '/uploads/report-1.png' })

    await expect(storage.read).not.toHaveBeenCalled()
    const owner = await service.screenshot(studentUser, 'report-1')
    expect(owner).toEqual({ buffer, contentType: 'image/png' })
    await expect(service.screenshot(teacherUser, 'report-1')).rejects.toThrow(ForbiddenException)
    await expect(service.screenshot(adminUser, 'report-1')).resolves.toMatchObject({ contentType: 'image/png' })
    prisma.systemReport.findUnique.mockResolvedValueOnce({ userId: 'student-1', screenshotUrl: null })
    await expect(service.screenshot(studentUser, 'report-1')).rejects.toBeInstanceOf(NotFoundException)
  })
})
