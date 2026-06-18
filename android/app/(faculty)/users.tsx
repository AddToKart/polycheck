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

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.heading, isDark && styles.textWhite]}>User Management</Text>
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
          <MaterialIcons name="people" size={16} color={activeTab === 'teachers' ? '#FFFFFF' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'teachers' && styles.tabTextActive]}>Teachers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'students' && styles.tabActive, activeTab === 'students' && isDark && styles.tabActiveDark]}
          onPress={() => setActiveTab('students')}
        >
          <MaterialIcons name="school" size={16} color={activeTab === 'students' ? '#FFFFFF' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'students' && styles.tabTextActive]}>Students</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'teachers' ? (
          teachers.map((t: Teacher) => (
            <View key={t.id} style={[styles.userCard, isDark && styles.cardDark]}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {t.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, isDark && styles.textWhite]}>{t.fullName}</Text>
                  <Text style={[styles.userMeta, isDark && styles.textWhite50]}>{t.email}</Text>
                </View>
                <View style={[styles.statusBadge, t.isActive ? styles.badgeActive : styles.badgeInactive]}>
                  <Text style={styles.badgeText}>{t.isActive ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>
              <View style={styles.cardDetails}>
                <View style={styles.detailRow}>
                  <MaterialIcons name="business" size={14} color="#888" />
                  <Text style={[styles.detailText, isDark && styles.textWhite50]}>{t.department}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          students.map((s: Student) => (
            <View key={s.id} style={[styles.userCard, isDark && styles.cardDark]}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {s.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, isDark && styles.textWhite]}>{s.fullName}</Text>
                  <Text style={[styles.userMeta, isDark && styles.textWhite50]}>{s.email}</Text>
                </View>
                <View style={[styles.statusBadge, s.isActive ? styles.badgeActive : styles.badgeInactive]}>
                  <Text style={styles.badgeText}>{s.isActive ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>
              <View style={styles.cardDetails}>
                <View style={styles.detailRow}>
                  <MaterialIcons name="fingerprint" size={14} color="#888" />
                  <Text style={[styles.detailText, isDark && styles.textWhite50]}>ID: {s.studentId}</Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialIcons name="class" size={14} color="#888" />
                  <Text style={[styles.detailText, isDark && styles.textWhite50]}>
                    {s.program} · Year {s.yearLevel}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#1A1A1A', borderBottomColor: '#222' },
  iconBtn: { padding: 6 },
  heading: { flex: 1, fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B' },
  headerRight: { flexDirection: 'row', gap: 8 },
  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  tabContainer: { flexDirection: 'row', padding: 4, marginHorizontal: 20, marginTop: 16, backgroundColor: '#E0E0E0', borderRadius: 0 },
  tabContainerDark: { backgroundColor: '#1A1A1A' },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 0 },
  tabActive: { backgroundColor: '#7B1113' },
  tabActiveDark: { backgroundColor: '#4A0A0B' },
  tabText: { fontSize: 14, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#888' },
  tabTextActive: { color: '#FFFFFF' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  userCard: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardDark: { backgroundColor: '#1A1A1A' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 0, backgroundColor: '#7B1113', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontFamily: fonts.bodyBold },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  userMeta: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 0 },
  badgeActive: { backgroundColor: '#E8F5E9' },
  badgeInactive: { backgroundColor: '#FFEBEE' },
  badgeText: { fontSize: 10, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#4CAF50' }, // customized text color could be active/inactive colors
  cardDetails: { borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 12, paddingTop: 12, gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, fontFamily: fonts.body, color: '#666' },
})
