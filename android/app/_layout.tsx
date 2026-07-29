import '../global.css'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { ActivityIndicator, Alert, AppState, View } from 'react-native'
import { ThemeProvider, useTheme } from '../theme/ThemeContext'
import { api, subscribeToAuthChanges } from '../services/api-client'
import { monitorAuthSession } from '../services/realtime'
import type { User } from '@polycheck/shared'

SplashScreen.preventAutoHideAsync()

function RootLayoutInner() {
  const { isDark } = useTheme()
  const router = useRouter()
  const segments = useSegments()
  // Stable ref so navigation callbacks always use the latest router
  const routerRef = useRef(router)
  routerRef.current = router

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

      // Session duplication monitor (for real-time session replaced events)
      stopAuthMonitor()
      stopAuthMonitor = user
        ? monitorAuthSession(() => {
            Alert.alert('Session ended', 'Your session was replaced or revoked. Please sign in again.')
            void api.logout()
          })
        : () => undefined
    })

    void api.restoreSession()
      .then(() => api.preSyncOfflineData())
      .finally(() => { if (mounted) setSessionReady(true) })

    const interval = setInterval(() => { void api.preSyncOfflineData() }, 30_000)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void api.preSyncOfflineData()
    })

    return () => {
      mounted = false
      stopAuthChanges()
      stopAuthMonitor()
      clearInterval(interval)
      subscription.remove()
    }
  }, []) // intentionally empty — runs once

  // ── Centralized auth-driven routing ────────────────────────────────────────
  // This is the SINGLE place that decides where to navigate based on auth
  // state. No screen or component should call router.replace() for auth
  // redirects — they just update auth state via api.login/logout().
  useEffect(() => {
    if (!sessionReady || !fontsLoaded) return

    const inAuthGroup = segments[0] === '(auth)'
    const inTabsGroup = segments[0] === '(tabs)'
    const inFacultyGroup = segments[0] === '(faculty)'

    if (!currentUser) {
      // Not logged in — go to landing if trying to access protected tab/faculty routes
      if (inTabsGroup || inFacultyGroup) {
        routerRef.current.replace('/')
      }
    } else if (currentUser.role === 'student') {
      // Student — go to student dashboard unless already in tabs
      if (!inTabsGroup) {
        routerRef.current.replace('/(tabs)/dashboard')
      }
    } else if (currentUser.role === 'teacher' || currentUser.role === 'super_admin') {
      // Faculty / super admin — go to faculty dashboard unless already there
      if (!inFacultyGroup) {
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
      <View style={{ flex: 1, backgroundColor: '#4A0A0B', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FFDF00" />
      </View>
    )
  }

  return (
    <View className={`flex-1 will-change-variable will-change-container ${isDark ? 'dark' : ''}`} onLayout={onLayoutRootView}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  )
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  )
}
