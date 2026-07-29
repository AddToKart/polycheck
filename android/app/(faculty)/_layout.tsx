import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Modal, Platform, Pressable, Text, View } from 'react-native'
import { Tabs, router } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../../services/api-client'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'

function TabIcon({ name, color }: { name: keyof typeof MaterialIcons.glyphMap; focused: boolean; color: any }) {
  return <MaterialIcons name={name} size={22} color={color} />
}

// Bottom sheet for "More" — reveals Schedule + Attendance
function MoreSheet({ visible, onClose, isDark, isSuper }: { visible: boolean; onClose: () => void; isDark: boolean; isSuper: boolean }) {
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

  const items = isSuper
    ? [
        { icon: 'event' as const, label: 'Session Monitoring', sub: 'Observe institution sessions', route: '/(faculty)/sessions' },
        { icon: 'assignment' as const, label: 'Attendance Monitoring', sub: 'Read-only logs and export', route: '/(faculty)/attendance' },
        { icon: 'gavel' as const, label: 'Dispute Monitoring', sub: 'Track teacher resolution', route: '/(faculty)/disputes' },
        { icon: 'search' as const, label: 'Global Search', sub: 'Find users and sections', route: '/(faculty)/search' },
        { icon: 'settings' as const, label: 'Institution Settings', sub: 'Configure institution defaults', route: '/(faculty)/settings' },
      ]
    : [
        { icon: 'calendar-today' as const, label: 'Schedule', sub: 'Weekly class schedule', route: '/(faculty)/schedule' },
        { icon: 'assignment' as const, label: 'Attendance', sub: 'Overview & export', route: '/(faculty)/attendance' },
        { icon: 'search' as const, label: 'Search', sub: 'Find students and sections', route: '/(faculty)/search' },
      ]

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50" onPress={onClose}>
        <View className="flex-1" />
        <Animated.View
          className="rounded-none border-t-4 border-t-golden bg-white px-4 pt-3 dark:border-line-dark dark:bg-[#151013]"
          style={{ transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 16 }}
          onStartShouldSetResponder={() => true}
        >
          <View className="items-center pb-3 pt-1">
            <View className="h-1 w-10 bg-zinc-400 dark:bg-zinc-600" />
          </View>

          <Text className="px-1 pb-3 font-sans-bold text-[10px] uppercase tracking-[2.5px] text-maroon dark:text-golden">More faculty tools</Text>

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
                <MaterialIcons name={item.icon} size={20} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-bold text-sm text-ink dark:text-white uppercase tracking-wider">{item.label}</Text>
                <Text className="mt-0.5 font-sans text-xs text-muted dark:text-zinc-400">{item.sub}</Text>
              </View>
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

  const tabStyle = {
    position: 'absolute' as const,
    bottom: Math.max(insets.bottom, 12),
    left: 16,
    right: 16,
    backgroundColor: isDark ? '#1F0B0E' : '#7B1113',
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
          tabBarActiveTintColor: '#FFDF00',
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
              case 'more-tab': iconName = 'more-horiz'; break
              case 'users': iconName = 'people'; break
              case 'reports': iconName = 'assessment'; break
            }
            if (!iconName) return null
            return <TabIcon name={iconName} focused={focused} color={color} />
          },
        })}
      >
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarLabel: 'Dashboard' }} />
        <Tabs.Screen name="subjects" options={{ title: 'Subjects', tabBarLabel: 'Subjects' }} />
        <Tabs.Screen name="sessions" options={{ title: 'Sessions', tabBarLabel: 'Sessions', href: isSuper ? null : undefined }} />
        <Tabs.Screen name="disputes" options={{ title: 'Disputes', tabBarLabel: 'Disputes', href: isSuper ? null : undefined }} />
        {/* More tab — opens bottom sheet instead of navigating */}
        <Tabs.Screen
          name="more-tab"
          options={{
            title: 'More',
            tabBarLabel: 'More',
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
        {/* Attendance + Schedule hidden from tab bar — accessible via More sheet */}
        <Tabs.Screen name="attendance" options={{ href: null }} />
        <Tabs.Screen name="schedule" options={{ href: null }} />
        <Tabs.Screen
          name="users"
          options={{ title: 'Users', tabBarLabel: 'Users', href: isSuper ? undefined : null }}
        />
        <Tabs.Screen
          name="reports"
          options={{ title: 'Reports', tabBarLabel: 'Reports', href: isSuper ? undefined : null }}
        />
      </Tabs>

      <MoreSheet visible={moreVisible} onClose={() => setMoreVisible(false)} isDark={isDark} isSuper={isSuper} />
    </>
  )
}
