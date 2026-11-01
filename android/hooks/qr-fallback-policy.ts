import type { SessionMode } from '@polycheck/shared'

/**
 * QR fallback policy (image upload + manual token entry).
 *
 * In-person sessions keep the secure-by-default posture: fallbacks are
 * available only when the build explicitly sets
 * EXPO_PUBLIC_ALLOW_QR_FALLBACKS="true". Production builds pin "false"
 * (eas.json production env) and CI builds the release APK with "false".
 *
 * Online (hybrid) sessions are different by design: most students attend on a
 * single phone whose camera cannot photograph its own screen, so screenshot
 * upload is a core, always-available check-in channel for them.
 */
export function isQrFallbackEnabled(value: string | undefined): boolean {
  return value === 'true'
}

export function shouldShowScanFallbacks(
  value: string | undefined,
  mode: SessionMode | null | undefined,
): boolean {
  if (mode === 'online') return true
  return isQrFallbackEnabled(value)
}
