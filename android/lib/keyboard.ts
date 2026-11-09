import { Platform } from 'react-native'

/**
 * Android 15+ (API 35) enforces edge-to-edge, so the window no longer resizes
 * for the keyboard (`adjustResize` becomes a no-op). Screens and modals that
 * hold inputs must apply KeyboardAvoidingView padding themselves there; older
 * Android versions still resize the window, so `undefined` keeps the old
 * behavior and avoids double offsets.
 */
export const keyboardAvoidingBehavior =
  Platform.OS === 'ios' ||
  (Platform.OS === 'android' && Number(Platform.Version) >= 35)
    ? ('padding' as const)
    : undefined
