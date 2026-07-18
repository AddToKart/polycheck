import '../global.css'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { Alert, AppState, View } from 'react-native'
import { ThemeProvider, useTheme } from '../theme/ThemeContext'
import { api, subscribeToAuthChanges } from '../services/api-client'
import { monitorAuthSession } from '../services/realtime'

SplashScreen.preventAutoHideAsync()

function RootLayoutInner() {
  const { isDark } = useTheme()
  const router = useRouter()
  const [sessionReady, setSessionReady] = useState(false)
  const [fontsLoaded] = useFonts({
    DMSans_400Regular: require('@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf'),
    DMSans_500Medium: require('@expo-google-fonts/dm-sans/500Medium/DMSans_500Medium.ttf'),
    DMSans_600SemiBold: require('@expo-google-fonts/dm-sans/600SemiBold/DMSans_600SemiBold.ttf'),
    DMSans_700Bold: require('@expo-google-fonts/dm-sans/700Bold/DMSans_700Bold.ttf'),
    Lora_400Regular: require('../assets/fonts/Lora_400Regular.ttf'),
  })

  useEffect(() => {
    let mounted = true
    let stopAuthMonitor: () => void = () => undefined
    const stopAuthChanges = subscribeToAuthChanges((user) => {
      stopAuthMonitor()
      stopAuthMonitor = user
        ? monitorAuthSession(() => {
            Alert.alert('Session ended', 'Your session was replaced or revoked. Please sign in again.')
            void api.logout().finally(() => router.replace('/'))
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
  }, [router])

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && sessionReady) {
      await SplashScreen.hideAsync()
    }
  }, [fontsLoaded, sessionReady])

  if (!fontsLoaded || !sessionReady) return null

  return (
    <View className={`flex-1 ${isDark ? 'dark' : ''}`} onLayout={onLayoutRootView}>
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
