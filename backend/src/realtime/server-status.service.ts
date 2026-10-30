import { Injectable } from '@nestjs/common'
import { SERVER_METRICS_EVENT, SERVER_METRICS_ROOM } from '@polycheck/shared'
import type { ServerStatusSnapshot } from '@polycheck/shared'
import { MetricsService } from '../observability/metrics.service'

export const SERVER_STATUS_INTERVAL_MS = 5_000

type StatusPublisher = {
  to(room: string): { emit(event: string, payload: ServerStatusSnapshot): unknown }
}

/**
 * Holds the live socket count for this backend instance and builds/publishes
 * the snapshots streamed to the super-admin Server Status room (SA7).
 */
@Injectable()
export class ServerStatusService {
  private activeSockets = 0

  constructor(private readonly metrics: MetricsService) {}

  setActiveSockets(count: number) {
    this.activeSockets = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
  }

  getActiveSockets() {
    return this.activeSockets
  }

  async snapshot(): Promise<ServerStatusSnapshot> {
    return this.metrics.snapshot(this.activeSockets)
  }

  publish(server: StatusPublisher, snapshot: ServerStatusSnapshot) {
    server.to(SERVER_METRICS_ROOM).emit(SERVER_METRICS_EVENT, snapshot)
  }
}
