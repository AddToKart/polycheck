import { SERVER_METRICS_EVENT, SERVER_METRICS_ROOM } from '@polycheck/shared'
import { ServerStatusService } from './server-status.service'

describe('ServerStatusService', () => {
  it('keeps the latest socket count and delegates snapshot construction to metrics', async () => {
    const snapshot = { timestamp: '2026-10-26T00:00:00.000Z', activeSockets: 4 }
    const metrics = { snapshot: jest.fn().mockResolvedValue(snapshot) }
    const service = new ServerStatusService(metrics as never)

    service.setActiveSockets(4)

    expect(service.getActiveSockets()).toBe(4)
    await expect(service.snapshot()).resolves.toBe(snapshot)
    expect(metrics.snapshot).toHaveBeenCalledWith(4)
  })

  it('clamps invalid socket counts to zero', () => {
    const service = new ServerStatusService({ snapshot: jest.fn() } as never)

    service.setActiveSockets(-3)
    expect(service.getActiveSockets()).toBe(0)
    service.setActiveSockets(Number.NaN)
    expect(service.getActiveSockets()).toBe(0)
  })

  it('publishes snapshots to the server metrics room', () => {
    const emit = jest.fn()
    const server = { to: jest.fn().mockReturnValue({ emit }) }
    const service = new ServerStatusService({} as never)
    const snapshot = { timestamp: '2026-10-26T00:00:00.000Z' }

    service.publish(server, snapshot as never)

    expect(server.to).toHaveBeenCalledWith(SERVER_METRICS_ROOM)
    expect(emit).toHaveBeenCalledWith(SERVER_METRICS_EVENT, snapshot)
  })
})
