import '../global.css'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { ActivityIndicator, AppState, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { ThemeProvider, useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import { api, isOwnLoginInFlight, subscribeToAuthChanges } from '../services/api-client'
import { monitorAuthSession } from '../services/realtime'
import { shouldTerminateForReplacedSession } from '../lib/session-replacement'
import {
  configureForegroundNotifications,
  registerForPushNotifications,
  subscribeToNotificationOpens,
} from '../services/push-notifications'
import { isMaintenanceExempt, type User } from '@polycheck/shared'
import {
  getMaintenanceSnapshot,
  setMaintenanceActive,
  subscribeToMaintenance,
  type ActiveMaintenance,
} from '../lib/maintenance'
import { MaintenanceScreen } from '../components/maintenance/MaintenanceScreen'
import { OutageSimulatorSheet } from '../components/OutageSimulatorSheet'
import { isOutageSimulatorEnabled } from '../lib/more-items'
import { PrivacyConsentGate } from '../components/PrivacyConsentGate'
import { StudentScreenCaptureGuard } from '../components/StudentScreenCaptureGuard'
import { CampusToastProvider, useCampusToast } from '../components/CampusToast'
import * as Sentry from '@sentry/react-native'

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN
// F7 demo killswitch — env-gated (default off; production pins "false").
const outageSimulatorEnabled = isOutageSimulatorEnabled(process.env.EXPO_PUBLIC_ENABLE_OUTAGE_SIMULATOR)

if (sentryDsn && process.env.EXPO_PUBLIC_E2E_MODE !== 'true') {
  try {
    Sentry.init({
      dsn: sentryDsn,
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
  } catch {
    // Sentry init gracefully bypassed if unavailable
  }
}

try {
  SplashScreen.preventAutoHideAsync()
} catch {
  // safe fallback
}
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
  const [maintenance, setMaintenance] = useState<ActiveMaintenance | null>(() => getMaintenanceSnapshot())
  const [simulatorVisible, setSimulatorVisible] = useState(false)
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
            // The broadcast also fires for this device's own fresh login (and
            // can beat the login response on the wire); only terminate when
            // the live session probe confirms the revocation.
            void shouldTerminateForReplacedSession({
              restoreSession: () => api.restoreSession(),
              isOwnLoginInFlight,
            }).then((terminate) => {
              if (!terminate) return
              toastRef.current('error', 'Session ended', 'Your session was replaced or revoked. Please sign in again.')
              void api.logout()
            })
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

  // Maintenance mode: the API client publishes 503 system_maintenance bodies
  // into the process store; this probe covers app boot and clears the banner
  // as soon as an exempt operator reopens the system.
  useEffect(() => {
    const unsubscribe = subscribeToMaintenance(setMaintenance)
    const probe = () => {
      void api
        .getMaintenanceStatus()
        .then((status) => {
          if (!status.enabled) setMaintenanceActive(null)
        })
        .catch(() => undefined)
    }
    probe()
    const interval = setInterval(probe, 30_000)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') probe()
    })
    return () => {
      unsubscribe()
      clearInterval(interval)
      subscription.remove()
    }
  }, [])
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

  useEffect(() => {
    if (fontsLoaded && sessionReady) {
      SplashScreen.hideAsync().catch(() => undefined)
    }
  }, [fontsLoaded, sessionReady])

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && sessionReady) {
      await SplashScreen.hideAsync().catch(() => undefined)
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
    <View
      style={{ flex: 1, backgroundColor: isDark ? pupColors.campusDark : pupColors.maroon }}
      className={`flex-1 will-change-variable will-change-container ${isDark ? 'dark' : ''}`}
      onLayout={onLayoutRootView}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="change-password" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
      {currentUser?.role === 'student' ? <StudentScreenCaptureGuard /> : null}
      <PrivacyConsentGate user={currentUser} />
      {maintenance && currentUser && !isMaintenanceExempt(currentUser) ? (
        <View className="absolute inset-0 z-50" testID="maintenance-overlay">
          <MaintenanceScreen
            message={maintenance.message}
            estimatedEnd={maintenance.estimatedEnd}
            studentNotice={currentUser.role === 'student'}
          />
        </View>
      ) : null}
      {maintenance && currentUser && isMaintenanceExempt(currentUser) ? (
        <View
          pointerEvents="none"
          className="absolute bottom-24 left-4 right-4 z-40 items-center border border-golden bg-maroon px-3 py-2 dark:bg-surface-dark"
        >
          <Text className="font-sans-bold text-[9px] uppercase tracking-widest text-golden">
            Maintenance mode is active — you are exempt
          </Text>
        </View>
      ) : null}
      {/* F7 floating simulator trigger: above content, below dialogs (z-50). */}
      {outageSimulatorEnabled ? (
        <>
          <Pressable
            testID="outage-simulator-pill"
            accessibilityRole="button"
            accessibilityLabel="Open the outage simulator"
            onPress={() => setSimulatorVisible(true)}
            className="absolute bottom-40 right-4 z-40 min-h-11 flex-row items-center gap-1.5 rounded-full border border-golden bg-maroon px-4 dark:bg-maroon-deep"
          >
            <MaterialIcons name="bolt" size={17} color={pupColors.golden} />
            <Text className="font-sans-bold text-[10px] uppercase tracking-widest text-golden">Outage</Text>
          </Pressable>
          <OutageSimulatorSheet visible={simulatorVisible} onClose={() => setSimulatorVisible(false)} />
        </>
      ) : null}
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

let ExportedRoot = RootLayout
if (sentryDsn && typeof Sentry?.wrap === 'function') {
  try {
    ExportedRoot = Sentry.wrap(RootLayout)
  } catch {
    ExportedRoot = RootLayout
  }
}

export default ExportedRoot
