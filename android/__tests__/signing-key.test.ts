jest.mock('expo-secure-store')
jest.mock('expo-crypto')
jest.mock('expo-sqlite')
jest.mock('expo-constants')
jest.mock('react-native')
jest.mock('@polycheck/shared', () => ({
  createSigningKeyPair: jest.fn().mockReturnValue({
    publicKey: 'mocked-public-key',
    secretKey: 'mocked-secret-key',
  }),
  isWithinGeofence: jest.fn(),
  signQRToken: jest.fn(),
  verifyQRToken: jest.fn(),
}))

import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import { createSigningKeyPair } from '@polycheck/shared'
import { getOrCreateTeacherSigningKey } from '../services/signing-key'

describe('signing-key', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null)
    ;(SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined)
    ;(Crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32))
  })

  it('generates a new key pair when no existing keys are found', async () => {
    const result = await getOrCreateTeacherSigningKey()

    expect(result.publicKey).toBe('mocked-public-key')
    expect(result.secretKey).toBe('mocked-secret-key')
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(32)
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'polycheck-teacher-signing-secret',
      'mocked-secret-key',
    )
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'polycheck-teacher-signing-public',
      'mocked-public-key',
    )
  })

  it('returns existing keys from SecureStore without generating new ones', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === 'polycheck-teacher-signing-secret') return Promise.resolve('existing-secret')
      if (key === 'polycheck-teacher-signing-public') return Promise.resolve('existing-public')
      return Promise.resolve(null)
    })

    const result = await getOrCreateTeacherSigningKey()

    expect(result.publicKey).toBe('existing-public')
    expect(result.secretKey).toBe('existing-secret')
    expect(Crypto.getRandomBytesAsync).not.toHaveBeenCalled()
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled()
  })

  it('generates new keys when only public key exists (partial state)', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === 'polycheck-teacher-signing-public') return Promise.resolve('orphaned-public')
      return Promise.resolve(null)
    })

    const result = await getOrCreateTeacherSigningKey()

    expect(result.publicKey).toBe('mocked-public-key')
    expect(result.secretKey).toBe('mocked-secret-key')
  })

  it('generates new keys when only secret key exists (partial state)', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === 'polycheck-teacher-signing-secret') return Promise.resolve('orphaned-secret')
      return Promise.resolve(null)
    })

    const result = await getOrCreateTeacherSigningKey()

    expect(result.publicKey).toBe('mocked-public-key')
    expect(result.secretKey).toBe('mocked-secret-key')
  })

  it('uses exactly 32 bytes of randomness for key generation', async () => {
    const fakeSeed = new Uint8Array(32).fill(42)
    ;(Crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(fakeSeed)

    await getOrCreateTeacherSigningKey()

    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(32)
    expect(createSigningKeyPair).toHaveBeenCalledWith(fakeSeed)
  })
})
