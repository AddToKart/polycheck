import { useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { Tabs } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AiCapabilities } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { shouldShowAssistantEntry } from '../../lib/assistant-visibility'
import { pupColors } from '../../theme/colors'
import { useTheme } from '../../theme/ThemeContext'

// Device animation lever: instant screen changes are the stable default.
// Set EXPO_PUBLIC_ENABLE_NAV_TRANSITIONS=true to opt back into the cross-fade.
const navTransitionsEnabled =
  process.env.EXPO_PUBLIC_ENABLE_NAV_TRANSITIONS === 'true'
const restoreThemeRemount = process.env.EXPO_PUBLIC_RESTORE_THEME_REMOUNT === 'true'

// Detail/action screens inside the student tab group: the floating nav bar
// must not cover their primary bottom action (e.g. "Create session").
const HIDDEN_TAB_BAR_ROUTES = new Set([
  'subject-info/[id]',
  'subject-info/[id]/create-session',
  'subject-info/[id]/sessions/[sessionId]',
])

const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  dashboard: 'grid-view',
  schedule: 'calendar-month',
  scan: 'qr-code-scanner',
  assistant: 'smart-toy',
  history: 'history',
}

export default function TabLayout() {
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const bottomMargin = Math.max(insets.bottom, 12)
  const [capabilities, setCapabilities] = useState<AiCapabilities | null>(null)

  // Institution AI policy gates the Assistant tab (master → students). A
  // failed read hides the entry point; the assistant screen keeps its own
  // unavailable state for anything reached through a deep link.
  useEffect(() => {
    let active = true
    const load = () => {
      void api.getAiCapabilities()
        .then((next) => { if (active) setCapabilities(next) })
        .catch(() => { if (active) setCapabilities(null) })
    }
    load()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') load()
    })
    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  const assistantVisible = shouldShowAssistantEntry('student', capabilities)

  return (
    <Tabs
      key={restoreThemeRemount ? (isDark ? 'dark' : 'light') : 'student-tabs'}
      screenOptions={({ route }) => ({
        headerShown: false,
        // Instant screen changes by default (stable on Android release);
        // opt into the cross-fade with EXPO_PUBLIC_ENABLE_NAV_TRANSITIONS.
        animation: navTransitionsEnabled ? 'fade' : 'none',
        ...(navTransitionsEnabled
          ? {
              sceneStyle: {
                backgroundColor: isDark ? pupColors.campusDark : pupColors.campus,
              },
            }
          : {}),
        tabBarActiveTintColor: pupColors.golden,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.70)',
        tabBarStyle: HIDDEN_TAB_BAR_ROUTES.has(route.name)
          ? { display: 'none' }
          : {
              position: 'absolute',
              bottom: bottomMargin,
              left: 16,
              right: 16,
              backgroundColor: isDark ? pupColors.maroonInk : pupColors.maroon,
              borderRadius: 32,
              borderWidth: 0,
              height: 64,
              paddingTop: 6,
              paddingBottom: 6,
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                },
                android: {
                  elevation: 12,
                },
              }),
            },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontFamily: 'DMSans_700Bold',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginTop: 1,
        },
        tabBarIconStyle: {
          marginTop: 2,
          marginBottom: 0,
        },
        tabBarIcon: ({ color }) => {
          const iconName = iconMap[route.name]
          if (!iconName) return null
          return (
            <MaterialIcons
              name={iconName}
              size={22}
              color={color}
            />
          )
        },
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarLabel: 'Home', tabBarButtonTestID: 'student-tab-home' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarLabel: 'Schedule', tabBarButtonTestID: 'student-tab-schedule' }} />
      <Tabs.Screen name="enroll" options={{ href: null }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarLabel: 'Scan', tabBarButtonTestID: 'student-tab-scan' }} />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'Assistant',
          tabBarLabel: 'Assistant',
          tabBarButtonTestID: 'student-tab-assistant',
          href: assistantVisible ? undefined : null,
        }}
      />
      <Tabs.Screen name="id-card" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ title: 'Audit', tabBarLabel: 'Audit', tabBarButtonTestID: 'student-tab-audit' }} />
      <Tabs.Screen name="subject-info/[id]" options={{ href: null }} />
      <Tabs.Screen name="subject-info/[id]/create-session" options={{ href: null }} />
      <Tabs.Screen name="subject-info/[id]/sessions/[sessionId]" options={{ href: null }} />
      <Tabs.Screen name="subjects" options={{ href: null }} />
    </Tabs>
  )
}
