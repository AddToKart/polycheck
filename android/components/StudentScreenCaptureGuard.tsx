import { useEffect } from 'react'
import * as ScreenCapture from 'expo-screen-capture'

/**
 * Keeps student attendance evidence and the digital ID out of screenshots,
 * screen recordings, and Android recent-app previews while signed in.
 *
 * NOTE: For development and preview builds (where developers/testers need to
 * view the app via emulator mirrors, scrcpy, or take verification screenshots),
 * screen capture prevention is bypassed unless explicitly enabled in production.
 */
export function StudentScreenCaptureGuard() {
  useEffect(() => {
    // Only enforce screen capture block in production release builds when explicitly configured
    const enableScreenGuard = process.env.EXPO_PUBLIC_ENABLE_SCREEN_GUARD === 'true'

    if (!enableScreenGuard) {
      void ScreenCapture.allowScreenCaptureAsync('polycheck-student-privacy').catch(() => {})
      void ScreenCapture.allowScreenCaptureAsync().catch(() => {})
      return
    }

    void ScreenCapture.preventScreenCaptureAsync('polycheck-student-privacy').catch(() => {})
    return () => {
      void ScreenCapture.allowScreenCaptureAsync('polycheck-student-privacy').catch(() => {})
      void ScreenCapture.allowScreenCaptureAsync().catch(() => {})
    }
  }, [])

  return null
}
