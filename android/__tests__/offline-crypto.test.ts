jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}))
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
}))

import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import {
  decryptOfflineValue,
  encryptOfflineValue,
  resetOfflineCryptoForTests,
} from '../services/offline-crypto'

describe('offline-crypto', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetOfflineCryptoForTests()
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null)
    ;(SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined)
    ;(Crypto.getRandomBytesAsync as jest.Mock).mockImplementation(async (size: number) =>
      new Uint8Array(size).fill(size),
    )
  })

  it('encrypts sensitive offline payloads and authenticates them on read', async () => {
    const payload = { qrToken: 'secret-token', latitude: 14.6, longitude: 121 }
    const encrypted = await encryptOfflineValue(payload)

    expect(encrypted).toMatch(/^v1\./)
    expect(encrypted).not.toContain('secret-token')
    await expect(decryptOfflineValue(encrypted)).resolves.toEqual(payload)
  })

  it('rejects tampered ciphertext', async () => {
    const encrypted = await encryptOfflineValue({ id: 'scan-1' })
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`

    await expect(decryptOfflineValue(tampered)).rejects.toThrow(
      'Offline data could not be authenticated',
    )
  })

  it('fails closed when its secure key cannot be persisted', async () => {
    ;(SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('keystore unavailable'))

    await expect(encryptOfflineValue({ id: 'scan-1' })).rejects.toThrow('keystore unavailable')
  })
})
