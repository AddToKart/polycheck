import { Injectable } from '@nestjs/common'
import { haversineDistance } from '@polycheck/shared'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class GeofenceService {
  constructor(private readonly prisma: PrismaService) {}

  async hasSuspiciousCoordinates(
    studentId: string,
    sessionId: string,
    deviceId: string | undefined,
    latitude: number,
    longitude: number,
  ) {
    if (!deviceId) return false
    const previous = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        deviceId,
        sessionId: { not: sessionId },
        status: { in: ['present', 'late', 'disputed'] },
        manuallySet: false,
      },
      select: {
        latitude: true,
        longitude: true,
        session: { select: { geofenceLatitude: true, geofenceLongitude: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 5,
    })
    const identical = previous.filter(
      (record) =>
        Math.abs(record.latitude - latitude) < 0.0000001 && Math.abs(record.longitude - longitude) < 0.0000001,
    )
    const exactCenter = previous.some(
      (record) =>
        Math.abs(record.session.geofenceLatitude - latitude) < 0.0000001 &&
        Math.abs(record.session.geofenceLongitude - longitude) < 0.0000001,
    )
    return identical.length >= 2 || (exactCenter && identical.length >= 1)
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    return haversineDistance(lat1, lon1, lat2, lon2)
  }
}
