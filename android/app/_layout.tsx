import '../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { View } from 'react-native'
import { ThemeProvider, useTheme } from '../theme/ThemeContext'
import { api } from '../services/mock-api'

SplashScreen.preventAutoHideAsync()

function RootLayoutInner() {
  const { isDark } = useTheme()
  const [sessionReady, setSessionReady] = useState(false)
  const [fontsLoaded] = useFonts({
    DMSans_400Regular: require('@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf'),
    DMSans_500Medium: require('@expo-google-fonts/dm-sans/500Medium/DMSans_500Medium.ttf'),
    DMSans_600SemiBold: require('@expo-google-fonts/dm-sans/600SemiBold/DMSans_600SemiBold.ttf'),
    DMSans_700Bold: require('@expo-google-fonts/dm-sans/700Bold/DMSans_700Bold.ttf'),
    Lora_400Regular: require('../assets/fonts/Lora_400Regular.ttf'),
  })

  useEffect(() => {
    api.restoreSession().then(() => setSessionReady(true))
  }, [])

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
