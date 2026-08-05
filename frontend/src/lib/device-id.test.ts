import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOrCreateWebInstallationId } from './device-id'

describe('web installation identity', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')
  })

  it('persists one opaque ID per browser profile', () => {
    const first = getOrCreateWebInstallationId()
    const second = getOrCreateWebInstallationId()

    expect(first).toBe('web-00000000-0000-4000-8000-000000000001')
    expect(second).toBe(first)
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })
})
