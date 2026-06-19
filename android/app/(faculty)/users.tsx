import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/mock-api'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import type { User, Teacher, Student } from '@polycheck/shared'

type Tab = 'teachers' | 'students'

export default function FacultyUsersScreen() {
  const { isDark, toggle } = useTheme()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('teachers')

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu && cu.role === 'super_admin') {
      setCurrentUser(cu)
    } else {
      router.replace('/(faculty)/dashboard')
    }
  }, [])

  if (!currentUser) return null

  const teachers = api.getTeachers()
  const students = api.getStudents()

  const handleLogout = () => {
    api.logout()
    router.replace('/')
  }

  const getStatusBadgeStyle = (isActive: boolean) => {
    if (isDark) {
      return {
        bg: isActive ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
        text: isActive ? '#4CAF50' : '#F44336'
      }
    } else {
      return {
        bg: isActive ? '#E8F5E9' : '#FFEBEE',
        text: isActive ? '#4CAF50' : '#D32F2F'
      }
    }
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.heading, isDark && styles.textGolden]}>User Management</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggle} style={styles.iconBtn} accessibilityLabel="Toggle theme">
            <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={22} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} accessibilityLabel="Sign out">
            <MaterialIcons name="logout" size={22} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.tabContainer, isDark && styles.tabContainerDark]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'teachers' && styles.tabActive, activeTab === 'teachers' && isDark && styles.tabActiveDark]}
          onPress={() => setActiveTab('teachers')}
        >
          <MaterialIcons name="people" size={16} color={activeTab === 'teachers' ? (isDark ? '#4A0A0B' : '#FFFFFF') : '#888'} />
          <Text style={[
            styles.tabText,
            activeTab === 'teachers' && styles.tabTextActive,
            activeTab === 'teachers' && isDark && styles.tabTextActiveDark
          ]}>Teachers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'students' && styles.tabActive, activeTab === 'students' && isDark && styles.tabActiveDark]}
          onPress={() => setActiveTab('students')}
        >
          <MaterialIcons name="school" size={16} color={activeTab === 'students' ? (isDark ? '#4A0A0B' : '#FFFFFF') : '#888'} />
          <Text style={[
            styles.tabText,
            activeTab === 'students' && styles.tabTextActive,
            activeTab === 'students' && isDark && styles.tabTextActiveDark
          ]}>Students</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'teachers' ? (
          teachers.map((t: Teacher) => {
            const badgeStyle = getStatusBadgeStyle(t.isActive)
            return (
              <View key={t.id} style={[styles.userCard, isDark && styles.cardDark]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.avatar, isDark && styles.avatarDark]}>
                    <Text style={[styles.avatarText, isDark && styles.avatarTextDark]}>
                      {t.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, isDark && styles.textWhite]}>{t.fullName}</Text>
                    <Text style={[styles.userMeta, isDark && styles.textWhite50]}>{t.email}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badgeStyle.bg }]}>
                    <Text style={[styles.badgeText, { color: badgeStyle.text }]}>{t.isActive ? 'Active' : 'Inactive'}</Text>
                  </View>
                </View>
                <View style={[styles.cardDetails, isDark && styles.cardDetailsDark]}>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="business" size={14} color={isDark ? 'rgba(255,255,255,0.5)' : '#888'} />
                    <Text style={[styles.detailText, isDark && styles.textWhite50]}>{t.department}</Text>
                  </View>
                </View>
              </View>
            )
          })
        ) : (
          students.map((s: Student) => {
            const badgeStyle = getStatusBadgeStyle(s.isActive)
            return (
              <View key={s.id} style={[styles.userCard, isDark && styles.cardDark]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.avatar, isDark && styles.avatarDark]}>
                    <Text style={[styles.avatarText, isDark && styles.avatarTextDark]}>
                      {s.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, isDark && styles.textWhite]}>{s.fullName}</Text>
                    <Text style={[styles.userMeta, isDark && styles.textWhite50]}>{s.email}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badgeStyle.bg }]}>
                    <Text style={[styles.badgeText, { color: badgeStyle.text }]}>{s.isActive ? 'Active' : 'Inactive'}</Text>
                  </View>
                </View>
                <View style={[styles.cardDetails, isDark && styles.cardDetailsDark]}>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="fingerprint" size={14} color={isDark ? 'rgba(255,255,255,0.5)' : '#888'} />
                    <Text style={[styles.detailText, isDark && styles.textWhite50]}>ID: {s.studentId}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="class" size={14} color={isDark ? 'rgba(255,255,255,0.5)' : '#888'} />
                    <Text style={[styles.detailText, isDark && styles.textWhite50]}>
                      {s.program} · Year {s.yearLevel}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0C' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  iconBtn: { padding: 6 },
  heading: { flex: 1, fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B' },
  headerRight: { flexDirection: 'row', gap: 8 },
  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#F5A800' },
  tabContainer: { flexDirection: 'row', padding: 4, marginHorizontal: 20, marginTop: 16, backgroundColor: '#E0E0E0', borderRadius: 0 },
  tabContainerDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 0 },
  tabActive: { backgroundColor: '#7B1113' },
  tabActiveDark: { backgroundColor: '#F5A800' },
  tabText: { fontSize: 14, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#888' },
  tabTextActive: { color: '#FFFFFF' },
  tabTextActiveDark: { color: '#4A0A0B' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  userCard: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 0, backgroundColor: '#7B1113', justifyContent: 'center', alignItems: 'center' },
  avatarDark: { backgroundColor: '#F5A800' },
  avatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontFamily: fonts.bodyBold },
  avatarTextDark: { color: '#4A0A0B' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  userMeta: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 0 },
  badgeActive: { backgroundColor: '#E8F5E9' },
  badgeInactive: { backgroundColor: '#FFEBEE' },
  badgeText: { fontSize: 10, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  cardDetails: { borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 12, paddingTop: 12, gap: 6 },
  cardDetailsDark: { borderTopColor: 'rgba(255,255,255,0.05)' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, fontFamily: fonts.body, color: '#666' },
})
