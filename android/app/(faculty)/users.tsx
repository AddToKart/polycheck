import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { Student, Teacher, User } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, CampusIconButton } from '../../components/CampusPrimitives'
import { CampusFormField } from '../../components/CampusFormField'

type Tab = 'teachers' | 'students'

const meetsPasswordPolicy = (password: string) => password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password)
const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

const AccountSheet = ({ visible, title, description, children, onClose }: { visible: boolean; title: string; description: string; children: ReactNode; onClose: () => void }) => {
  const { isDark } = useTheme()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/80" onPress={onClose}>
        <Pressable onPress={() => undefined} className="max-h-[92%] rounded-t-[36px] border-t-2 border-x border-maroon/20 bg-white px-5 pb-10 pt-4 shadow-2xl dark:border-golden/25 dark:bg-[#161214]">
          <View className="mb-4 h-1.5 w-14 self-center rounded-full bg-maroon/30 dark:bg-golden/40" />
          <View className="mb-2 flex-row items-start gap-4">
            <View className="flex-1">
              <Text className="font-heading text-2xl text-ink dark:text-white">{title}</Text>
              <Text className="mt-2 font-sans text-xs leading-5 text-muted dark:text-zinc-400">{description}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} className="h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/10">
              <MaterialIcons name="close" size={21} color={isDark ? '#FFFFFF' : '#181113'} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const UserCard = ({ account, busy, onStatus, onReset }: { account: Teacher | Student; busy: boolean; onStatus: () => void; onReset: () => void }) => {
  const { isDark } = useTheme()
  const student = account.role === 'student' ? account as Student : null
  return <CampusCard className="p-4">
    <View className="flex-row items-center gap-3">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-maroon dark:bg-golden"><Text className="font-sans-bold text-sm text-white dark:text-maroon-dark">{initials(account.fullName)}</Text></View>
      <View className="flex-1"><Text className="font-sans-bold text-base text-ink dark:text-white">{account.fullName}</Text><Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400" numberOfLines={1}>{account.email || 'No email on file'}</Text></View>
      <Pressable disabled={busy} accessibilityRole="switch" accessibilityLabel={`${account.isActive ? 'Disable' : 'Enable'} ${account.fullName}`} accessibilityState={{ checked: account.isActive, disabled: busy }} onPress={onStatus} className={`min-h-11 min-w-20 items-center justify-center rounded-full border px-3 ${account.isActive ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'}`}>
        {busy ? <ActivityIndicator size="small" color={isDark ? '#FFDF00' : '#7B1113'} /> : <Text className={`font-sans-bold text-[10px] ${account.isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{account.isActive ? 'Active' : 'Inactive'}</Text>}
      </Pressable>
    </View>
    <View className="mt-4 gap-2 border-t border-line pt-4 dark:border-line-dark">
      <View className="flex-row items-center gap-2"><MaterialIcons name={student ? 'fingerprint' : 'business'} size={16} color={isDark ? '#A1A1AA' : '#746C6E'} /><Text className="font-sans text-xs text-muted dark:text-zinc-400">{student ? student.studentId : account.department}</Text></View>
      {student ? <View className="flex-row items-center gap-2"><MaterialIcons name="school" size={16} color={isDark ? '#A1A1AA' : '#746C6E'} /><Text className="font-sans text-xs text-muted dark:text-zinc-400">{student.program} · Year {student.yearLevel}</Text></View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Reset password for ${account.fullName}`} onPress={onReset} className="mt-2 min-h-11 flex-row items-center gap-2 self-start rounded-xl bg-maroon/5 px-3 dark:bg-golden/10"><MaterialIcons name="key" size={16} color={isDark ? '#FFDF00' : '#7B1113'} /><Text className="font-sans-bold text-xs text-maroon dark:text-golden">Reset password</Text></Pressable>
    </View>
  </CampusCard>
}

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
    const user = api.getCurrentUser()
    if (!user || user.role !== 'super_admin') {
      router.replace('/(faculty)/dashboard')
      return
    }
    setCurrentUser(user)
    void refreshUsers().catch((error) => Alert.alert('Unable to load users', error instanceof Error ? error.message : 'Please try again.'))
  }, [])

  if (!currentUser) return null

  const createTeacher = async () => {
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
    } catch (error) { Alert.alert('Unable to create teacher', error instanceof Error ? error.message : 'Please try again.') } finally { setSubmitting(false) }
  }

  const createStudent = async () => {
    const yearLevel = Number(studentForm.yearLevel)
    const validEmail = studentForm.email.trim() === '' || /^\S+@\S+\.\S+$/.test(studentForm.email.trim())
    if (studentForm.fullName.trim().length < 2 || !/^\d{4}-\d{5}-[A-Z]{2}-\d$/.test(studentForm.studentId.trim().toUpperCase()) || !validEmail || studentForm.program.trim().length < 2 || !Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 8 || studentForm.department.trim().length < 2 || !meetsPasswordPolicy(studentForm.password)) {
      Alert.alert('Check the form', 'Complete required fields, use student ID 2024-12345-MN-0, and provide a strong 12+ character password.')
      return
    }
    setSubmitting(true)
    try {
      await api.createStudent({ fullName: studentForm.fullName.trim(), studentId: studentForm.studentId.trim().toUpperCase(), email: studentForm.email.trim() || undefined, program: studentForm.program.trim(), yearLevel, department: studentForm.department.trim(), password: studentForm.password })
      await refreshUsers()
      setStudentForm({ fullName: '', studentId: '', email: '', program: '', yearLevel: '', department: '', password: '' })
      setShowCreateStudent(false)
      Alert.alert('Student created', 'The new account can sign in immediately.')
    } catch (error) { Alert.alert('Unable to create student', error instanceof Error ? error.message : 'Please try again.') } finally { setSubmitting(false) }
  }

  const resetPassword = async () => {
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
      Alert.alert('Password reset', 'All existing sessions were revoked.')
    } catch (error) { Alert.alert('Unable to reset password', error instanceof Error ? error.message : 'Please try again.') } finally { setSubmitting(false) }
  }

  const openCreate = () => {
    const department = currentUser.department ?? ''
    if (activeTab === 'teachers') { setTeacherForm((form) => ({ ...form, department: form.department || department })); setShowCreateTeacher(true) }
    else { setStudentForm((form) => ({ ...form, department: form.department || department })); setShowCreateStudent(true) }
  }

  const changeStatus = (target: User) => Alert.alert(target.isActive ? 'Disable account?' : 'Enable account?', target.isActive ? `${target.fullName} will be signed out and unable to log in.` : `${target.fullName} can sign in again.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: target.isActive ? 'Disable' : 'Enable', style: target.isActive ? 'destructive' : 'default', onPress: () => {
      setBusyUserId(target.id)
      void api.setUserStatus(target.id, !target.isActive).then(refreshUsers).catch((error) => Alert.alert('Unable to update account', error instanceof Error ? error.message : 'Please try again.')).finally(() => setBusyUserId(null))
    } },
  ])

  const visibleAccounts = activeTab === 'teachers' ? teachers : students

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0B0B0E' : '#F7F6F6' }}>
      <CampusHeader eyebrow="Account administration" title="Campus users" subtitle="Create accounts, manage access, and reset credentials securely." actions={<><CampusIconButton inverse icon="settings" label="Institution settings" onPress={() => router.push('/(faculty)/settings' as never)} /><CampusIconButton inverse icon="person-add" label={`Add ${activeTab === 'teachers' ? 'teacher' : 'student'}`} onPress={openCreate} /><CampusIconButton inverse icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle theme" onPress={toggle} /></>} />
      <View className="mx-4 mt-2 flex-row rounded-2xl bg-zinc-200/70 p-1 dark:bg-white/5">
        {([{ id: 'teachers', label: `Teachers · ${teachers.length}`, icon: 'people' }, { id: 'students', label: `Students · ${students.length}`, icon: 'school' }] as const).map((tab) => {
          const active = activeTab === tab.id
          return <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setActiveTab(tab.id)} className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl ${active ? 'bg-maroon dark:bg-golden' : ''}`}><MaterialIcons name={tab.icon} size={17} color={active ? isDark ? '#4A0A0B' : '#FFFFFF' : '#746C6E'} /><Text className={`font-sans-bold text-xs ${active ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-400'}`}>{tab.label}</Text></Pressable>
        })}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, paddingTop: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
        {visibleAccounts.map((account) => <UserCard key={account.id} account={account} busy={busyUserId === account.id} onStatus={() => changeStatus(account)} onReset={() => { setPasswordForm({ password: '', confirmPassword: '' }); setResetTarget(account) }} />)}
        {!visibleAccounts.length ? <CampusEmptyState icon="group-off" title={`No ${activeTab}`} description="Create the first account with the add button in the header." /> : null}
      </ScrollView>

      <AccountSheet visible={showCreateTeacher} title="Create teacher" description="The account can sign in immediately. Use a temporary password that satisfies the campus security policy." onClose={() => setShowCreateTeacher(false)}>
        <ScrollView className="mt-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="gap-4"><CampusFormField label="Full name" icon="person" value={teacherForm.fullName} onChangeText={(fullName) => setTeacherForm((form) => ({ ...form, fullName }))} autoCapitalize="words" /><CampusFormField label="PUP email" icon="mail" value={teacherForm.email} onChangeText={(email) => setTeacherForm((form) => ({ ...form, email }))} keyboardType="email-address" autoCapitalize="none" /><CampusFormField label="Department" icon="business" value={teacherForm.department} onChangeText={(department) => setTeacherForm((form) => ({ ...form, department }))} /><CampusFormField label="Temporary password" icon="lock" hint="12+ characters with uppercase, lowercase, number, and symbol." value={teacherForm.password} onChangeText={(password) => setTeacherForm((form) => ({ ...form, password }))} secureTextEntry autoCapitalize="none" /><CampusButton label={submitting ? 'Creating…' : 'Create teacher'} icon="person-add" disabled={submitting} onPress={() => void createTeacher()} /></View>
        </ScrollView>
      </AccountSheet>

      <AccountSheet visible={showCreateStudent} title="Create student" description="Create a verified student account. Email is optional; student ID remains available for sign-in." onClose={() => setShowCreateStudent(false)}>
        <ScrollView className="mt-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="gap-4"><CampusFormField label="Full name" icon="person" value={studentForm.fullName} onChangeText={(fullName) => setStudentForm((form) => ({ ...form, fullName }))} /><CampusFormField label="Student ID" icon="fingerprint" hint="Format: 2024-12345-MN-0" value={studentForm.studentId} onChangeText={(studentId) => setStudentForm((form) => ({ ...form, studentId: studentId.toUpperCase() }))} autoCapitalize="characters" /><CampusFormField label="PUP email (optional)" icon="mail" value={studentForm.email} onChangeText={(email) => setStudentForm((form) => ({ ...form, email }))} keyboardType="email-address" autoCapitalize="none" /><CampusFormField label="Program" icon="school" value={studentForm.program} onChangeText={(program) => setStudentForm((form) => ({ ...form, program }))} /><CampusFormField label="Year level" icon="format-list-numbered" value={studentForm.yearLevel} onChangeText={(yearLevel) => setStudentForm((form) => ({ ...form, yearLevel }))} keyboardType="number-pad" /><CampusFormField label="Department" icon="business" value={studentForm.department} onChangeText={(department) => setStudentForm((form) => ({ ...form, department }))} /><CampusFormField label="Temporary password" icon="lock" hint="12+ characters with uppercase, lowercase, number, and symbol." value={studentForm.password} onChangeText={(password) => setStudentForm((form) => ({ ...form, password }))} secureTextEntry autoCapitalize="none" /><CampusButton label={submitting ? 'Creating…' : 'Create student'} icon="person-add" disabled={submitting} onPress={() => void createStudent()} /></View>
        </ScrollView>
      </AccountSheet>

      <AccountSheet visible={!!resetTarget} title="Reset password" description={`Set a temporary password for ${resetTarget?.fullName ?? 'this account'}. Existing sessions will be revoked.`} onClose={() => setResetTarget(null)}>
        <View className="mt-4 gap-4"><CampusFormField label="New temporary password" icon="lock" value={passwordForm.password} onChangeText={(password) => setPasswordForm((form) => ({ ...form, password }))} secureTextEntry autoCapitalize="none" /><CampusFormField label="Confirm password" icon="lock-outline" hint="12+ characters with uppercase, lowercase, number, and symbol." value={passwordForm.confirmPassword} onChangeText={(confirmPassword) => setPasswordForm((form) => ({ ...form, confirmPassword }))} secureTextEntry autoCapitalize="none" /><CampusButton label={submitting ? 'Resetting…' : 'Reset password'} icon="key" disabled={submitting} onPress={() => void resetPassword()} /></View>
      </AccountSheet>
    </SafeAreaView>
  )
}
