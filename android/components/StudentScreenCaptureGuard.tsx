import { usePreventScreenCapture } from 'expo-screen-capture'

/**
 * Keeps student attendance evidence and the digital ID out of screenshots,
 * screen recordings, and Android recent-app previews while signed in.
 */
export function StudentScreenCaptureGuard() {
  usePreventScreenCapture('polycheck-student-privacy')
  return null
}
