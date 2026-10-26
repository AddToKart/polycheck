/**
 * QR fallback policy (image upload + manual token entry).
 *
 * Secure by default: fallbacks are available only when the build explicitly
 * sets EXPO_PUBLIC_ALLOW_QR_FALLBACKS="true". Production builds pin "false"
 * (eas.json production env) and CI builds the release APK with "false".
 */
export function isQrFallbackEnabled(value: string | undefined): boolean {
  return value === 'true'
}
