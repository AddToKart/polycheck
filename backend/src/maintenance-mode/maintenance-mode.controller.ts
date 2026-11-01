import { Controller, Get } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { Public } from '../common/decorators/public.decorator'
import { SystemMaintenanceService } from './system-maintenance.service'

/**
 * Public maintenance metadata. Deliberately unauthenticated: the login
 * screens, the Android app boot, and the web overlay all need the same
 * announcement surface that the 503 body publishes, nothing more.
 */
@Controller('maintenance')
export class MaintenanceModeController {
  constructor(private readonly maintenance: SystemMaintenanceService) {}

  @Public()
  @SkipThrottle()
  @Get('status')
  status() {
    return this.maintenance.current()
  }
}
