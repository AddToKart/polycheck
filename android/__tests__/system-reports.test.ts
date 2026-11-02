import { Platform } from 'react-native'
import Constants from 'expo-constants'

// Pure mobile-side logic for the system-reports intake (telemetry builders,
// base64 streaming conversion). Rendering parity is covered by the web suite.
jest.mock('expo-constants', () => ({
  nativeApplicationVersion: '1.2.0',
  expoConfig: { version: '2.0.0', hostUri: 'http://192.168.1.50:8081' },
  expoGoConfig: { debuggerHost: '192.168.1.50:8081' },
}))

import { buildMobileAppVersion, buildMobileDeviceLabel, MOBILE_NETWORK_TYPE } from '../lib/report-telemetry'
import { bytesToBase64 } from '../lib/base64'

describe('mobile report telemetry', () => {
  it('labels the device platform and version', () => {
    const label = buildMobileDeviceLabel()
    expect(label.startsWith(Platform.OS === 'ios' ? 'iOS' : 'Android')).toBe(true)
    expect(label).toContain(String(Platform.Version))
  })

  it('prefers the native application version', () => {
    expect(buildMobileAppVersion()).toBe('Expo v1.2.0')
  })

  it('documents the unknown network placeholder until expo-network lands', () => {
    expect(MOBILE_NETWORK_TYPE).toBe('unknown')
  })
})

describe('bytesToBase64', () => {
  it('encodes known vectors', () => {
    const utf8 = (text: string) => new Uint8Array(Buffer.from(text, 'utf8'))
    expect(bytesToBase64(new Uint8Array([]))).toBe('')
    expect(bytesToBase64(utf8('f'))).toBe('Zg==')
    expect(bytesToBase64(utf8('fo'))).toBe('Zm8=')
    expect(bytesToBase64(utf8('foo'))).toBe('Zm9v')
    expect(bytesToBase64(utf8('foob'))).toBe('Zm9vYg==')
    expect(bytesToBase64(utf8('fooba'))).toBe('Zm9vYmE=')
    expect(bytesToBase64(utf8('foobar'))).toBe('Zm9vYmFy')
  })
})
