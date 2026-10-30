import { Platform } from 'react-native'
import Constants from 'expo-constants'

/** Pure telemetry builders for mobile system reports (SR-LD7). */

export function buildMobileDeviceLabel(): string {
  return `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${String(Platform.Version)}`
}

export function buildMobileAppVersion(): string | undefined {
  const native = Constants.nativeApplicationVersion
  const configVersion = Constants.expoConfig?.version
  const version = native ?? configVersion
  return version ? `Expo v${version}` : undefined
}

/** Adding expo-network requires a dev-client rebuild (fast-follow, SR-LD7). */
export const MOBILE_NETWORK_TYPE = 'unknown'
