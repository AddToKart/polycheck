import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, AppState, Modal, Platform, Pressable, Text, View } from 'react-native'
import { Tabs, router } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AiCapabilities } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { shouldShowAssistantEntry } from '../../lib/assistant-visibility'
import { fonts } from '../../theme/typography'
import { pupColors } from '../../theme/colors'
import { useTheme } from '../../theme/ThemeContext'

function TabIcon({ name, color }: { name: keyof typeof MaterialIcons.glyphMap; focused: boolean; color: any }) {
  return <MaterialIcons name={name} size={22} color={color} />
}

// Bottom sheet for "More" — reveals Schedule + Attendance
function MoreSheet({ visible, onClose, isDark, isSuper, showAssistant, pendingExcuses }: { visible: boolean; onClose: () => void; isDark: boolean; isSuper: boolean; showAssistant: boolean; pendingExcuses: number }) {
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(300)).current
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion) }, [])

  useEffect(() => {
    if (visible) {
      if (reduceMotion) slideAnim.setValue(0)
      else Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }).start()
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: reduceMotion ? 0 : 200, useNativeDriver: true }).start()
    }
  }, [reduceMotion, slideAnim, visible])

  // SA1 supersedes MP2 Locked Decision 4: no proactive classroom entries for super admins (Option A keeps deep links).
  // Institution AI policy hides the Assistant entry per role (master → teachers;
  // super admins keep the unconfigured setup affordance while master is on).
  type MoreItem = {
    icon: keyof typeof MaterialIcons.glyphMap
    label: string
    sub: string
    route: string
    badge?: number
  }
  const baseItems: MoreItem[] = isSuper
    ? [
        { icon: 'search', label: 'Global Search', sub: 'Find users and sections', route: '/(faculty)/search' },
        { icon: 'settings', label: 'Institution Settings', sub: 'Configure institution defaults', route: '/(faculty)/settings' },
        { icon: 'history', label: 'Audit Log', sub: 'Review administrative changes', route: '/(faculty)/audit-logs' },
        { icon: 'smart-toy', label: 'Assistant', sub: 'Oversight, accounts & exports', route: '/(faculty)/assistant' },
      ]
    : [
        { icon: 'calendar-today', label: 'Schedule', sub: 'Weekly class schedule', route: '/(faculty)/schedule' },
        { icon: 'assignment', label: 'Attendance', sub: 'Overview & export', route: '/(faculty)/attendance' },
        { icon: 'assignment-turned-in', label: 'Excuses', sub: pendingExcuses > 0 ? `${pendingExcuses} waiting · Review excuse requests` : 'Review student excuse requests', route: '/(faculty)/excuses', badge: pendingExcuses },
        { icon: 'search', label: 'Search', sub: 'Find students and sections', route: '/(faculty)/search' },
        { icon: 'smart-toy', label: 'Assistant', sub: 'Ask about your sections and exports', route: '/(faculty)/assistant' },
      ]
  const items = baseItems.filter((item) => showAssistant || item.route !== '/(faculty)/assistant')

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50" onPress={onClose}>
        <View className="flex-1" />
        <Animated.View
          testID="faculty-more-sheet"
          className="rounded-none border-t-4 border-t-golden bg-white px-4 pt-3 dark:border-line-dark dark:bg-[#151013]"
          style={{ transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 16 }}
          onStartShouldSetResponder={() => true}
        >
          <View className="items-center pb-3 pt-1">
            <View className="h-1 w-10 bg-zinc-400 dark:bg-zinc-600" />
          </View>

          <Text className="px-1 pb-3 font-sans-bold text-[10px] uppercase tracking-[2.5px] text-maroon dark:text-golden">{isSuper ? 'Administration tools' : 'More faculty tools'}</Text>

          {items.map((item) => (
            <Pressable
              key={item.route}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityHint={item.sub}
              onPress={() => { onClose(); router.push(item.route as any) }}
              className="mb-2 min-h-14 flex-row items-center gap-4 rounded-none border border-line border-l-4 border-l-maroon bg-zinc-50 px-3 py-3 dark:border-line-dark dark:border-l-golden dark:bg-white/5"
            >
              <View className="h-10 w-10 items-center justify-center rounded-none bg-maroon dark:bg-golden">
                <MaterialIcons name={item.icon} size={20} color={isDark ? pupColors.maroonDark : '#FFFFFF'} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-bold text-sm text-ink dark:text-white uppercase tracking-wider">{item.label}</Text>
                <Text className="mt-0.5 font-sans text-xs text-muted dark:text-zinc-400">{item.sub}</Text>
              </View>
              {item.badge && item.badge > 0 ? (
                <View className="min-w-6 items-center justify-center rounded-full bg-golden px-2 py-1">
                  <Text className="font-sans-bold text-[10px] text-maroon-dark">{item.badge > 99 ? '99+' : item.badge}</Text>
                </View>
              ) : null}
              <MaterialIcons name="chevron-right" size={20} color={isDark ? '#A1A1AA' : '#746C6E'} />
            </Pressable>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

export default function FacultyLayout() {
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const currentUser = api.getCurrentUser()
  const isSuper = currentUser?.role === 'super_admin'
  const [moreVisible, setMoreVisible] = useState(false)
  const [capabilities, setCapabilities] = useState<AiCapabilities | null>(null)
  const [pendingExcuses, setPendingExcuses] = useState(0)

  const loadCapabilities = useCallback(() => {
    void api.getAiCapabilities()
      .then(setCapabilities)
      .catch(() => setCapabilities(null))
  }, [])

  // Fetch on mount, when the app returns to the foreground, and whenever the
  // More sheet opens so a policy saved in Institution Settings applies without
  // an app restart. Failed reads default to hidden.
  useEffect(() => {
    loadCapabilities()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadCapabilities()
    })
    return () => subscription.remove()
  }, [loadCapabilities])

  useEffect(() => {
    if (moreVisible) loadCapabilities()
  }, [loadCapabilities, moreVisible])

  // Pending excuse count is refreshed whenever the More sheet opens so the
  // teacher sees a current queue without a dedicated tab badge.
  useEffect(() => {
    if (!moreVisible || isSuper) return
    let active = true
    void api.listExcuses({ status: 'requested' })
      .then((records) => { if (active) setPendingExcuses(records.length) })
      .catch(() => { if (active) setPendingExcuses(0) })
    return () => { active = false }
  }, [isSuper, moreVisible])

  const showAssistant = shouldShowAssistantEntry(isSuper ? 'super_admin' : 'teacher', capabilities)

  const tabStyle = {
    position: 'absolute' as const,
    bottom: Math.max(insets.bottom, 12),
    left: 16,
    right: 16,
    backgroundColor: isDark ? pupColors.maroonInk : pupColors.maroon,
    borderRadius: 32,
    borderWidth: 0,
    height: 62,
    paddingBottom: 4,
    paddingTop: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 12 },
    }),
  }

  const labelStyle = {
    fontSize: 9,
    fontWeight: '700' as const,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    marginTop: 1,
  }

  return (
    <>
      <Tabs
        key={isDark ? 'dark' : 'light'}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: pupColors.golden,
          tabBarInactiveTintColor: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.65)',
          tabBarStyle: route.name === 'sessions/create' || route.name === 'sessions/[id]' || route.name === 'subjects/create' || route.name === 'subjects/[id]' || route.name === 'subjects/[id]/sessions' || route.name === 'sections/create' || route.name === 'sections/[id]' || route.name === 'student/[id]' || route.name === 'settings' ? { display: 'none' } : tabStyle,
          tabBarLabelStyle: labelStyle,
          tabBarIconStyle: { marginTop: 0 },
          tabBarIcon: ({ focused, color }) => {
            let iconName: keyof typeof MaterialIcons.glyphMap | undefined
            switch (route.name) {
              case 'dashboard': iconName = 'dashboard'; break
              case 'subjects': iconName = 'menu-book'; break
              case 'sessions':
              case 'sessions/index': iconName = 'event'; break
              case 'disputes': iconName = 'gavel'; break
              case 'assistant': iconName = 'smart-toy'; break
              case 'more-tab': iconName = 'more-horiz'; break
              case 'users': iconName = 'people'; break
              case 'reports': iconName = 'assessment'; break
            }
            if (!iconName) return null
            return <TabIcon name={iconName} focused={focused} color={color} />
          },
        })}
      >
        {/* Super-admin tab bar: Dashboard · Users · Reports · More.
            Teacher tab bar: Dashboard · Subjects · Sessions · Disputes · More. */}
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarLabel: 'Dashboard', tabBarButtonTestID: 'faculty-tab-dashboard' }} />
        <Tabs.Screen name="subjects" options={{ title: 'Subjects', tabBarLabel: 'Subjects', href: isSuper ? null : undefined, tabBarButtonTestID: 'faculty-tab-subjects' }} />
        <Tabs.Screen name="sessions" options={{ title: 'Sessions', tabBarLabel: 'Sessions', href: isSuper ? null : undefined, tabBarButtonTestID: 'faculty-tab-sessions' }} />
        <Tabs.Screen name="disputes" options={{ title: 'Disputes', tabBarLabel: 'Disputes', href: isSuper ? null : undefined, tabBarButtonTestID: 'faculty-tab-disputes' }} />
        <Tabs.Screen
          name="users"
          options={{ title: 'Users', tabBarLabel: 'Users', href: isSuper ? undefined : null, tabBarButtonTestID: 'admin-tab-users' }}
        />
        <Tabs.Screen
          name="reports"
          options={{ title: 'Reports', tabBarLabel: 'Reports', href: isSuper ? undefined : null, tabBarButtonTestID: 'admin-tab-reports' }}
        />
        {/* More tab — opens bottom sheet instead of navigating */}
        <Tabs.Screen
          name="more-tab"
          options={{
            title: 'More',
            tabBarLabel: 'More',
            tabBarButtonTestID: 'faculty-tab-more',
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault()
              setMoreVisible(true)
            },
          }}
        />

        {/* Hidden sub-screens */}
        <Tabs.Screen name="subjects/create" options={{ href: null }} />
        <Tabs.Screen name="sessions/create" options={{ href: null }} />
        <Tabs.Screen name="sessions/[id]" options={{ href: null }} />
        <Tabs.Screen name="subjects/[id]" options={{ href: null }} />
        <Tabs.Screen name="subjects/[id]/sessions" options={{ href: null }} />
        <Tabs.Screen name="sections/create" options={{ href: null }} />
        <Tabs.Screen name="sections/[id]" options={{ href: null }} />
        <Tabs.Screen name="student/[id]" options={{ href: null }} />
        <Tabs.Screen name="search" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="audit-logs" options={{ href: null }} />
        <Tabs.Screen name="assistant" options={{ href: null }} />
        <Tabs.Screen name="excuses" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        {/* Attendance + Schedule hidden from tab bar — accessible via More sheet or deep link */}
        <Tabs.Screen name="attendance" options={{ href: null }} />
        <Tabs.Screen name="schedule" options={{ href: null }} />
      </Tabs>

      <MoreSheet visible={moreVisible} onClose={() => setMoreVisible(false)} isDark={isDark} isSuper={isSuper} showAssistant={showAssistant} pendingExcuses={pendingExcuses} />
    </>
  )
}
