import { Test } from '@nestjs/testing'
import { GeofenceService } from './geofence.service'
import { PrismaService } from '../prisma/prisma.service'

jest.mock('@polycheck/shared', () => ({
  haversineDistance: jest.fn(),
}))

import { haversineDistance } from '@polycheck/shared'
const mockedHaversine = haversineDistance as jest.MockedFunction<typeof haversineDistance>

describe('GeofenceService', () => {
  let service: GeofenceService
  let prisma: any

  beforeEach(async () => {
    prisma = { attendanceRecord: { findMany: jest.fn() } }
    const module = await Test.createTestingModule({
      providers: [
        GeofenceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()
    service = module.get(GeofenceService)
    jest.clearAllMocks()
  })

  describe('calculateDistance', () => {
    it('delegates to haversineDistance', () => {
      mockedHaversine.mockReturnValue(42.5)
      const result = service.calculateDistance(14.5, 121.0, 14.6, 121.1)
      expect(result).toBe(42.5)
      expect(mockedHaversine).toHaveBeenCalledWith(14.5, 121.0, 14.6, 121.1)
    })
  })

  describe('hasSuspiciousCoordinates', () => {
    const baseRecord = {
      latitude: 14.5863,
      longitude: 121.0,
      session: { geofenceLatitude: 14.5863, geofenceLongitude: 121.0 },
    }

    it('returns false when deviceId is undefined', async () => {
      const result = await service.hasSuspiciousCoordinates('stu-1', 'sess-1', undefined, 14.5863, 121.0)
      expect(result).toBe(false)
      expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled()
    })

    it('returns false when no previous records exist', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      const result = await service.hasSuspiciousCoordinates('stu-1', 'sess-1', 'device-1', 14.5863, 121.0)
      expect(result).toBe(false)
    })

    it('returns false when fewer than 2 identical coordinate records', async () => {
      // Use a record whose coords differ from the scan AND whose session center
      // also differs so neither identical nor exactCenter triggers.
      prisma.attendanceRecord.findMany.mockResolvedValue([
        { ...baseRecord, latitude: 14.9, longitude: 121.5, session: { geofenceLatitude: 14.9, geofenceLongitude: 121.5 } },
      ])
      const result = await service.hasSuspiciousCoordinates('stu-1', 'sess-1', 'device-1', 14.5863, 121.0)
      expect(result).toBe(false)
    })

    it('returns true when 2+ identical coordinate records exist', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([baseRecord, baseRecord, { ...baseRecord, latitude: 14.9 }])
      const result = await service.hasSuspiciousCoordinates('stu-1', 'sess-1', 'device-1', 14.5863, 121.0)
      expect(result).toBe(true)
    })

    it('returns true when scan hits exact geofence center with 1+ identical record', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([
        baseRecord, // identical coords (14.5863, 121.0) AND same center → triggers both conditions
      ])
      const result = await service.hasSuspiciousCoordinates('stu-1', 'sess-1', 'device-1', 14.5863, 121.0)
      expect(result).toBe(true)
    })

    it('queries only recent non-manual records for the device', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      await service.hasSuspiciousCoordinates('stu-1', 'sess-1', 'device-1', 14.5863, 121.0)
      expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentId: 'stu-1',
            deviceId: 'device-1',
            sessionId: { not: 'sess-1' },
            status: { in: ['present', 'late', 'disputed'] },
            manuallySet: false,
          }),
          take: 5,
        }),
      )
    })
  })
})
