import { Injectable } from '@nestjs/common'
import { AttendanceService } from '../attendance/attendance.service'
import type { ScanAttendanceDto } from '../attendance/dto/attendance.dto'
import type { RequestUser } from '../auth/strategies/jwt.strategy'

@Injectable()
export class SyncService {
  constructor(private readonly attendance: AttendanceService) {}

  async submit(user: RequestUser, records: ScanAttendanceDto[]) {
    // Attendance sync is processed synchronously so the device only deletes its local
    // source-of-truth record after receiving a durable per-record result.
    return { queued: false, results: await this.processRecords(user, records) }
  }

  private async processRecords(user: RequestUser, records: ScanAttendanceDto[]) {
    const results: Array<Awaited<ReturnType<AttendanceService['syncScan']>>> = []
    for (const record of records) results.push(await this.attendance.syncScan(user, record))
    return results
  }
}
