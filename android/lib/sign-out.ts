import { Alert } from 'react-native'
import { router } from 'expo-router'
import { api } from '../services/api-client'

/**
 * Sign-out navigation guard.
 *
 * Signing out flips the auth store to `null`, so the root layout and every
 * screen-level `useAuthGate` also react with their own `router.replace('/')`.
 * On staff stacks that competing redirect can land while this helper's own
 * replace is tearing the screen down, which crashes the native navigator.
 * The in-flight stamp lets those listeners stand down until the sign-out
 * navigation has settled.
 */
const SIGN_OUT_STAMP_MS = 2000
let signOutInFlight = false
let clearTimer: ReturnType<typeof setTimeout> | null = null

/** True while this helper owns the logout navigation. */
export function isSignOutInFlight(): boolean {
  return signOutInFlight
}

function armSignOutStamp(delayMs: number) {
  if (clearTimer) clearTimeout(clearTimer)
  clearTimer = setTimeout(() => {
    clearTimer = null
    // Clear on the next frame so the stamp survives any navigation work that
    // was already queued when the timer fired. A re-stamp in that window keeps
    // the guard armed (its timer is non-null at clear time).
    requestAnimationFrame(() => {
      if (!clearTimer) signOutInFlight = false
    })
  }, delayMs)
}

/**
 * Programmatic sign-out for flows that already confirmed (e.g. device
 * unregister). Stamps the guard, clears the local session and navigates
 * without waiting for the server round-trip.
 */
export function signOutNow(): void {
  // Stamp synchronously, before the auth listener fires, so the root router
  // and any mounted screen gate can see it.
  signOutInFlight = true
  armSignOutStamp(SIGN_OUT_STAMP_MS)

  void api.logout()
  router.replace('/')

  // Keep the guard armed through the navigation commit: re-arm the window
  // once the next frame after the replace has been scheduled, so a slow first
  // frame cannot shorten it.
  requestAnimationFrame(() => {
    if (signOutInFlight) armSignOutStamp(SIGN_OUT_STAMP_MS)
  })
}

/**
 * Destructive-action guard for signing out. Every user-initiated sign-out
 * affordance must go through this helper - logging out clears the encrypted
 * offline store owner and the session, so it deserves a confirmation step.
 */
export function confirmSignOut() {
  Alert.alert(
    'Sign out?',
    'You will need to sign in again to use Polycheck.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => signOutNow(),
      },
    ],
  )
}
