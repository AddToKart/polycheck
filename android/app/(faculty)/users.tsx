import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { AdminUserStatusFilter, SuperAdmin, User } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useAuthGate } from '../../hooks/use-auth-gate'
import { useTheme } from '../../theme/ThemeContext'
import { pupColors } from '../../theme/colors'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, CampusIconButton } from '../../components/CampusPrimitives'
import { CampusFormField } from '../../components/CampusFormField'
import { BulkImportSheet } from '../../components/BulkImportSheet'
import { useCampusToast } from '../../components/CampusToast'
import {
  assignableRoleFor,
  buildAdminUserFilters,
  buildProfileUpdate,
  debounce,
  describeAccountRole,
  isProtectedAccount,
  mergeUserPages,
  nextUsersOffset,
  normalizeSearchTerm,
  profileFieldsForRole,
  roleChangeBlockReason,
  roleChangePrompt,
  roleForTab,
  SEARCH_DEBOUNCE_MS,
  uniqueDepartments,
  USERS_PAGE_SIZE,
  USER_ROLE_TABS,
  type UserProfileForm,
  type UserRoleTab,
} from '../../components/users-screen-helpers'

type StatusFilter = AdminUserStatusFilter | 'all'

const meetsPasswordPolicy = (password: string) => password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password)
const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

const emptyProfileForm: UserProfileForm = { fullName: '', department: '', email: '', program: '', yearLevel: '' }
const emptyAdminForm = { fullName: '', email: '', department: '', password: '' }

const AccountSheet = ({ visible, title, description, children, onClose }: { visible: boolean; title: string; description: string; children: ReactNode; onClose: () => void }) => {
  const { isDark } = useTheme()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/80" onPress={onClose}>
        <Pressable onPress={() => undefined} className="max-h-[92%] rounded-t-[36px] border-t-2 border-x border-maroon/20 bg-white px-5 pb-10 pt-4 shadow-2xl dark:border-golden/25 dark:bg-surface-dark">
          <View className="mb-4 h-1.5 w-14 self-center rounded-full bg-maroon/30 dark:bg-golden/40" />
          <View className="mb-2 flex-row items-start gap-4">
            <View className="flex-1">
              <Text className="font-heading text-2xl text-ink dark:text-white">{title}</Text>
              <Text className="mt-2 font-sans text-xs leading-5 text-muted dark:text-zinc-400">{description}</Text>
            </View>
            <Pressable testID="account-sheet-close" accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} className="h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/10">
              <MaterialIcons name="close" size={21} color={isDark ? '#FFFFFF' : '#181113'} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const FilterChip = ({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) => (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    onPress={onPress}
    className={`min-h-10 justify-center rounded-full border px-4 ${selected ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line bg-white dark:border-line-dark dark:bg-surface-dark'}`}
  >
    <Text className={`font-sans-bold text-[10px] uppercase tracking-wider ${selected ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-400'}`}>{label}</Text>
  </Pressable>
)

type UserCardProps = {
  account: User
  busy: boolean
  onStatus: () => void
  onReset: () => void
  onEdit: () => void
  onRoleChange: () => void
}

const UserCard = ({ account, busy, onStatus, onReset, onEdit, onRoleChange }: UserCardProps) => {
  const { isDark } = useTheme()
  const protectedAccount = isProtectedAccount(account)
  const roleTarget = assignableRoleFor(account.role)

  return (
    <CampusCard className="p-4" testID={`user-card-${account.id}`}>
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-maroon dark:bg-golden">
          <Text className="font-sans-bold text-sm text-white dark:text-maroon-dark">{initials(account.fullName)}</Text>
        </View>
        <View className="flex-1">
          <Text className="font-sans-bold text-base text-ink dark:text-white">{account.fullName}</Text>
          <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400" numberOfLines={1}>{account.email || 'No email on file'}</Text>
        </View>
        {protectedAccount ? (
          <View className="min-h-11 min-w-20 flex-row items-center justify-center gap-1 rounded-full border border-line bg-zinc-100 px-3 dark:border-line-dark dark:bg-white/5">
            <MaterialIcons name="lock" size={13} color={isDark ? pupColors.golden : pupColors.maroon} />
            <Text className="font-sans-bold text-[10px] uppercase tracking-wider text-muted dark:text-zinc-300">Protected</Text>
          </View>
        ) : (
          <Pressable
            disabled={busy}
            accessibilityRole="switch"
            accessibilityLabel={`${account.isActive ? 'Disable' : 'Enable'} ${account.fullName}`}
            accessibilityState={{ checked: account.isActive, disabled: busy }}
            onPress={onStatus}
            className={`min-h-11 min-w-20 items-center justify-center rounded-full border px-3 ${account.isActive ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'}`}
          >
            {busy ? <ActivityIndicator size="small" color={isDark ? pupColors.golden : pupColors.maroon} /> : <Text className={`font-sans-bold text-[10px] ${account.isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{account.isActive ? 'Active' : 'Inactive'}</Text>}
          </Pressable>
        )}
      </View>

      <View className="mt-4 gap-2 border-t border-line pt-4 dark:border-line-dark">
        <View className="flex-row items-center gap-2">
          <MaterialIcons name={account.role === 'student' ? 'fingerprint' : account.role === 'teacher' ? 'school' : 'admin-panel-settings'} size={16} color={isDark ? '#A1A1AA' : '#746C6E'} />
          <Text className="font-sans text-xs text-muted dark:text-zinc-400">
            {account.role === 'student' ? account.studentId : describeAccountRole(account)}
            {account.department ? ` · ${account.department}` : ''}
          </Text>
        </View>
        {account.role === 'student' ? <View className="flex-row items-center gap-2"><MaterialIcons name="menu-book" size={16} color={isDark ? '#A1A1AA' : '#746C6E'} /><Text className="font-sans text-xs text-muted dark:text-zinc-400">{account.program || 'Program not set'} · Year {account.yearLevel ?? '—'}</Text></View> : null}
        {protectedAccount ? (
          <Text className="mt-1 font-sans text-[11px] leading-4 text-muted dark:text-zinc-500">
            Super administrator accounts are managed by database operations and cannot be edited, disabled, or reset here.
          </Text>
        ) : null}

        {!protectedAccount ? (
          <View className="mt-2 flex-row flex-wrap gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit profile for ${account.fullName}`}
              testID={`user-edit-${account.id}`}
              onPress={onEdit}
              className="min-h-11 flex-row items-center gap-2 rounded-xl bg-maroon/5 px-3 dark:bg-golden/10"
            >
              <MaterialIcons name="edit" size={16} color={isDark ? pupColors.golden : pupColors.maroon} />
              <Text className="font-sans-bold text-xs text-maroon dark:text-golden">Edit profile</Text>
            </Pressable>
            {roleTarget ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Change role for ${account.fullName}`}
                testID={`user-role-${account.id}`}
                onPress={onRoleChange}
                className="min-h-11 flex-row items-center gap-2 rounded-xl bg-maroon/5 px-3 dark:bg-golden/10"
              >
                <MaterialIcons name="swap-horiz" size={16} color={isDark ? pupColors.golden : pupColors.maroon} />
                <Text className="font-sans-bold text-xs text-maroon dark:text-golden">{roleTarget === 'teacher' ? 'Make teacher' : 'Make student'}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reset password for ${account.fullName}`}
              onPress={onReset}
              className="min-h-11 flex-row items-center gap-2 rounded-xl bg-maroon/5 px-3 dark:bg-golden/10"
            >
              <MaterialIcons name="key" size={16} color={isDark ? pupColors.golden : pupColors.maroon} />
              <Text className="font-sans-bold text-xs text-maroon dark:text-golden">Reset password</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </CampusCard>
  )
}

export default function FacultyUsersScreen() {
  const currentUser = useAuthGate(['super_admin'])
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const isInstitutionAdmin = currentUser?.role === 'super_admin' && (currentUser as SuperAdmin).scope === 'institution'

  const roleTabs = useMemo(
    () => USER_ROLE_TABS.filter((tab) => tab.id !== 'admins' || isInstitutionAdmin),
    [isInstitutionAdmin],
  )

  const [activeTab, setActiveTab] = useState<UserRoleTab>('teachers')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [inactiveStudentTotal, setInactiveStudentTotal] = useState(0)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [showImportStudents, setShowImportStudents] = useState(false)
  const [showCreateTeacher, setShowCreateTeacher] = useState(false)
  const [showCreateStudent, setShowCreateStudent] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [draftDepartment, setDraftDepartment] = useState('')
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [showAddAdmin, setShowAddAdmin] = useState(false)

  const [teacherForm, setTeacherForm] = useState({ fullName: '', email: '', department: '', password: '' })
  const [studentForm, setStudentForm] = useState({ fullName: '', studentId: '', email: '', program: '', yearLevel: '', department: '', password: '' })
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' })
  const [editForm, setEditForm] = useState<UserProfileForm>(emptyProfileForm)

  const [adminMode, setAdminMode] = useState<'promote' | 'create'>('promote')
  const [adminForm, setAdminForm] = useState(emptyAdminForm)
  const [teacherSearchText, setTeacherSearchText] = useState('')
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('')
  const [teacherResults, setTeacherResults] = useState<User[]>([])
  const [teacherSearchLoading, setTeacherSearchLoading] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null)

  const requestIdRef = useRef(0)
  const loadingMoreRef = useRef(false)

  const loadPage = useCallback(async (offset: number, mode: 'replace' | 'append' | 'refresh') => {
    if (!currentUser) return
    const requestId = ++requestIdRef.current
    if (mode === 'append') setLoadingMore(true)
    else if (mode === 'refresh') setRefreshing(true)
    else setLoading(true)
    if (mode !== 'append') setError(null)

    try {
      const page = await api.getUsers(buildAdminUserFilters({
        role: roleForTab(activeTab),
        search: searchQuery,
        department: departmentFilter,
        status: statusFilter,
        offset,
        limit: USERS_PAGE_SIZE,
      }))
      if (requestId !== requestIdRef.current) return
      setUsers((current) => mode === 'append' ? mergeUserPages(current, page.data) : page.data)
      setTotal(page.total)
      setHasMore(page.hasMore)
      setNextOffset(nextUsersOffset(page))
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return
      const message = loadError instanceof Error ? loadError.message : 'Please try again.'
      setError(message)
      setHasMore(false)
      showToast('error', 'Unable to load users', message)
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    }
  }, [activeTab, currentUser, departmentFilter, searchQuery, showToast, statusFilter])

  useEffect(() => {
    if (!currentUser) return
    void loadPage(0, 'replace')
  }, [currentUser, loadPage, refreshNonce])

  useEffect(() => {
    if (!roleTabs.some((tab) => tab.id === activeTab)) setActiveTab('teachers')
  }, [activeTab, roleTabs])

  const loadInactiveStudentTotal = useCallback(async () => {
    if (!currentUser) return
    try {
      const page = await api.getUsers({
        role: 'student',
        status: 'inactive',
        department: departmentFilter.trim() || undefined,
        limit: 1,
        offset: 0,
      })
      setInactiveStudentTotal(page.total)
    } catch {
      // The bulk-activate affordance is auxiliary; the directory error state covers connectivity.
    }
  }, [currentUser, departmentFilter])

  useEffect(() => {
    if (!currentUser || activeTab !== 'students') return
    void loadInactiveStudentTotal()
  }, [activeTab, currentUser, loadInactiveStudentTotal, refreshNonce])

  const commitSearch = useMemo(
    () => debounce((value: string) => setSearchQuery(normalizeSearchTerm(value)), SEARCH_DEBOUNCE_MS),
    [],
  )
  useEffect(() => () => commitSearch.cancel(), [commitSearch])

  const commitTeacherSearch = useMemo(
    () => debounce((value: string) => setTeacherSearchQuery(normalizeSearchTerm(value)), SEARCH_DEBOUNCE_MS),
    [],
  )
  useEffect(() => () => commitTeacherSearch.cancel(), [commitTeacherSearch])

  useEffect(() => {
    if (!showAddAdmin || adminMode !== 'promote' || !isInstitutionAdmin) return
    let active = true
    setTeacherSearchLoading(true)
    void api.getUsers({ role: 'teacher', q: teacherSearchQuery || undefined, limit: 25, offset: 0 })
      .then((page) => { if (active) setTeacherResults(page.data) })
      .catch(() => { if (active) setTeacherResults([]) })
      .finally(() => { if (active) setTeacherSearchLoading(false) })
    return () => { active = false }
  }, [adminMode, isInstitutionAdmin, showAddAdmin, teacherSearchQuery])

  const departmentOptions = useMemo(
    () => uniqueDepartments(users, currentUser?.department),
    [currentUser?.department, users],
  )

  if (!currentUser) return null

  const refreshAfterMutation = () => setRefreshNonce((value) => value + 1)

  const openCreate = () => {
    const department = currentUser.department ?? ''
    if (activeTab === 'teachers') {
      setTeacherForm((form) => ({ ...form, department: form.department || department }))
      setShowCreateTeacher(true)
    } else if (activeTab === 'students') {
      setStudentForm((form) => ({ ...form, department: form.department || department }))
      setShowCreateStudent(true)
    }
  }

  const createTeacher = async () => {
    if (teacherForm.fullName.trim().length < 2 || !teacherForm.email.includes('@') || !meetsPasswordPolicy(teacherForm.password)) {
      showToast('warning', 'Check the form', 'Enter a name, valid email, and a 12+ character password with uppercase, lowercase, number, and symbol.')
      return
    }
    setSubmitting(true)
    try {
      await api.createTeacher(teacherForm)
      setTeacherForm({ fullName: '', email: '', department: '', password: '' })
      setShowCreateTeacher(false)
      setActiveTab('teachers')
      refreshAfterMutation()
      showToast('success', 'Teacher created', 'The new account can sign in immediately.')
    } catch (createError) {
      showToast('error', 'Unable to create teacher', createError instanceof Error ? createError.message : 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const createStudent = async () => {
    const yearLevel = Number(studentForm.yearLevel)
    const validEmail = studentForm.email.trim() === '' || EMAIL_PATTERN.test(studentForm.email.trim())
    if (studentForm.fullName.trim().length < 2 || !/^\d{4}-\d{5}-[A-Z]{2}-\d$/.test(studentForm.studentId.trim().toUpperCase()) || !validEmail || studentForm.program.trim().length < 2 || !Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 8 || studentForm.department.trim().length < 2 || !meetsPasswordPolicy(studentForm.password)) {
      showToast('warning', 'Check the form', 'Complete required fields, use student ID 2024-12345-MN-0, and provide a strong 12+ character password.')
      return
    }
    setSubmitting(true)
    try {
      await api.createStudent({ fullName: studentForm.fullName.trim(), studentId: studentForm.studentId.trim().toUpperCase(), email: studentForm.email.trim() || undefined, program: studentForm.program.trim(), yearLevel, department: studentForm.department.trim(), password: studentForm.password })
      setStudentForm({ fullName: '', studentId: '', email: '', program: '', yearLevel: '', department: '', password: '' })
      setShowCreateStudent(false)
      setActiveTab('students')
      refreshAfterMutation()
      showToast('success', 'Student created', 'The new account can sign in immediately.')
    } catch (createError) {
      showToast('error', 'Unable to create student', createError instanceof Error ? createError.message : 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const resetPassword = async () => {
    if (!resetTarget) return
    if (!meetsPasswordPolicy(passwordForm.password) || passwordForm.password !== passwordForm.confirmPassword) {
      showToast('warning', 'Check the password', 'Passwords must match and contain at least 12 characters with uppercase, lowercase, number, and symbol.')
      return
    }
    setSubmitting(true)
    try {
      await api.resetUserPassword(resetTarget.id, passwordForm.password)
      setPasswordForm({ password: '', confirmPassword: '' })
      setResetTarget(null)
      showToast('success', 'Password reset', 'All existing sessions were revoked.')
    } catch (resetError) {
      showToast('error', 'Unable to reset password', resetError instanceof Error ? resetError.message : 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (account: User) => {
    setEditTarget(account)
    setEditForm({
      fullName: account.fullName,
      department: account.department ?? '',
      email: account.email ?? '',
      program: account.program ?? '',
      yearLevel: account.yearLevel ? String(account.yearLevel) : '',
    })
  }

  const saveProfile = async () => {
    if (!editTarget) return
    const result = buildProfileUpdate(editTarget.role, editForm)
    if (!result.input) {
      showToast('warning', 'Check the form', result.error)
      return
    }
    setSubmitting(true)
    try {
      const updated = await api.updateUser(editTarget.id, result.input)
      setUsers((current) => current.map((account) => account.id === updated.id ? { ...account, ...updated } : account))
      setEditTarget(null)
      showToast('success', 'Profile updated', `${updated.fullName}'s account details were saved.`)
    } catch (updateError) {
      showToast('error', 'Unable to update profile', updateError instanceof Error ? updateError.message : 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const changeStatus = (target: User) => {
    if (isProtectedAccount(target)) return
    Alert.alert(target.isActive ? 'Disable account?' : 'Enable account?', target.isActive ? `${target.fullName} will be signed out and unable to log in.` : `${target.fullName} can sign in again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: target.isActive ? 'Disable' : 'Enable',
        style: target.isActive ? 'destructive' : 'default',
        onPress: () => {
          setBusyUserId(target.id)
          void api.setUserStatus(target.id, !target.isActive).then((updated) => {
            setUsers((current) => current.map((account) => account.id === updated.id ? { ...account, ...updated } : account))
            refreshAfterMutation()
          }).catch((statusError) => showToast('error', 'Unable to update account', statusError instanceof Error ? statusError.message : 'Please try again.')).finally(() => setBusyUserId(null))
        },
      },
    ])
  }

  const performRoleChange = async (target: User, role: ReturnType<typeof assignableRoleFor>) => {
    if (!role) return
    setBusyUserId(target.id)
    try {
      const updated = await api.changeUserRole(target.id, role)
      setUsers((current) => current.filter((account) => account.id !== target.id))
      setTotal((value) => Math.max(0, value - 1))
      refreshAfterMutation()
      showToast('success', 'Role updated', `${updated.fullName} is now ${role === 'teacher' ? 'a teacher' : 'a student'}.`)
    } catch (roleError) {
      showToast('error', 'Unable to change role', roleError instanceof Error ? roleError.message : 'Please try again.')
    } finally {
      setBusyUserId(null)
    }
  }

  const requestRoleChange = (target: User) => {
    const prompt = roleChangePrompt(target)
    if (!prompt) return
    const block = roleChangeBlockReason(target)
    if (block === 'missing_department') {
      showToast('warning', 'Department required', 'Add a department before granting faculty access.')
      openEdit(target)
      return
    }
    Alert.alert(prompt.title, prompt.message, [
      { text: 'Cancel', style: 'cancel' },
      { text: prompt.confirmLabel, style: target.role === 'teacher' ? 'destructive' : 'default', onPress: () => void performRoleChange(target, prompt.role) },
    ])
  }

  const activateAllInactive = () => {
    if (inactiveStudentTotal === 0) return
    Alert.alert('Activate inactive accounts?', `${inactiveStudentTotal} provisioned/inactive student account(s) will be able to sign in.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Activate all',
        onPress: () => {
          setBusyUserId('__bulk__')
          void (async () => {
            let activated = 0
            try {
              // Inactive rows disappear from the filtered query as they are
              // enabled, so always page from offset 0.
              for (let pageIndex = 0; pageIndex < 100; pageIndex += 1) {
                const page = await api.getUsers({
                  role: 'student',
                  status: 'inactive',
                  department: departmentFilter.trim() || undefined,
                  limit: USERS_PAGE_SIZE,
                  offset: 0,
                })
                if (page.data.length === 0) break
                for (const account of page.data) {
                  await api.setUserStatus(account.id, true)
                  activated += 1
                }
                if (!page.hasMore) break
              }
              refreshAfterMutation()
              await loadInactiveStudentTotal()
              showToast('success', 'Accounts activated', `${activated} student account(s) can now sign in.`)
            } catch (bulkError) {
              refreshAfterMutation()
              showToast('error', 'Activation stopped', bulkError instanceof Error ? `${bulkError.message} (${activated} activated)` : 'Please try again.')
            } finally {
              setBusyUserId(null)
            }
          })()
        },
      },
    ])
  }

  const openAddAdmin = () => {
    if (!isInstitutionAdmin) return
    setAdminMode('promote')
    setAdminForm({ ...emptyAdminForm, department: currentUser.department ?? '' })
    setTeacherSearchText('')
    setTeacherSearchQuery('')
    setTeacherResults([])
    setSelectedTeacher(null)
    setShowAddAdmin(true)
  }

  const openDepartmentFilters = () => {
    setDraftDepartment(departmentFilter)
    setShowFilters(true)
  }

  const submitAddAdmin = async () => {
    if (!isInstitutionAdmin) return
    setSubmitting(true)
    try {
      if (adminMode === 'promote') {
        if (!selectedTeacher) {
          showToast('warning', 'Select a teacher', 'Choose the faculty account that should become a super administrator.')
          return
        }
        await api.createAdmin({ userId: selectedTeacher.id, department: selectedTeacher.department })
        showToast('success', 'Super administrator added', `${selectedTeacher.fullName} now has institution-wide access.`)
      } else {
        if (adminForm.fullName.trim().length < 2 || !EMAIL_PATTERN.test(adminForm.email.trim()) || adminForm.department.trim().length < 2 || !meetsPasswordPolicy(adminForm.password)) {
          showToast('warning', 'Check the form', 'Enter a name, valid email, department, and a 12+ character password with uppercase, lowercase, number, and symbol.')
          return
        }
        await api.createAdmin({
          fullName: adminForm.fullName.trim(),
          email: adminForm.email.trim(),
          department: adminForm.department.trim(),
          password: adminForm.password,
        })
        showToast('success', 'Super administrator created', 'The new administrator can sign in immediately.')
      }
      setShowAddAdmin(false)
      setAdminForm(emptyAdminForm)
      setActiveTab('admins')
      refreshAfterMutation()
    } catch (adminError) {
      showToast('error', 'Unable to add super administrator', adminError instanceof Error ? adminError.message : 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const activeRoleLabel = roleForTab(activeTab)
  const accountNoun = activeRoleLabel === 'teacher' ? 'teacher' : activeRoleLabel === 'student' ? 'student' : 'administrator'
  const editFields = editTarget ? profileFieldsForRole(editTarget.role) : []

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow="Account administration"
        title="Campus users"
        subtitle={isInstitutionAdmin ? 'Search, filter, edit, and manage accounts across the institution.' : 'Search, filter, edit, and manage accounts in your department.'}
        actions={(
          <>
            <CampusIconButton inverse icon="settings" label="Institution settings" onPress={() => router.push('/(faculty)/settings' as never)} />
            <CampusIconButton inverse icon="upload-file" label="Import students from CSV" testID="users-import-students" onPress={() => setShowImportStudents(true)} />
            {activeTab !== 'admins' ? <CampusIconButton inverse icon="person-add" label={`Add ${activeTab === 'teachers' ? 'teacher' : 'student'}`} onPress={openCreate} testID="users-add-account" /> : null}
            <CampusIconButton inverse icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle theme" onPress={toggle} />
          </>
        )}
      />

      <View className="mx-4 mt-2 flex-row rounded-2xl bg-zinc-200/70 p-1 dark:bg-white/5">
        {roleTabs.map((tab) => {
          const active = activeTab === tab.id
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`users-tab-${tab.id}`}
              onPress={() => setActiveTab(tab.id)}
              className={`min-h-12 flex-1 items-center justify-center rounded-xl ${active ? 'bg-maroon dark:bg-golden' : ''}`}
            >
              <Text className={`font-sans-bold text-xs ${active ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-400'}`}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </View>

      <View className="mx-4 mt-2 min-h-12 flex-row items-center rounded-2xl border border-line bg-white px-3 dark:border-line-dark dark:bg-surface-dark">
        <MaterialIcons name="search" size={19} color={isDark ? '#A1A1AA' : '#746C6E'} />
        <TextInput
          testID="users-search-input"
          accessibilityLabel="Search users by name, email, or student number"
          value={searchText}
          onChangeText={(value) => { setSearchText(value); commitSearch(value) }}
          placeholder="Name, email, or student number"
          placeholderTextColor={isDark ? pupColors.muted : pupColors.mutedLight}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          className="min-h-12 flex-1 px-3 font-sans text-sm text-ink dark:text-white"
        />
        {searchText ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => { commitSearch.cancel(); setSearchText(''); setSearchQuery('') }} className="h-10 w-10 items-center justify-center">
            <MaterialIcons name="close" size={18} color={isDark ? '#A1A1AA' : '#746C6E'} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 py-3">
        <FilterChip testID="users-status-all" label="All" selected={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
        <FilterChip testID="users-status-active" label="Active" selected={statusFilter === 'active'} onPress={() => setStatusFilter('active')} />
        <FilterChip testID="users-status-inactive" label="Inactive" selected={statusFilter === 'inactive'} onPress={() => setStatusFilter('inactive')} />
        <FilterChip
          testID="users-filter-department"
          label={departmentFilter ? `Dept · ${departmentFilter}` : 'Department'}
          selected={Boolean(departmentFilter)}
          onPress={openDepartmentFilters}
        />
      </ScrollView>

      <View className="mx-4 flex-row items-center justify-between pb-2">
        <Text accessibilityLiveRegion="polite" className="font-sans-medium text-[11px] text-muted dark:text-zinc-400">
          {loading ? 'Loading accounts…' : `${total} ${accountNoun}${total === 1 ? '' : 's'}${searchQuery ? ` matching “${searchQuery}”` : ''}`}
        </Text>
        {departmentFilter ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear department filter" onPress={() => setDepartmentFilter('')} className="min-h-10 justify-center px-2">
            <Text className="font-sans-bold text-[10px] text-maroon dark:text-golden">Clear department</Text>
          </Pressable>
        ) : null}
      </View>

      {error && users.length > 0 ? (
        <View className="mx-4 mb-2 flex-row items-center gap-2 border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/20">
          <MaterialIcons name="cloud-off" size={16} color={isDark ? '#FCA5A5' : '#B91C1C'} />
          <Text accessibilityLiveRegion="polite" className="flex-1 font-sans text-[11px] text-red-700 dark:text-red-300">Could not refresh the directory. Showing the last loaded accounts.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry loading users" onPress={() => void loadPage(0, 'replace')} className="min-h-10 justify-center px-2">
            <Text className="font-sans-bold text-[10px] uppercase tracking-wider text-red-700 dark:text-red-300">Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {activeTab === 'students' && inactiveStudentTotal > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Activate ${inactiveStudentTotal} inactive student accounts`}
          testID="users-activate-all"
          disabled={busyUserId !== null}
          onPress={activateAllInactive}
          className="mx-4 mb-2 min-h-10 flex-row items-center justify-center gap-2 rounded-xl border border-maroon/30 bg-maroon/5 dark:border-golden/30 dark:bg-golden/10"
        >
          <MaterialIcons name="how-to-reg" size={16} color={isDark ? pupColors.golden : pupColors.maroon} />
          <Text className="font-sans-bold text-xs text-maroon dark:text-golden">{busyUserId === '__bulk__' ? 'Activating…' : `Activate all inactive (${inactiveStudentTotal})`}</Text>
        </Pressable>
      ) : null}

      {activeTab === 'admins' && isInstitutionAdmin ? (
        <CampusCard className="mx-4 mb-2 p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center bg-maroon/5 dark:bg-golden/10">
              <MaterialIcons name="admin-panel-settings" size={20} color={isDark ? pupColors.golden : pupColors.maroon} />
            </View>
            <View className="flex-1">
              <Text className="font-sans-bold text-sm text-ink dark:text-white">Super administrators</Text>
              <Text className="mt-0.5 font-sans text-[11px] leading-4 text-muted dark:text-zinc-400">Protected accounts. Add institution-scope administrators from faculty or a fresh account.</Text>
            </View>
          </View>
          <CampusButton label="Add super admin" icon="person-add" onPress={openAddAdmin} className="mt-4" testID="users-add-super-admin" />
        </CampusCard>
      ) : null}

      <FlatList<User>
        testID="users-list"
        style={{ flex: 1 }}
        data={users}
        keyExtractor={(account) => account.id}
        renderItem={({ item: account }) => (
          <UserCard
            account={account}
            busy={busyUserId === account.id}
            onStatus={() => changeStatus(account)}
            onReset={() => { setPasswordForm({ password: '', confirmPassword: '' }); setResetTarget(account) }}
            onEdit={() => openEdit(account)}
            onRoleChange={() => requestRoleChange(account)}
          />
        )}
        ItemSeparatorComponent={() => <View className="h-3" />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!hasMore || loading || loadingMore || refreshing || !currentUser || loadingMoreRef.current) return
          loadingMoreRef.current = true
          void loadPage(nextOffset, 'append').finally(() => { loadingMoreRef.current = false })
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadPage(0, 'refresh')} tintColor={isDark ? pupColors.golden : pupColors.maroon} />}
        ListEmptyComponent={loading ? (
          <View className="items-center py-16"><ActivityIndicator size="large" color={isDark ? pupColors.golden : pupColors.maroon} /><Text className="mt-3 font-sans text-sm text-muted dark:text-zinc-400">Loading accounts…</Text></View>
        ) : error ? (
          <CampusCard className="border-l-red-600 p-4">
            <Text accessibilityLiveRegion="assertive" className="font-sans-bold text-sm text-red-900 dark:text-red-200">Unable to load users</Text>
            <Text className="mt-1 font-sans text-xs leading-5 text-red-700 dark:text-red-300">{error}</Text>
            <CampusButton label="Try again" icon="refresh" onPress={() => void loadPage(0, 'replace')} className="mt-4" />
          </CampusCard>
        ) : (
          <CampusEmptyState
            icon="group-off"
            title={searchQuery || departmentFilter || statusFilter !== 'all' ? 'No matching accounts' : `No ${accountNoun}s`}
            description={searchQuery || departmentFilter || statusFilter !== 'all'
              ? 'Adjust the search or filters to widen the directory.'
              : activeRoleLabel === 'super_admin'
                ? 'Use “Add super admin” above to provision an institution administrator.'
                : `Create the first ${accountNoun} with the add button in the header.`}
          />
        )}
        ListFooterComponent={loadingMore ? <View className="items-center py-4"><ActivityIndicator size="small" color={isDark ? pupColors.golden : pupColors.maroon} /></View> : null}
      />

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

      <AccountSheet
        visible={!!editTarget}
        title="Edit profile"
        description={editTarget ? `${describeAccountRole(editTarget)}${editTarget.role === 'student' ? ' · Student numbers cannot be changed.' : ''}` : ''}
        onClose={() => setEditTarget(null)}
      >
        <ScrollView className="mt-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="gap-4">
            {editFields.includes('fullName') ? <CampusFormField testID="edit-full-name" label="Full name" icon="person" value={editForm.fullName} onChangeText={(fullName) => setEditForm((form) => ({ ...form, fullName }))} autoCapitalize="words" /> : null}
            {editFields.includes('department') ? <CampusFormField testID="edit-department" label="Department" icon="business" value={editForm.department} onChangeText={(department) => setEditForm((form) => ({ ...form, department }))} /> : null}
            {editFields.includes('email') ? <CampusFormField testID="edit-email" label="PUP email" icon="mail" value={editForm.email} onChangeText={(email) => setEditForm((form) => ({ ...form, email }))} keyboardType="email-address" autoCapitalize="none" /> : null}
            {editFields.includes('program') ? <CampusFormField testID="edit-program" label="Program" icon="school" value={editForm.program} onChangeText={(program) => setEditForm((form) => ({ ...form, program }))} /> : null}
            {editFields.includes('yearLevel') ? <CampusFormField testID="edit-year-level" label="Year level" icon="format-list-numbered" value={editForm.yearLevel} onChangeText={(yearLevel) => setEditForm((form) => ({ ...form, yearLevel }))} keyboardType="number-pad" /> : null}
            <CampusButton label={submitting ? 'Saving…' : 'Save profile'} icon="save" disabled={submitting} onPress={() => void saveProfile()} testID="edit-save" />
          </View>
        </ScrollView>
      </AccountSheet>

      <AccountSheet
        visible={showFilters}
        title="Filter by department"
        description="Compose this with the role tab, status chips, and search. Department administrators remain limited to their own scope."
        onClose={() => setShowFilters(false)}
      >
        <View className="mt-4 gap-4">
          <CampusFormField label="Department" icon="business" value={draftDepartment} onChangeText={setDraftDepartment} autoCapitalize="characters" testID="department-filter-input" />
          {departmentOptions.length ? (
            <View className="flex-row flex-wrap gap-2">
              {departmentOptions.map((department) => (
                <FilterChip key={department} label={department} selected={draftDepartment.trim() === department} onPress={() => setDraftDepartment(department)} />
              ))}
            </View>
          ) : null}
          <View className="flex-row gap-2">
            <CampusButton label="Clear" variant="secondary" className="flex-1" onPress={() => { setDraftDepartment(''); setDepartmentFilter(''); setShowFilters(false) }} />
            <CampusButton label="Apply" icon="filter-alt" className="flex-1" onPress={() => { setDepartmentFilter(draftDepartment.trim()); setShowFilters(false) }} testID="department-filter-apply" />
          </View>
        </View>
      </AccountSheet>

      <AccountSheet
        visible={showAddAdmin}
        title="Add super administrator"
        description="Institution-scope administrators can promote an existing teacher or create a fresh protected account. Every change is audited."
        onClose={() => setShowAddAdmin(false)}
      >
        <ScrollView className="mt-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="mb-4 flex-row rounded-2xl bg-zinc-200/70 p-1 dark:bg-white/5">
            {([
              { id: 'promote' as const, label: 'Promote teacher', icon: 'upgrade' as const },
              { id: 'create' as const, label: 'Create new', icon: 'person-add' as const },
            ]).map((mode) => {
              const active = adminMode === mode.id
              return (
                <Pressable
                  key={mode.id}
                  testID={`admin-mode-${mode.id}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setAdminMode(mode.id)}
                  className={`min-h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl ${active ? 'bg-maroon dark:bg-golden' : ''}`}
                >
                  <MaterialIcons name={mode.icon} size={15} color={active ? (isDark ? pupColors.maroonDark : '#FFFFFF') : '#746C6E'} />
                  <Text className={`font-sans-bold text-[11px] ${active ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-400'}`}>{mode.label}</Text>
                </Pressable>
              )
            })}
          </View>

          {adminMode === 'promote' ? (
            <View className="gap-3">
              <View className="min-h-12 flex-row items-center rounded-2xl border border-line bg-zinc-50 px-3 dark:border-line-dark dark:bg-white/5">
                <MaterialIcons name="search" size={19} color={isDark ? '#A1A1AA' : '#746C6E'} />
                <TextInput
                  testID="admin-teacher-search"
                  accessibilityLabel="Search teachers to promote"
                  value={teacherSearchText}
                  onChangeText={(value) => { setTeacherSearchText(value); commitTeacherSearch(value) }}
                  placeholder="Search faculty by name or email"
                  placeholderTextColor={isDark ? pupColors.muted : pupColors.mutedLight}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="min-h-12 flex-1 px-3 font-sans text-sm text-ink dark:text-white"
                />
                {teacherSearchLoading ? <ActivityIndicator size="small" color={isDark ? pupColors.golden : pupColors.maroon} /> : null}
              </View>

              {selectedTeacher ? (
                <View className="border border-maroon bg-maroon/5 p-3 dark:border-golden dark:bg-golden/10">
                  <Text className="font-sans-bold text-xs text-maroon dark:text-golden">Selected · {selectedTeacher.fullName}</Text>
                  <Text className="mt-1 font-sans text-[11px] text-muted dark:text-zinc-400">{selectedTeacher.email} · {selectedTeacher.department ?? 'No department'}</Text>
                </View>
              ) : null}

              <View className="gap-2">
                {teacherResults.length === 0 && !teacherSearchLoading ? (
                  <Text className="py-4 text-center font-sans text-xs text-muted dark:text-zinc-400">No teachers match this search.</Text>
                ) : teacherResults.map((teacher) => {
                  const selected = selectedTeacher?.id === teacher.id
                  return (
                    <Pressable
                      key={teacher.id}
                      testID={`admin-teacher-${teacher.id}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Select ${teacher.fullName} to promote`}
                      onPress={() => setSelectedTeacher(selected ? null : teacher)}
                      className={`min-h-14 flex-row items-center gap-3 border px-3 py-2 ${selected ? 'border-maroon bg-maroon/5 dark:border-golden dark:bg-golden/10' : 'border-line bg-zinc-50 dark:border-line-dark dark:bg-white/5'}`}
                    >
                      <View className="h-9 w-9 items-center justify-center bg-maroon dark:bg-golden"><Text className="font-sans-bold text-[10px] text-white dark:text-maroon-dark">{initials(teacher.fullName)}</Text></View>
                      <View className="flex-1">
                        <Text className="font-sans-bold text-xs text-ink dark:text-white">{teacher.fullName}</Text>
                        <Text className="mt-0.5 font-sans text-[10px] text-muted dark:text-zinc-400" numberOfLines={1}>{teacher.email}{teacher.department ? ` · ${teacher.department}` : ''}</Text>
                      </View>
                      <MaterialIcons name={selected ? 'check-circle' : 'add-circle-outline'} size={20} color={selected ? (isDark ? pupColors.golden : pupColors.maroon) : '#A1A1AA'} />
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ) : (
            <View className="gap-4">
              <CampusFormField testID="admin-full-name" label="Full name" icon="person" value={adminForm.fullName} onChangeText={(fullName) => setAdminForm((form) => ({ ...form, fullName }))} autoCapitalize="words" />
              <CampusFormField testID="admin-email" label="PUP email" icon="mail" value={adminForm.email} onChangeText={(email) => setAdminForm((form) => ({ ...form, email }))} keyboardType="email-address" autoCapitalize="none" />
              <CampusFormField testID="admin-department" label="Department" icon="business" value={adminForm.department} onChangeText={(department) => setAdminForm((form) => ({ ...form, department }))} />
              <CampusFormField testID="admin-password" label="Temporary password" icon="lock" hint="12+ characters with uppercase, lowercase, number, and symbol." value={adminForm.password} onChangeText={(password) => setAdminForm((form) => ({ ...form, password }))} secureTextEntry autoCapitalize="none" />
            </View>
          )}

          <CampusButton
            label={submitting ? 'Adding…' : adminMode === 'promote' ? 'Promote to super admin' : 'Create super admin'}
            icon="admin-panel-settings"
            disabled={submitting || (adminMode === 'promote' && !selectedTeacher)}
            onPress={() => void submitAddAdmin()}
            className="mt-5"
            testID="admin-submit"
          />
        </ScrollView>
      </AccountSheet>

      <BulkImportSheet
        visible={showImportStudents}
        onClose={() => setShowImportStudents(false)}
        mode="students"
        onCompleted={() => refreshAfterMutation()}
      />
    </SafeAreaView>
  )
}
