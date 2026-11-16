/**
 * Tiny internal servers used by the operational roles.
 *
 * The drainer and the cluster primary both need a health/metrics surface that
 * is separate from the client-facing Fastify app (the drainer serves no
 * traffic; the primary owns no sockets). Keeping them in one factory means the
 * `/health/ready` contract (`{ status, checks }`, 503 when degraded) is defined
 * exactly once.
 */
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'

export interface InternalServerDeps {
  /** Evaluates readiness; `false` answers 503 with the same body shape. */
  ready: () => Promise<{ ready: boolean; checks: Record<string, string> }>
  /** Renders the Prometheus exposition for `/metrics`. */
  metricsText: () => Promise<string>
}

export function buildInternalServer(deps: InternalServerDeps): FastifyInstance {
  const app = Fastify({ logger: false })

  const readyHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await deps.ready()
      const body = {
        status: result.ready ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        checks: result.checks,
      }
      return result.ready ? body : reply.code(503).send(body)
    } catch (error) {
      console.error('[ingest] readiness check failed:', error instanceof Error ? error.message : error)
      return reply.code(503).send({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        checks: { internal: 'unavailable' },
      })
    }
  }
  app.get('/health', readyHandler)
  app.get('/health/ready', readyHandler)

  app.get('/metrics', async (_request, reply) =>
    reply.type('text/plain; version=0.0.4; charset=utf-8').send(await deps.metricsText()),
  )

  return app
}
