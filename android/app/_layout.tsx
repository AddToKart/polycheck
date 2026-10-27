import '../global.css'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { ActivityIndicator, AppState, View } from 'react-native'
import { ThemeProvider, useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import { api, subscribeToAuthChanges } from '../services/api-client'
import { monitorAuthSession } from '../services/realtime'
import {
  configureForegroundNotifications,
  registerForPushNotifications,
  subscribeToNotificationOpens,
} from '../services/push-notifications'
import type { User } from '@polycheck/shared'
import { PrivacyConsentGate } from '../components/PrivacyConsentGate'
import { StudentScreenCaptureGuard } from '../components/StudentScreenCaptureGuard'
import { CampusToastProvider, useCampusToast } from '../components/CampusToast'
import * as Sentry from '@sentry/react-native'

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN
Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn) && process.env.EXPO_PUBLIC_E2E_MODE !== 'true',
  sendDefaultPii: false,
  tracesSampleRate: 0.05,
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies
      delete event.request.headers
      delete event.request.data
      delete event.request.query_string
    }
    if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined
    return event
  },
})

SplashScreen.preventAutoHideAsync()
configureForegroundNotifications()

function RootLayoutInner() {
  const { isDark } = useTheme()
  const { showToast } = useCampusToast()
  const router = useRouter()
  const segments = useSegments()
  // Stable ref so navigation callbacks always use the latest router
  const routerRef = useRef(router)
  routerRef.current = router
  // Stable ref so the one-shot bootstrap effect can notify without rerunning
  const toastRef = useRef(showToast)
  toastRef.current = showToast

  const [sessionReady, setSessionReady] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [fontsLoaded] = useFonts({
    DMSans_400Regular: require('@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf'),
    DMSans_500Medium: require('@expo-google-fonts/dm-sans/500Medium/DMSans_500Medium.ttf'),
    DMSans_600SemiBold: require('@expo-google-fonts/dm-sans/600SemiBold/DMSans_600SemiBold.ttf'),
    DMSans_700Bold: require('@expo-google-fonts/dm-sans/700Bold/DMSans_700Bold.ttf'),
    Lora_400Regular: require('../assets/fonts/Lora_400Regular.ttf'),
  })

  // ── Session & sync bootstrap ────────────────────────────────────────────────
  // Runs once on mount. Subscribes to auth changes (for session monitoring)
  // and kicks off the session restore + initial sync.
  useEffect(() => {
    let mounted = true
    let stopAuthMonitor: () => void = () => undefined

    // Mirror module-level auth state into React state so the routing effect
    // below can react to login / logout events without any additional
    // router.replace() calls in individual screens.
    const stopAuthChanges = subscribeToAuthChanges((user) => {
      if (mounted) setCurrentUser(user)
      Sentry.setUser(user ? { id: user.id } : null)

      // Session duplication monitor (for real-time session replaced events)
      stopAuthMonitor()
      stopAuthMonitor = user
        ? monitorAuthSession(() => {
            toastRef.current('error', 'Session ended', 'Your session was replaced or revoked. Please sign in again.')
            void api.logout()
          })
        : () => undefined
    })

    void api.restoreSession()
      .catch((error) => { Sentry.captureException(error) })
      .finally(() => {
        if (!mounted) return
        setSessionReady(true)
        // Pre-sync must never hold the splash screen; it continues in the
        // background and retries on the normal interval.
        void api.preSyncOfflineData().catch((error) => { Sentry.captureException(error) })
      })

    const sync = () => { void api.preSyncOfflineData().catch((error) => { Sentry.captureException(error) }) }
    const interval = setInterval(sync, 30_000)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync()
    })

    return () => {
      mounted = false
      stopAuthChanges()
      stopAuthMonitor()
      clearInterval(interval)
      subscription.remove()
    }
  }, []) // intentionally empty — runs once

  // ── Push notifications ─────────────────────────────────────────────────────
  // Permission + Expo token registration run only after authentication, and
  // tapped notifications route through the same deep-link mapper as the
  // in-app notification center.
  useEffect(() => {
    if (!sessionReady || !currentUser) return
    void registerForPushNotifications(currentUser)
    return subscribeToNotificationOpens(currentUser, (route) => {
      routerRef.current.push(route as never)
    })
  }, [currentUser, sessionReady])

  // ── Centralized auth-driven routing ────────────────────────────────────────
  // This is the SINGLE place that decides where to navigate based on auth
  // state. No screen or component should call router.replace() for auth
  // redirects — they just update auth state via api.login/logout().
  useEffect(() => {
    if (!sessionReady || !fontsLoaded) return

    const inTabsGroup = segments[0] === '(tabs)'
    const inFacultyGroup = segments[0] === '(faculty)'
    const inChangePasswordScreen = segments[0] === 'change-password'

    if (!currentUser) {
      // Not logged in — go to landing if trying to access protected routes
      if (inTabsGroup || inFacultyGroup || inChangePasswordScreen) {
        routerRef.current.replace('/')
      }
    } else if (currentUser.mustChangePassword) {
      // Temporary/admin-reset credential — block every protected route until
      // the user sets a new password.
      if (!inChangePasswordScreen) {
        routerRef.current.replace('/change-password')
      }
    } else if (currentUser.role === 'student') {
      // Student — go to student dashboard unless already in tabs
      if (inChangePasswordScreen || !inTabsGroup) {
        routerRef.current.replace('/(tabs)/dashboard')
      }
    } else if (currentUser.role === 'teacher' || currentUser.role === 'super_admin') {
      // Faculty / super admin — go to faculty dashboard unless already there
      if (inChangePasswordScreen || !inFacultyGroup) {
        routerRef.current.replace('/(faculty)/dashboard')
      }
    }
  // segments included so navigation also fires when the user ends up on the
  // wrong group (e.g. manually navigated to wrong route)
  }, [sessionReady, fontsLoaded, currentUser, segments])

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && sessionReady) {
      await SplashScreen.hideAsync()
    }
  }, [fontsLoaded, sessionReady])

  if (!fontsLoaded || !sessionReady) {
    return (
      <View style={{ flex: 1, backgroundColor: pupColors.maroonDark, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={pupColors.golden} />
      </View>
    )
  }

  return (
    <View className={`flex-1 will-change-variable will-change-container ${isDark ? 'dark' : ''}`} onLayout={onLayoutRootView}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="change-password" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
      {currentUser?.role === 'student' ? <StudentScreenCaptureGuard /> : null}
      <PrivacyConsentGate user={currentUser} />
    </View>
  )
}

function RootLayout() {
  return (
    <ThemeProvider>
      <CampusToastProvider>
        <RootLayoutInner />
      </CampusToastProvider>
    </ThemeProvider>
  )
}

export default Sentry.wrap(RootLayout)
