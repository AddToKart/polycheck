import { useEffect } from 'react'
import { useColorScheme, Text, View } from 'react-native'
import type { ErrorBoundaryProps } from 'expo-router'
import * as Sentry from '@sentry/react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { pupColors } from '../theme/colors'

/**
 * Themed route-level error boundary. Expo Router renders this around a route
 * when it throws during render, so a component error degrades to a retry
 * screen instead of a white/blank page. It renders outside the app's
 * ThemeProvider, hence the system color scheme read.
 */
export function CampusRouteError({ error, retry }: ErrorBoundaryProps) {
  const isDark = useColorScheme() === 'dark'

  useEffect(() => {
    // Keep the stack trace for the next crash report even when Sentry is not
    // configured yet; the console line survives in logcat for device captures.
    Sentry.captureException(error)
    console.error('[route-error]', error)
  }, [error])

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? pupColors.campusDark : pupColors.campus }}
      className="flex-1 bg-campus dark:bg-campus-dark"
    >
      <View className="flex-1 items-center justify-center px-6">
        <View
          className={`w-full max-w-md items-center border border-dashed px-6 py-10 ${
            isDark ? 'border-line-dark bg-surface-dark' : 'border-line bg-white'
          }`}
        >
          <View className={`mb-3 h-12 w-12 items-center justify-center ${isDark ? 'bg-golden/10' : 'bg-maroon/5'}`}>
            <MaterialIcons name="error-outline" size={24} color={isDark ? pupColors.golden : pupColors.maroon} />
          </View>
          <Text
            className={`text-center font-bold text-base uppercase tracking-wider ${
              isDark ? 'text-white' : 'text-ink'
            }`}
          >
            Something went wrong on this screen
          </Text>
          <Text
            numberOfLines={3}
            className={`mt-2 text-center text-xs leading-5 ${isDark ? 'text-zinc-400' : 'text-muted'}`}
          >
            {error.message || 'The screen could not be rendered. Your saved data is safe.'}
          </Text>
          <Text
            accessibilityRole="button"
            accessibilityLabel="Try again"
            onPress={() => void retry()}
            className={`mt-5 min-h-11 overflow-hidden border px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest ${
              isDark ? 'border-golden text-golden' : 'border-maroon text-maroon'
            }`}
          >
            Try again
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
