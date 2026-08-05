jest.mock('expo-secure-store')
jest.mock('expo-crypto')

import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { getOrCreateInstallationId, resetInstallationIdForTests } from '../services/device-id'

describe('mobile installation identity', () => {
  beforeEach(() => {
    ;(SecureStore as typeof SecureStore & { _reset(): void })._reset()
    resetInstallationIdForTests()
    let stored: string | null = null
    jest.spyOn(SecureStore, 'getItemAsync').mockImplementation(async () => stored)
    jest.spyOn(SecureStore, 'setItemAsync').mockImplementation(async (_key, value) => {
      stored = value
    })
    jest.spyOn(Crypto, 'getRandomBytesAsync').mockResolvedValue(Uint8Array.from({ length: 16 }, (_, index) => index))
  })

  afterEach(() => jest.restoreAllMocks())

  it('creates and persists a stable opaque installation ID', async () => {
    const first = await getOrCreateInstallationId()
    resetInstallationIdForTests()
    const second = await getOrCreateInstallationId()

    expect(first).toBe('mobile-000102030405060708090a0b0c0d0e0f')
    expect(second).toBe(first)
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledTimes(1)
  })

  it('fails closed when secure persistence is unavailable', async () => {
    jest.spyOn(SecureStore, 'setItemAsync').mockRejectedValueOnce(new Error('keystore unavailable'))

    await expect(getOrCreateInstallationId()).rejects.toThrow('secure installation identity')
  })
})
