import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/api-client'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import type { User, Teacher, Student } from '@polycheck/shared'

type Tab = 'teachers' | 'students'

const meetsPasswordPolicy = (password: string) =>
  password.length >= 12 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password)

export default function FacultyUsersScreen() {
  const { isDark, toggle } = useTheme()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('teachers')
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [showCreateTeacher, setShowCreateTeacher] = useState(false)
  const [showCreateStudent, setShowCreateStudent] = useState(false)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [teacherForm, setTeacherForm] = useState({ fullName: '', email: '', department: '', password: '' })
  const [studentForm, setStudentForm] = useState({ fullName: '', studentId: '', email: '', program: '', yearLevel: '', department: '', password: '' })
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' })

  const refreshUsers = async () => {
    const [nextTeachers, nextStudents] = await Promise.all([api.getTeachers(), api.getStudents()])
    setTeachers(nextTeachers)
    setStudents(nextStudents)
  }

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu && cu.role === 'super_admin') {
      setCurrentUser(cu)
      void refreshUsers().catch((error) => Alert.alert('Unable to load users', error instanceof Error ? error.message : 'Please try again.'))
    } else {
      router.replace('/(faculty)/dashboard')
    }
  }, [])

  if (!currentUser) return null

  const handleLogout = () => {
    api.logout()
    router.replace('/')
  }

  const handleCreateTeacher = async () => {
    if (teacherForm.fullName.trim().length < 2 || !teacherForm.email.includes('@') || !meetsPasswordPolicy(teacherForm.password)) {
      Alert.alert('Check the form', 'Enter a name, valid email, and a 12+ character password with uppercase, lowercase, number, and symbol.')
      return
    }
    setSubmitting(true)
    try {
      await api.createTeacher(teacherForm)
      await refreshUsers()
      setTeacherForm({ fullName: '', email: '', department: '', password: '' })
      setShowCreateTeacher(false)
      Alert.alert('Teacher created', 'The new account can sign in immediately.')
    } catch (error) {
      Alert.alert('Unable to create teacher', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateStudent = async () => {
    const yearLevel = Number(studentForm.yearLevel)
    const validEmail = studentForm.email.trim() === '' || /^\S+@\S+\.\S+$/.test(studentForm.email.trim())
    if (
      studentForm.fullName.trim().length < 2 ||
      !/^\d{4}-\d{5}-[A-Z]{2}-\d$/.test(studentForm.studentId.trim().toUpperCase()) ||
      !validEmail ||
      studentForm.program.trim().length < 2 ||
      !Number.isInteger(yearLevel) ||
      yearLevel < 1 ||
      yearLevel > 8 ||
      studentForm.department.trim().length < 2 ||
      !meetsPasswordPolicy(studentForm.password)
    ) {
      Alert.alert('Check the form', 'Complete every required field. Use student ID 2024-12345-MN-0 and a 12+ character password with uppercase, lowercase, number, and symbol.')
      return
    }

    setSubmitting(true)
    try {
      await api.createStudent({
        fullName: studentForm.fullName.trim(),
        studentId: studentForm.studentId.trim().toUpperCase(),
        email: studentForm.email.trim() || undefined,
        program: studentForm.program.trim(),
        yearLevel,
        department: studentForm.department.trim(),
        password: studentForm.password,
      })
      await refreshUsers()
      setStudentForm({ fullName: '', studentId: '', email: '', program: '', yearLevel: '', department: '', password: '' })
      setShowCreateStudent(false)
      Alert.alert('Student created', 'The new account can sign in immediately.')
    } catch (error) {
      Alert.alert('Unable to create student', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetTarget) return
    if (!meetsPasswordPolicy(passwordForm.password) || passwordForm.password !== passwordForm.confirmPassword) {
      Alert.alert('Check the password', 'Passwords must match and contain at least 12 characters with uppercase, lowercase, number, and symbol.')
      return
    }

    setSubmitting(true)
    try {
      await api.resetUserPassword(resetTarget.id, passwordForm.password)
      setPasswordForm({ password: '', confirmPassword: '' })
      setResetTarget(null)
      Alert.alert('Password reset', 'The temporary password is active and all existing sessions were revoked.')
    } catch (error) {
      Alert.alert('Unable to reset password', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateAccount = () => {
    const department = currentUser.department ?? ''
    if (activeTab === 'teachers') {
      setTeacherForm((form) => ({ ...form, department: form.department || department }))
      setShowCreateTeacher(true)
    } else {
      setStudentForm((form) => ({ ...form, department: form.department || department }))
      setShowCreateStudent(true)
    }
  }

  const openPasswordReset = (target: User) => {
    setPasswordForm({ password: '', confirmPassword: '' })
    setResetTarget(target)
  }

  const confirmStatusChange = (target: User) => {
    Alert.alert(
      target.isActive ? 'Disable account?' : 'Enable account?',
      target.isActive ? `${target.fullName} will be signed out and unable to log in.` : `${target.fullName} will be allowed to log in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: target.isActive ? 'Disable' : 'Enable',
          style: target.isActive ? 'destructive' : 'default',
          onPress: () => {
            setBusyUserId(target.id)
            void api.setUserStatus(target.id, !target.isActive)
              .then(refreshUsers)
              .catch((error) => Alert.alert('Unable to update account', error instanceof Error ? error.message : 'Please try again.'))
              .finally(() => setBusyUserId(null))
          },
        },
      ],
    )
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
          <TouchableOpacity onPress={() => router.push('/(faculty)/settings' as any)} style={styles.iconBtn} accessibilityLabel="Institution settings">
            <MaterialIcons name="settings" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openCreateAccount} style={styles.iconBtn} accessibilityLabel={`Add ${activeTab === 'teachers' ? 'teacher' : 'student'}`}>
            <MaterialIcons name="person-add" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggle} style={styles.iconBtn} accessibilityLabel="Toggle theme">
            <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} accessibilityLabel="Sign out">
            <MaterialIcons name="logout" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
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
                  <TouchableOpacity disabled={busyUserId === t.id} onPress={() => confirmStatusChange(t)} style={[styles.statusBadge, { backgroundColor: badgeStyle.bg }]} accessibilityLabel={`${t.isActive ? 'Disable' : 'Enable'} ${t.fullName}`}>
                    {busyUserId === t.id ? <ActivityIndicator size="small" color={badgeStyle.text} /> : <Text style={[styles.badgeText, { color: badgeStyle.text }]}>{t.isActive ? 'Active' : 'Inactive'}</Text>}
                  </TouchableOpacity>
                </View>
                <View style={[styles.cardDetails, isDark && styles.cardDetailsDark]}>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="business" size={14} color={isDark ? 'rgba(255,255,255,0.5)' : '#888'} />
                    <Text style={[styles.detailText, isDark && styles.textWhite50]}>{t.department}</Text>
                  </View>
                  <TouchableOpacity style={[styles.resetButton, isDark && styles.resetButtonDark]} onPress={() => openPasswordReset(t)} accessibilityLabel={`Reset password for ${t.fullName}`}>
                    <MaterialIcons name="key" size={15} color={isDark ? '#FFDF00' : '#7B1113'} />
                    <Text style={[styles.resetButtonText, isDark && styles.textGolden]}>Reset password</Text>
                  </TouchableOpacity>
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
                  <TouchableOpacity disabled={busyUserId === s.id} onPress={() => confirmStatusChange(s)} style={[styles.statusBadge, { backgroundColor: badgeStyle.bg }]} accessibilityLabel={`${s.isActive ? 'Disable' : 'Enable'} ${s.fullName}`}>
                    {busyUserId === s.id ? <ActivityIndicator size="small" color={badgeStyle.text} /> : <Text style={[styles.badgeText, { color: badgeStyle.text }]}>{s.isActive ? 'Active' : 'Inactive'}</Text>}
                  </TouchableOpacity>
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
                  <TouchableOpacity style={[styles.resetButton, isDark && styles.resetButtonDark]} onPress={() => openPasswordReset(s)} accessibilityLabel={`Reset password for ${s.fullName}`}>
                    <MaterialIcons name="key" size={15} color={isDark ? '#FFDF00' : '#7B1113'} />
                    <Text style={[styles.resetButtonText, isDark && styles.textGolden]}>Reset password</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      <Modal visible={showCreateTeacher} transparent animationType="fade" onRequestClose={() => setShowCreateTeacher(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.cardDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.textWhite]}>Create Teacher</Text>
              <TouchableOpacity onPress={() => setShowCreateTeacher(false)} accessibilityLabel="Close">
                <MaterialIcons name="close" size={22} color={isDark ? '#FFFFFF' : '#333333'} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalHint, isDark && styles.textWhite50]}>The teacher can sign in immediately. Temporary passwords require at least 12 characters, uppercase, lowercase, a number, and a symbol.</Text>
            {([
              ['Full name', 'fullName', 'default'],
              ['PUP email', 'email', 'email-address'],
              ['Department', 'department', 'default'],
              ['Temporary password', 'password', 'default'],
            ] as const).map(([label, key, keyboardType]) => (
              <View key={key} style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, isDark && styles.textWhite70]}>{label}</Text>
                <TextInput
                  value={teacherForm[key]}
                  onChangeText={(value) => setTeacherForm((form) => ({ ...form, [key]: value }))}
                  keyboardType={keyboardType}
                  secureTextEntry={key === 'password'}
                  autoCapitalize={key === 'email' ? 'none' : 'words'}
                  style={[styles.fieldInput, isDark && styles.fieldInputDark]}
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#999999'}
                />
              </View>
            ))}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.secondaryButton, isDark && styles.secondaryButtonDark]} onPress={() => setShowCreateTeacher(false)}>
                <Text style={[styles.secondaryButtonText, isDark && styles.textGolden]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={submitting} style={[styles.primaryButton, isDark && styles.primaryButtonDark]} onPress={() => void handleCreateTeacher()}>
                {submitting ? <ActivityIndicator color={isDark ? '#4A0A0B' : '#FFFFFF'} /> : <Text style={[styles.primaryButtonText, isDark && styles.primaryButtonTextDark]}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showCreateStudent} transparent animationType="fade" onRequestClose={() => setShowCreateStudent(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.tallModalCard, isDark && styles.cardDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.textWhite]}>Create Student</Text>
              <TouchableOpacity onPress={() => setShowCreateStudent(false)} accessibilityLabel="Close">
                <MaterialIcons name="close" size={22} color={isDark ? '#FFFFFF' : '#333333'} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalHint, isDark && styles.textWhite50]}>Create a verified student account. Email is optional; the student ID is always required for sign-in.</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {([
                ['Full name', 'fullName', 'default', 'words'],
                ['Student ID (2024-12345-MN-0)', 'studentId', 'default', 'characters'],
                ['PUP email (optional)', 'email', 'email-address', 'none'],
                ['Program', 'program', 'default', 'characters'],
                ['Year level', 'yearLevel', 'number-pad', 'none'],
                ['Department', 'department', 'default', 'words'],
                ['Temporary password', 'password', 'default', 'none'],
              ] as const).map(([label, key, keyboardType, autoCapitalize]) => (
                <View key={key} style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, isDark && styles.textWhite70]}>{label}</Text>
                  <TextInput
                    value={studentForm[key]}
                    onChangeText={(value) => setStudentForm((form) => ({ ...form, [key]: key === 'studentId' ? value.toUpperCase() : value }))}
                    keyboardType={keyboardType}
                    secureTextEntry={key === 'password'}
                    autoCapitalize={autoCapitalize}
                    style={[styles.fieldInput, isDark && styles.fieldInputDark]}
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#999999'}
                  />
                </View>
              ))}
              <Text style={[styles.passwordHint, isDark && styles.textWhite50]}>Password: 12+ characters with uppercase, lowercase, number, and symbol.</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.secondaryButton, isDark && styles.secondaryButtonDark]} onPress={() => setShowCreateStudent(false)}>
                  <Text style={[styles.secondaryButtonText, isDark && styles.textGolden]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={submitting} style={[styles.primaryButton, isDark && styles.primaryButtonDark]} onPress={() => void handleCreateStudent()}>
                  {submitting ? <ActivityIndicator color={isDark ? '#4A0A0B' : '#FFFFFF'} /> : <Text style={[styles.primaryButtonText, isDark && styles.primaryButtonTextDark]}>Create</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={resetTarget !== null} transparent animationType="fade" onRequestClose={() => setResetTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.cardDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.textWhite]}>Reset Password</Text>
              <TouchableOpacity onPress={() => setResetTarget(null)} accessibilityLabel="Close">
                <MaterialIcons name="close" size={22} color={isDark ? '#FFFFFF' : '#333333'} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalHint, isDark && styles.textWhite50]}>Set a temporary password for {resetTarget?.fullName}. All existing sessions will be revoked immediately.</Text>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isDark && styles.textWhite70]}>New temporary password</Text>
              <TextInput value={passwordForm.password} onChangeText={(password) => setPasswordForm((form) => ({ ...form, password }))} secureTextEntry autoCapitalize="none" style={[styles.fieldInput, isDark && styles.fieldInputDark]} placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#999999'} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isDark && styles.textWhite70]}>Confirm password</Text>
              <TextInput value={passwordForm.confirmPassword} onChangeText={(confirmPassword) => setPasswordForm((form) => ({ ...form, confirmPassword }))} secureTextEntry autoCapitalize="none" style={[styles.fieldInput, isDark && styles.fieldInputDark]} placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#999999'} />
            </View>
            <Text style={[styles.passwordHint, isDark && styles.textWhite50]}>Use 12+ characters with uppercase, lowercase, number, and symbol.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.secondaryButton, isDark && styles.secondaryButtonDark]} onPress={() => setResetTarget(null)}>
                <Text style={[styles.secondaryButtonText, isDark && styles.textGolden]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={submitting} style={[styles.primaryButton, isDark && styles.primaryButtonDark]} onPress={() => void handleResetPassword()}>
                {submitting ? <ActivityIndicator color={isDark ? '#4A0A0B' : '#FFFFFF'} /> : <Text style={[styles.primaryButtonText, isDark && styles.primaryButtonTextDark]}>Reset</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  textGolden: { color: '#FFDF00' },
  tabContainer: { flexDirection: 'row', padding: 4, marginHorizontal: 20, marginTop: 16, backgroundColor: '#E0E0E0', borderRadius: 0 },
  tabContainerDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 0 },
  tabActive: { backgroundColor: '#7B1113' },
  tabActiveDark: { backgroundColor: '#FFDF00' },
  tabText: { fontSize: 14, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#888' },
  tabTextActive: { color: '#FFFFFF' },
  tabTextActiveDark: { color: '#4A0A0B' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  userCard: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 0, backgroundColor: '#7B1113', justifyContent: 'center', alignItems: 'center' },
  avatarDark: { backgroundColor: '#FFDF00' },
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
  resetButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#7B1113' },
  resetButtonDark: { borderColor: '#FFDF00' },
  resetButtonText: { color: '#7B1113', fontSize: 12, fontFamily: fonts.bodySemiBold, fontWeight: '600' },
  textWhite70: { color: 'rgba(255,255,255,0.7)' },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.65)' },
  modalCard: { padding: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEEEEE' },
  tallModalCard: { maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 22, fontFamily: fonts.heading, fontWeight: '700', color: '#4A0A0B' },
  modalHint: { marginTop: 6, marginBottom: 18, fontSize: 12, lineHeight: 18, fontFamily: fonts.body, color: '#666666' },
  fieldGroup: { gap: 6, marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontFamily: fonts.bodySemiBold, fontWeight: '600', color: '#444444' },
  fieldInput: { height: 46, borderWidth: 1, borderColor: '#D4D4D8', paddingHorizontal: 12, color: '#222222', backgroundColor: '#FFFFFF', fontFamily: fonts.body },
  fieldInputDark: { borderColor: '#3F3F46', color: '#FFFFFF', backgroundColor: '#18181B' },
  passwordHint: { marginBottom: 8, color: '#666666', fontSize: 11, lineHeight: 16, fontFamily: fonts.body },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  secondaryButton: { minWidth: 96, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#7B1113' },
  secondaryButtonDark: { borderColor: '#FFDF00' },
  secondaryButtonText: { color: '#7B1113', fontFamily: fonts.bodySemiBold, fontWeight: '600' },
  primaryButton: { minWidth: 112, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7B1113' },
  primaryButtonDark: { backgroundColor: '#FFDF00' },
  primaryButtonText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontWeight: '700' },
  primaryButtonTextDark: { color: '#4A0A0B' },
})
