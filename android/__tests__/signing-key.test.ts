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
    const result = await getOrCreateTeacherSigningKey('teacher-1')

    expect(result.publicKey).toBe('mocked-public-key')
    expect(result.secretKey).toBe('mocked-secret-key')
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(32)
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'polycheck.teacher-signing-secret.teacher-1',
      'mocked-secret-key',
    )
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'polycheck.teacher-signing-public.teacher-1',
      'mocked-public-key',
    )
  })

  it('returns existing keys from SecureStore without generating new ones', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === 'polycheck.teacher-signing-secret.teacher-1') return Promise.resolve('existing-secret')
      if (key === 'polycheck.teacher-signing-public.teacher-1') return Promise.resolve('existing-public')
      return Promise.resolve(null)
    })

    const result = await getOrCreateTeacherSigningKey('teacher-1')

    expect(result.publicKey).toBe('existing-public')
    expect(result.secretKey).toBe('existing-secret')
    expect(Crypto.getRandomBytesAsync).not.toHaveBeenCalled()
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled()
  })

  it('generates new keys when only public key exists (partial state)', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === 'polycheck.teacher-signing-public.teacher-1') return Promise.resolve('orphaned-public')
      return Promise.resolve(null)
    })

    await expect(getOrCreateTeacherSigningKey('teacher-1')).rejects.toThrow('storage is incomplete')
  })

  it('generates new keys when only secret key exists (partial state)', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === 'polycheck.teacher-signing-secret.teacher-1') return Promise.resolve('orphaned-secret')
      return Promise.resolve(null)
    })

    await expect(getOrCreateTeacherSigningKey('teacher-1')).rejects.toThrow('storage is incomplete')
  })

  it('uses exactly 32 bytes of randomness for key generation', async () => {
    const fakeSeed = new Uint8Array(32).fill(42)
    ;(Crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(fakeSeed)

    await getOrCreateTeacherSigningKey('teacher-1')

    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(32)
    expect(createSigningKeyPair).toHaveBeenCalledWith(fakeSeed)
  })

  it('keeps different teacher accounts in different SecureStore slots', async () => {
    await getOrCreateTeacherSigningKey('teacher-1')
    await getOrCreateTeacherSigningKey('teacher-2')

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'polycheck.teacher-signing-secret.teacher-1',
      'mocked-secret-key',
    )
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'polycheck.teacher-signing-secret.teacher-2',
      'mocked-secret-key',
    )
  })

  it('fails closed and removes a partial write when SecureStore rejects', async () => {
    ;(SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('keystore full'))

    await expect(getOrCreateTeacherSigningKey('teacher-1')).rejects.toThrow(
      'Unable to persist the teacher signing key securely',
    )
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'polycheck.teacher-signing-secret.teacher-1',
    )
  })
})
