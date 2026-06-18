import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Tabs, router } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { api } from '../../services/mock-api'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'

const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  dashboard: 'dashboard',
  subjects: 'menu-book',
  sessions: 'event',
  attendance: 'assignment',
  users: 'people',
  reports: 'assessment',
}

export default function FacultyLayout() {
  const { isDark } = useTheme()
  const [isSuper, setIsSuper] = useState(false)
  const [ready, setReady] = useState(false)

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

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#F5A800',
        tabBarInactiveTintColor: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.5)',
        tabBarStyle: {
          position: 'absolute',
          bottom: 16,
          left: 16,
          right: 16,
          backgroundColor: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(123,17,19,0.95)',
          borderRadius: 0,
          height: 64,
          paddingBottom: 6,
          paddingTop: 6,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          fontFamily: fonts.bodySemiBold,
          marginTop: -2,
        },
        tabBarIcon: ({ focused }) => {
          const iconName = iconMap[route.name]
          if (!iconName) return null
          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons
                name={iconName}
                size={22}
                color={focused ? '#F5A800' : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.5)'}
              />
            </View>
          )
        },
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarLabel: 'Dashboard' }} />
      <Tabs.Screen name="subjects" options={{ title: 'Subjects', tabBarLabel: 'Subjects' }} />
      <Tabs.Screen name="sessions" options={{ title: 'Sessions', tabBarLabel: 'Sessions' }} />
      <Tabs.Screen name="sessions/create" options={{ href: null }} />
      <Tabs.Screen name="sessions/[id]" options={{ href: null }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attendance', tabBarLabel: 'Attendance' }} />
      <Tabs.Screen 
        name="users" 
        options={{ 
          title: 'Users', 
          tabBarLabel: 'Users',
          href: isSuper ? undefined : null
        }} 
      />
      <Tabs.Screen 
        name="reports" 
        options={{ 
          title: 'Reports', 
          tabBarLabel: 'Reports',
          href: isSuper ? undefined : null
        }} 
      />
    </Tabs>
  )
}
