import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import type { DeviceSecurityEvidence } from '@polycheck/shared'

export type DeviceSecuritySnapshot = Required<DeviceSecurityEvidence>

// Well-known root binary and package locations on Android.
const KNOWN_ROOT_PATHS = [
  '/system/bin/su',
  '/system/xbin/su',
  '/sbin/su',
  '/system/sd/xbin/su',
  '/system/bin/failsafe/su',
  '/data/local/xbin/su',
  '/data/local/bin/su',
  '/data/local/su',
  '/system/app/Superuser.apk',
  '/system/app/SuperSU.apk',
  '/system/app/Magisk.apk',
  '/sbin/.magisk',
  '/data/adb/magisk',
  '/data/adb/ksu',
]

// Best-effort jailbreak indicators. Expo cannot provide a hardware-backed
// jailbreak verdict, but probing these paths catches common unsandboxed
// installations without making an OS attestation claim.
const KNOWN_JAILBREAK_PATHS = [
  '/Applications/Cydia.app',
  '/Applications/Sileo.app',
  '/Library/MobileSubstrate/MobileSubstrate.dylib',
  '/Library/MobileSubstrate/DynamicLibraries',
  '/private/var/lib/apt',
  '/private/var/stash',
  '/usr/sbin/sshd',
]

const EMULATOR_MARKERS = /(?:^|[\s:_/-])(generic|unknown|emulator|sdk(?:_gphone)?|goldfish|ranchu|vbox|qemu|x86(?:_64)?)(?:$|[\s:_/-])/i

type AndroidDeviceConstants = {
  Brand?: string
  Manufacturer?: string
  Model?: string
  Fingerprint?: string
  Hardware?: string
  Product?: string
  isTesting?: boolean
}

/**
 * Checks for known root/su binaries on Android file system.
 */
const checkRootFiles = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false
  try {
    const paths = Platform.OS === 'android' ? KNOWN_ROOT_PATHS : KNOWN_JAILBREAK_PATHS
    for (const path of paths) {
      const fileInfo = await FileSystem.getInfoAsync(`file://${path}`).catch(() => null)
      if (fileInfo && fileInfo.exists) {
        return true
      }
    }
  } catch {
    // If permission or filesystem error occurs, proceed safely
  }
  return false
}

/**
 * Checks for active dynamic instrumentation or hooking frameworks (e.g. Frida, Xposed).
 */
const checkHooking = (): boolean => {
  if (Platform.OS === 'web') return false
  try {
    const runtime = globalThis as typeof globalThis & Record<string, unknown>
    if (
      runtime.__frida ||
      runtime._frida ||
      runtime.Frida ||
      typeof runtime.__frida_init !== 'undefined' ||
      runtime.__xposed ||
      runtime.XposedBridge
    ) {
      return true
    }
  } catch {
    // Ignore runtime inspection errors
  }
  return false
}

/**
 * Checks if the app is executing inside a generic software emulator.
 */
const checkEmulator = (): boolean => {
  if (Platform.OS !== 'android') return false
  try {
    // These values are supplied by the native runtime, rather than inferred
    // from JavaScript globals. The marker list intentionally targets common
    // emulator fingerprints and avoids treating every debug/test build as an
    // emulator.
    const constants = Platform.constants as AndroidDeviceConstants
    if (constants.isTesting) return false
    const fingerprint = [
      constants.Brand,
      constants.Manufacturer,
      constants.Model,
      constants.Fingerprint,
      constants.Hardware,
      constants.Product,
    ]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .join(' ')
    return EMULATOR_MARKERS.test(fingerprint)
  } catch {
    // A missing/unreadable platform constant is inconclusive. Attestation is
    // required for a tamper-resistant decision; local checks remain advisory.
  }
  return false
}

/**
 * Gathers a complete on-device security snapshot for attendance verification.
 * Runs 100% locally and offline with zero cloud API dependencies.
 */
export const getDeviceSecuritySnapshot = async (): Promise<DeviceSecuritySnapshot> => {
  if (Platform.OS === 'web') {
    return {
      rootDetected: false,
      hookDetected: false,
      emulatorDetected: false,
    }
  }

  // This remains a best-effort heuristic. App Attest/DeviceCheck (or a native
  // integrity module) is required for a tamper-resistant platform verdict.
  const rootDetected = await checkRootFiles()
  const hookDetected = checkHooking()
  const emulatorDetected = checkEmulator()

  return {
    rootDetected,
    hookDetected,
    emulatorDetected,
  }
}
