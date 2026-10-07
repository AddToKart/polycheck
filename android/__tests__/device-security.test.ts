jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn().mockRejectedValue(new Error('deprecated main-module API')),
}))

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
}))

import { Platform } from 'react-native'
import * as LegacyFileSystem from 'expo-file-system/legacy'
import { getDeviceSecuritySnapshot } from '../services/device-security'

const mockedGetInfoAsync = LegacyFileSystem.getInfoAsync as jest.MockedFunction<typeof LegacyFileSystem.getInfoAsync>

describe('device security heuristics', () => {
  const constants = Platform.constants as Record<string, unknown>

  beforeEach(() => {
    mockedGetInfoAsync.mockResolvedValue({ exists: false, isDirectory: false } as never)
    Object.assign(constants, {
      isTesting: false,
      Brand: 'google',
      Manufacturer: 'Google',
      Model: 'Pixel 8',
      Fingerprint: 'google/husky/husky:14/UP1A.231005.007/release-keys',
      Hardware: 'tensor',
      Product: 'husky',
    })
  })

  it('detects a known Android root binary through the supported filesystem API', async () => {
    mockedGetInfoAsync.mockImplementation(async (uri) => ({
      exists: uri === 'file:///system/bin/su',
      isDirectory: false,
    }) as never)

    const snapshot = await getDeviceSecuritySnapshot()

    expect(snapshot.rootDetected).toBe(true)
    expect(mockedGetInfoAsync).toHaveBeenCalledWith('file:///system/bin/su')
  })

  it('detects common Android emulator fingerprints', async () => {
    Object.assign(constants, {
      Model: 'sdk_gphone64_x86_64',
      Fingerprint: 'google/sdk_gphone64_x86_64/emu64xa:35/UE1A.240829.036/release-keys',
      Hardware: 'ranchu',
      Product: 'sdk_gphone64_x86_64',
    })

    const snapshot = await getDeviceSecuritySnapshot()

    expect(snapshot.emulatorDetected).toBe(true)
  })

  it('does not classify a normal Android fingerprint as an emulator', async () => {
    const snapshot = await getDeviceSecuritySnapshot()

    expect(snapshot.emulatorDetected).toBe(false)
    expect(snapshot.rootDetected).toBe(false)
  })
})
