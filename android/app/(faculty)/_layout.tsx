import { useEffect, useRef, useState } from 'react'
import { Animated, Modal, Platform, Pressable, Text, TouchableOpacity, View } from 'react-native'
import { Tabs, router } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../../services/api-client'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'

function TabIcon({ name, focused, color }: { name: keyof typeof MaterialIcons.glyphMap; focused: boolean; color: any }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <MaterialIcons name={name} size={22} color={color} />
    </View>
  )
}

// Bottom sheet for "More" — reveals Schedule + Attendance
function MoreSheet({ visible, onClose, isDark, isSuper }: { visible: boolean; onClose: () => void; isDark: boolean; isSuper: boolean }) {
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(300)).current

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }).start()
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }).start()
    }
  }, [visible])

  const bg = isDark ? '#121215' : '#FFFFFF'
  const border = isDark ? 'rgba(245,168,0,0.2)' : '#EEEEEE'
  const accent = isDark ? '#FFDF00' : '#7B1113'
  const accentText = isDark ? '#4A0A0B' : '#FFFFFF'
  const textColor = isDark ? '#FFFFFF' : '#1A1A1A'
  const subText = isDark ? 'rgba(255,255,255,0.5)' : '#888888'

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
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={onClose}
      >
        <View style={{ flex: 1 }} />
        <Animated.View
          style={{
            transform: [{ translateY: slideAnim }],
            backgroundColor: bg,
            borderTopWidth: 1,
            borderTopColor: border,
            paddingBottom: insets.bottom + 16,
          }}
          onStartShouldSetResponder={() => true}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#E0E0E0' }} />
          </View>

          <Text style={{ fontSize: 10, fontWeight: '700', fontFamily: fonts.bodyBold, color: subText, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 20, paddingBottom: 12 }}>
            More
          </Text>

          {items.map((item) => (
            <TouchableOpacity
              key={item.route}
              onPress={() => { onClose(); router.push(item.route as any) }}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderTopWidth: 1,
                borderTopColor: border,
              }}
            >
              <View style={{
                width: 44, height: 44,
                backgroundColor: accent,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <MaterialIcons name={item.icon} size={22} color={accentText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', fontFamily: fonts.bodySemiBold, color: textColor }}>{item.label}</Text>
                <Text style={{ fontSize: 12, fontFamily: fonts.body, color: subText, marginTop: 1 }}>{item.sub}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.2)' : '#CCC'} />
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

export default function FacultyLayout() {
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [isSuper, setIsSuper] = useState(false)
  const [ready, setReady] = useState(false)
  const [moreVisible, setMoreVisible] = useState(false)

  useEffect(() => {
    const user = api.getCurrentUser()
    if (!user || (user.role !== 'teacher' && user.role !== 'super_admin')) {
      router.replace('/')
      return
    }
    setIsSuper(user.role === 'super_admin')
    setReady(true)
  }, [])

  if (!ready) return null

  const tabStyle = {
    position: 'absolute' as const,
    bottom: insets.bottom + 12,
    left: 24,
    right: 24,
    backgroundColor: isDark ? '#FFDF00' : '#7B1113',
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(74, 10, 11, 0.15)' : 'rgba(255, 223, 0, 0.15)',
    borderRadius: 28,
    height: 64,
    paddingBottom: 0,
    paddingTop: 0,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  }

  const labelStyle = {
    fontSize: 10,
    fontWeight: '600' as const,
    fontFamily: fonts.bodySemiBold,
    marginTop: -4,
  }

  return (
    <>
      <Tabs
        key={isDark ? 'dark' : 'light'}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: isDark ? '#4A0A0B' : '#FFDF00',
          tabBarInactiveTintColor: isDark ? 'rgba(74, 10, 11, 0.4)' : 'rgba(255, 223, 0, 0.55)',
          tabBarStyle: route.name === 'sessions/create' || route.name === 'sessions/[id]' || route.name === 'subjects/create' || route.name === 'subjects/[id]' || route.name === 'subjects/[id]/sessions' || route.name === 'sections/create' || route.name === 'sections/[id]' || route.name === 'student/[id]' || route.name === 'settings' ? { display: 'none' } : tabStyle,
          tabBarLabelStyle: labelStyle,
          tabBarIconStyle: { marginTop: 4 },
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
