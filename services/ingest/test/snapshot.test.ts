import { describe, expect, it, vi } from 'vitest'
import type Redis from 'ioredis'
import { ACTIVE_SESSION_KEY_PREFIX, readSessionSnapshot } from '../src/snapshot'

/** Test double: only `get` is reachable from the reader. */
const redisWith = (value: string | null) => ({ get: vi.fn().mockResolvedValue(value) }) as unknown as Redis

const snapshotBody = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: 'sess-1',
    sectionId: 'sec-1',
    teacherId: 'teacher-1',
    isActive: true,
    geofenceLatitude: 14.8697,
    geofenceLongitude: 120.9991,
    geofenceRadiusMeters: 100,
    teacherPublicKey: 'ed25519-public-key',
    ...overrides,
  })

describe('readSessionSnapshot', () => {
  it('uses the control plane key prefix', async () => {
    const redis = redisWith(snapshotBody())
    await readSessionSnapshot(redis, 'sess-1')
    expect(redis.get).toHaveBeenCalledWith('polycheck:active-session:sess-1')
    expect(ACTIVE_SESSION_KEY_PREFIX).toBe('polycheck:active-session:')
  })

  it('takes the teacher key from the snapshot blob rather than a second key', async () => {
    const redis = redisWith(snapshotBody())
    const resolved = await readSessionSnapshot(redis, 'sess-1')
    expect(resolved?.teacherPublicKey).toBe('ed25519-public-key')
    expect(resolved?.snapshot.sectionId).toBe('sec-1')
    // Exactly one Redis read: no second cache that can drift.
    expect(redis.get).toHaveBeenCalledTimes(1)
  })

  it('returns undefined when the session is not cached', async () => {
    await expect(readSessionSnapshot(redisWith(null), 'sess-1')).resolves.toBeUndefined()
  })

  it('rejects a snapshot without a public key instead of validating blindly', async () => {
    const redis = redisWith(snapshotBody({ teacherPublicKey: undefined }))
    await expect(readSessionSnapshot(redis, 'sess-1')).resolves.toBeUndefined()
  })

  it('rejects an empty public key', async () => {
    const redis = redisWith(snapshotBody({ teacherPublicKey: '' }))
    await expect(readSessionSnapshot(redis, 'sess-1')).resolves.toBeUndefined()
  })

  it('rejects malformed JSON rather than throwing into the request path', async () => {
    await expect(readSessionSnapshot(redisWith('{not json'), 'sess-1')).resolves.toBeUndefined()
  })
})
