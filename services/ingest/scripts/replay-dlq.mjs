#!/usr/bin/env node
/**
 * Replays dead-lettered scans from the DLQ stream back into the main ingest stream.
 *
 * Usage:
 *   node scripts/replay-dlq.mjs [--session <sessionId>] [--dry-run]
 *
 * Options:
 *   --session <id>    Only replay entries for this session ID
 *   --dry-run         Display matching DLQ entries without re-enqueueing or deleting
 *   --stream <key>    Target stream key (default: INGEST_STREAM_KEY or 'polycheck:ingest:scans')
 *   --dlq <key>       Source DLQ stream key (default: INGEST_DLQ_STREAM_KEY or 'polycheck:ingest:dead-letter')
 *   --redis <url>     Redis connection URL (default: REDIS_URL or 'redis://127.0.0.1:6379')
 *   --limit <n>       Maximum entries to inspect per run (default: 1000)
 */
import Redis from 'ioredis'
import { fileURLToPath } from 'node:url'

/**
 * @typedef {Object} ReplayOptions
 * @property {string} [targetSession]
 * @property {boolean} [dryRun]
 * @property {string} [streamKey]
 * @property {string} [dlqKey]
 * @property {string} [redisUrl]
 * @property {number} [limit]
 * @property {any} [redis]
 */

/**
 * @param {ReplayOptions} [options]
 */
export async function replayDlq(options = {}) {
  const streamKey = options.streamKey ?? process.env.INGEST_STREAM_KEY ?? 'polycheck:ingest:scans'
  const dlqKey = options.dlqKey ?? process.env.INGEST_DLQ_STREAM_KEY ?? 'polycheck:ingest:dead-letter'
  const redisUrl = options.redisUrl ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
  const limit = options.limit ?? 1000
  const dryRun = Boolean(options.dryRun)
  const targetSession = options.targetSession

  const client = options.redis ?? new Redis(redisUrl, { maxRetriesPerRequest: 2 })
  try {
    const entries = await client.xrange(dlqKey, '-', '+', 'COUNT', limit)
    if (!Array.isArray(entries) || entries.length === 0) {
      return { matched: 0, replayed: 0, dryRun, entries: [] }
    }

    const matched = []
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length < 2) continue
      const [id, fields] = entry
      if (!Array.isArray(fields)) continue

      const fieldMap = new Map()
      for (let i = 0; i < fields.length; i += 2) {
        fieldMap.set(fields[i], fields[i + 1])
      }

      const sessionId = fieldMap.get('sessionId')
      const userId = fieldMap.get('userId')
      const error = fieldMap.get('error')
      const attempts = fieldMap.get('attempts')
      const failedAt = fieldMap.get('failedAt')
      const payload = fieldMap.get('payload')

      if (targetSession && sessionId !== targetSession) continue
      matched.push({ id, sessionId, userId, error, attempts, failedAt, payload })
    }

    if (dryRun) {
      return { matched: matched.length, replayed: 0, dryRun: true, entries: matched }
    }

    let replayed = 0
    for (const item of matched) {
      if (!item.payload) {
        continue
      }
      await client.xadd(streamKey, '*', 'payload', item.payload)
      await client.xdel(dlqKey, item.id)
      replayed += 1
    }
    return { matched: matched.length, replayed, dryRun: false, entries: matched }
  } finally {
    if (!options.redis) {
      client.disconnect()
    }
  }
}

// CLI entry point
const isMain = process.argv[1] && (
  fileURLToPath(import.meta.url) === process.argv[1] ||
  process.argv[1].endsWith('replay-dlq.mjs')
)

if (isMain) {
  const args = process.argv.slice(2)
  const getArg = (flag) => {
    const index = args.indexOf(flag)
    return index >= 0 && index + 1 < args.length ? args[index + 1] : undefined
  }
  const hasFlag = (flag) => args.includes(flag)

  if (hasFlag('--help') || hasFlag('-h')) {
    console.log(`Usage: node scripts/replay-dlq.mjs [--session <sessionId>] [--dry-run]

Options:
  --session <id>    Only replay entries for this session ID
  --dry-run         Display matching DLQ entries without re-enqueueing or deleting
  --stream <key>    Target stream key (default: INGEST_STREAM_KEY or 'polycheck:ingest:scans')
  --dlq <key>       Source DLQ stream key (default: INGEST_DLQ_STREAM_KEY or 'polycheck:ingest:dead-letter')
  --redis <url>     Redis connection URL (default: REDIS_URL or 'redis://127.0.0.1:6379')
  --limit <n>       Maximum entries to inspect per run (default: 1000)`)
    process.exit(0)
  }

  const targetSession = getArg('--session')
  const dryRun = hasFlag('--dry-run')
  const streamKey = getArg('--stream') ?? process.env.INGEST_STREAM_KEY ?? 'polycheck:ingest:scans'
  const dlqKey = getArg('--dlq') ?? process.env.INGEST_DLQ_STREAM_KEY ?? 'polycheck:ingest:dead-letter'
  const redisUrl = getArg('--redis') ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
  const limit = Number(getArg('--limit') ?? 1000)

  try {
    const result = await replayDlq({ targetSession, dryRun, streamKey, dlqKey, redisUrl, limit })
    if (result.matched === 0) {
      console.log(`[replay-dlq] No entries found in dead-letter stream "${dlqKey}".`)
    } else if (result.dryRun) {
      console.log(`[replay-dlq] Found ${result.matched} matching DLQ entries (session: ${targetSession ?? 'all'}, dry-run: true).`)
      for (const item of result.entries) {
        console.log(`[dry-run] ID=${item.id} session=${item.sessionId} user=${item.userId} attempts=${item.attempts} error="${item.error}" failedAt=${item.failedAt}`)
      }
      console.log(`[replay-dlq] Dry-run complete: ${result.matched} entries would be replayed to "${streamKey}".`)
    } else {
      console.log(`[replay-dlq] Found ${result.matched} matching DLQ entries (session: ${targetSession ?? 'all'}, dry-run: false).`)
      console.log(`[replay-dlq] Successfully replayed and acknowledged ${result.replayed} entries from "${dlqKey}" to "${streamKey}".`)
    }
  } catch (error) {
    console.error('[replay-dlq] Replay failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
