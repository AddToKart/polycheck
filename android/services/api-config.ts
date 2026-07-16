import Constants from 'expo-constants'
import { Platform } from 'react-native'

function normalizeApiUrl(url: string) {
  return url.replace(/\/+$/, '')
}

function extractExpoHost() {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost
  if (!hostUri) return null

  const withoutScheme = hostUri.replace(/^[a-z]+:\/\//i, '')
  return withoutScheme.split(':')[0] || null
}

function getDevelopmentApiUrl() {
  let host = extractExpoHost()

  // Android emulators cannot reach the development machine through localhost.
  if (Platform.OS === 'android' && (!host || host === 'localhost' || host === '127.0.0.1')) {
    host = '10.0.2.2'
  }

  return `http://${host || 'localhost'}:4000/api`
}

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim()

if (!configuredApiUrl && !__DEV__) {
  throw new Error('EXPO_PUBLIC_API_URL must be configured for production builds')
}

/**
 * API endpoint reachable from the device. Expo development derives the Metro
 * host automatically; preview/production builds require an explicit URL.
 */
export const API_BASE = normalizeApiUrl(configuredApiUrl || getDevelopmentApiUrl())
