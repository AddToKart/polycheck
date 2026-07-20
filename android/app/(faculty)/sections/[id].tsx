import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import type { Section, SectionRole, SessionPermission, Student, Subject } from '@polycheck/shared'
import { api } from '../../../services/api-client'
import { useTheme } from '../../../theme/ThemeContext'
import { CampusHeader } from '../../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, SectionHeading } from '../../../components/CampusPrimitives'
import { AttendanceMetricGrid } from '../../../components/AttendanceReportCards'
import { ChoiceSheet } from '../../../components/CampusPickerSheets'

const PAGE_SIZE = 10
const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

export default function SectionDetailScreen() {
  const { isDark, toggle } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [section, setSection] = useState<Section | null>(null)
  const [students, setStudents] = useState<Array<Student & { attendance: { present: number; late: number; absent: number; disputed: number } }>>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [parentSubject, setParentSubject] = useState<Subject | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [isEnrollOpen, setIsEnrollOpen] = useState(false)
  const [enrollSearch, setEnrollSearch] = useState('')
  const [sectionRoles, setSectionRoles] = useState<SectionRole[]>([])
  const [sessionPermissions, setSessionPermissions] = useState<SessionPermission[]>([])
  const [assignRole, setAssignRole] = useState<'president' | 'qac' | null>(null)
  const isTeacher = api.getCurrentUser()?.role === 'teacher'

  const refreshRoster = useCallback(async () => { if (id) setStudents(await api.getSectionStudents(id)) }, [id])
  const refreshRoles = useCallback(async () => { if (id) setSectionRoles(await api.getSectionRoles(id)) }, [id])
  const refreshPermissions = useCallback(async () => { if (id) setSessionPermissions(await api.getActiveSessionPermissions(id)) }, [id])

  useEffect(() => {
    if (!id) return
    const currentUser = api.getCurrentUser()
    void (async () => {
      const [nextSection, nextStudents] = await Promise.all([api.getSection(id), api.getSectionStudents(id)])
      if (currentUser?.role === 'teacher' && nextSection.teacherId !== currentUser.id) { router.replace('/'); return }
      setSection(nextSection)
      setStudents(nextStudents)
      if (currentUser?.role === 'teacher') {
        const [roles, permissions, studentList] = await Promise.all([api.getSectionRoles(id), api.getActiveSessionPermissions(id), api.getStudents()])
        setSectionRoles(roles)
        setSessionPermissions(permissions)
        setAllStudents(studentList)
      }
      setParentSubject(await api.getSubject(nextSection.subjectId))
    })().catch(() => router.back())
  }, [id])

  const enrolledIds = useMemo(() => new Set(students.map((student) => student.id)), [students])
  const enrollCandidates = useMemo(() => {
    if (!enrollSearch.trim()) return []
    const query = enrollSearch.toLowerCase()
    return allStudents.filter((student) => !enrolledIds.has(student.id) && `${student.fullName} ${student.studentId}`.toLowerCase().includes(query))
  }, [allStudents, enrollSearch, enrolledIds])
  const filtered = useMemo(() => {
    if (!search.trim()) return students
    const query = search.toLowerCase()
    return students.filter((student) => `${student.fullName} ${student.studentId}`.toLowerCase().includes(query))
  }, [search, students])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  useEffect(() => setPage(0), [search])

  if (!section) return null

  const totalPresent = students.reduce((sum, student) => sum + student.attendance.present, 0)
  const totalLate = students.reduce((sum, student) => sum + student.attendance.late, 0)
  const totalAbsent = students.reduce((sum, student) => sum + student.attendance.absent, 0)
  const president = sectionRoles.find((role) => role.role === 'president')
  const qacMembers = sectionRoles.filter((role) => role.role === 'qac')
  const activePresidentPermission = president ? sessionPermissions.some((permission) => permission.studentId === president.studentId) : false
  const assignedIds = new Set(sectionRoles.map((role) => role.studentId))
  const assignCandidates = students.filter((student) => assignRole === 'president' ? student.id !== president?.studentId : !assignedIds.has(student.id))

  const enroll = async (studentId: string, studentName: string) => {
    try {
      await api.enrollStudent({ sectionId: id!, studentId, studentName })
      await refreshRoster()
      setSection(await api.getSection(id!))
      setEnrollSearch('')
      Alert.alert('Student enrolled', `${studentName} is now part of this section.`)
    } catch (error) { Alert.alert('Unable to enroll', error instanceof Error ? error.message : 'Please try again.') }
  }
  const resetCode = async () => {
    const result = await api.resetEnrollmentCode(id!)
    setSection(await api.getSection(id!))
    Alert.alert('Enrollment code reset', `New code: ${result.enrollmentCode}`)
  }
  const disableCode = () => Alert.alert('Disable enrollment code?', 'Students will no longer be able to join using this code.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Disable', style: 'destructive', onPress: () => { void api.disableEnrollmentCode(id!).then(async () => setSection(await api.getSection(id!))) } },
  ])
  const assignStudentRole = async (studentId: string) => {
    if (!assignRole) return
    try {
      if (assignRole === 'president' && president && president.studentId !== studentId) {
        await api.removeSectionRole(id!, president.studentId, 'president')
      }
      await api.assignSectionRole(id!, studentId, assignRole)
      await refreshRoles()
    } catch (error) {
      Alert.alert('Unable to assign role', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setAssignRole(null)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0B0B0E' : '#F7F6F6' }}>
      <CampusHeader
        eyebrow="Section workspace"
        title={`${parentSubject?.name ?? 'Subject'} · ${section.section}`}
        subtitle={`${parentSubject?.code ?? ''} · ${section.semester}`}
        onBack={() => router.back()}
        actions={<CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, paddingTop: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <SectionHeading eyebrow="Class profile" title="Section details" />
      <CampusCard className="mb-5 p-4">
        <View className="flex-row gap-3">{[
          { icon: 'meeting-room' as const, label: 'Room', value: section.room }, { icon: 'school' as const, label: 'Semester', value: section.semester },
        ].map((item) => <View key={item.label} className="flex-1 rounded-2xl bg-zinc-50 p-3 dark:bg-white/5"><MaterialIcons name={item.icon} size={18} color={isDark ? '#FFDF00' : '#7B1113'} /><Text className="mt-3 font-sans-bold text-[9px] uppercase tracking-[1px] text-muted dark:text-zinc-500">{item.label}</Text><Text className="mt-1 font-sans-bold text-sm text-ink dark:text-white">{item.value}</Text></View>)}</View>
        <View className="mt-4 flex-row flex-wrap gap-2">{section.schedule.map((schedule, index) => <View key={`${schedule.day}-${index}`} className="rounded-full border border-line bg-zinc-50 px-3 py-2 dark:border-line-dark dark:bg-white/5"><Text className="font-sans-bold text-[10px] text-maroon dark:text-golden">{schedule.day} · {schedule.startTime}–{schedule.endTime}{schedule.room ? ` · ${schedule.room}` : ''}</Text></View>)}</View>
      </CampusCard>

      <CampusCard className="mb-5 overflow-hidden bg-maroon p-4 dark:bg-[#2A0E11]">
        <View className="flex-row items-center gap-3"><View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10"><MaterialIcons name="vpn-key" size={20} color="#FFDF00" /></View><View className="flex-1"><Text className="font-sans-bold text-sm text-white">Enrollment code</Text>{section.enrollmentCode ? <Text className="mt-1 font-mono text-xl tracking-[3px] text-golden">{section.enrollmentCode}</Text> : <Text className="mt-1 font-sans text-xs italic text-white/60">Enrollment is disabled</Text>}</View></View>
        {section.enrollmentCodeExpiry ? <Text className="mt-3 font-sans text-[10px] text-white/55">Expires {new Date(section.enrollmentCodeExpiry).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</Text> : null}
        {isTeacher ? <View className="mt-4 flex-row gap-3"><CampusButton className="flex-1" label="Reset" icon="refresh" variant="gold" onPress={() => void resetCode()} /><Pressable accessibilityRole="button" onPress={disableCode} className="min-h-14 flex-1 items-center justify-center rounded-2xl border border-white/25"><Text className="font-sans-bold text-sm text-white">Disable</Text></Pressable></View> : null}
      </CampusCard>

      {isTeacher ? <CampusCard className="mb-5 p-4">
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: isEnrollOpen }} onPress={() => setIsEnrollOpen((open) => !open)} className="min-h-12 flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center rounded-2xl bg-maroon/5 dark:bg-golden/10"><MaterialIcons name="person-add" size={19} color={isDark ? '#FFDF00' : '#7B1113'} /></View><View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">Enroll a student</Text><Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">Search the campus directory</Text></View><MaterialIcons name={isEnrollOpen ? 'expand-less' : 'expand-more'} size={22} color="#746C6E" /></Pressable>
        {isEnrollOpen ? <View className="mt-4 border-t border-line pt-4 dark:border-line-dark"><View className="min-h-14 flex-row items-center rounded-2xl border border-line bg-zinc-50 px-4 dark:border-line-dark dark:bg-white/5"><MaterialIcons name="search" size={19} color="#746C6E" /><TextInput accessibilityLabel="Search students to enroll" className="h-full flex-1 px-3 font-sans text-sm text-ink dark:text-white" placeholder="Name or student number" placeholderTextColor={isDark ? '#71717A' : '#8A8284'} value={enrollSearch} onChangeText={setEnrollSearch} /></View><View className="mt-3 gap-2">{enrollCandidates.slice(0, 6).map((student) => <Pressable key={student.id} accessibilityRole="button" accessibilityLabel={`Enroll ${student.fullName}`} onPress={() => void enroll(student.id, student.fullName)} className="min-h-14 flex-row items-center gap-3 rounded-2xl bg-zinc-50 px-3 dark:bg-white/5"><View className="h-10 w-10 items-center justify-center rounded-xl bg-maroon dark:bg-golden"><Text className="font-sans-bold text-xs text-white dark:text-maroon-dark">{initials(student.fullName)}</Text></View><View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">{student.fullName}</Text><Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">{student.studentId} · {student.program}</Text></View><MaterialIcons name="add-circle" size={22} color={isDark ? '#FFDF00' : '#7B1113'} /></Pressable>)}{enrollSearch && !enrollCandidates.length ? <Text className="py-5 text-center font-sans text-xs text-muted dark:text-zinc-500">No eligible students found.</Text> : null}</View></View> : null}
      </CampusCard> : null}

      {isTeacher ? <>
        <SectionHeading eyebrow="Student leadership" title="Section roles" />
        <CampusCard className="mb-7 p-4">
          <View className="border-b border-line pb-5 dark:border-line-dark"><View className="flex-row items-center justify-between"><View><Text className="font-sans-bold text-sm text-ink dark:text-white">President</Text><Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">May create sessions with a 24-hour grant</Text></View><Pressable accessibilityRole="button" onPress={() => setAssignRole('president')} className="min-h-11 justify-center rounded-xl bg-maroon/5 px-3 dark:bg-golden/10"><Text className="font-sans-bold text-xs text-maroon dark:text-golden">{president ? 'Replace' : 'Assign'}</Text></Pressable></View>
            {president ? <View className="mt-4 rounded-2xl bg-zinc-50 p-3 dark:bg-white/5"><View className="flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center rounded-xl bg-maroon dark:bg-golden"><Text className="font-sans-bold text-xs text-white dark:text-maroon-dark">{initials(president.studentName)}</Text></View><View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">{president.studentName}</Text><Text className={`mt-1 font-sans-bold text-[10px] ${activePresidentPermission ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted dark:text-zinc-500'}`}>{activePresidentPermission ? '24-hour permission active' : 'No active session permission'}</Text></View></View><View className="mt-3 flex-row gap-2"><Pressable accessibilityRole="button" onPress={() => { void (activePresidentPermission ? api.revokeSessionPermission(id!, president.studentId) : api.grantSessionPermission(id!, president.studentId)).then(refreshPermissions) }} className="min-h-11 flex-1 items-center justify-center rounded-xl border border-line dark:border-line-dark"><Text className="font-sans-bold text-[10px] text-maroon dark:text-golden">{activePresidentPermission ? 'Revoke grant' : 'Grant 24 hours'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Remove president" onPress={() => { void api.removeSectionRole(id!, president.studentId, 'president').then(refreshRoles) }} className="h-11 w-11 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/30"><MaterialIcons name="delete-outline" size={19} color="#DC2626" /></Pressable></View></View> : <Text className="mt-4 font-sans text-xs text-muted dark:text-zinc-500">No president assigned.</Text>}
          </View>
          <View className="pt-5"><View className="flex-row items-center justify-between"><View><Text className="font-sans-bold text-sm text-ink dark:text-white">QAC coordinators</Text><Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">May upload proof of class</Text></View><Pressable accessibilityRole="button" onPress={() => setAssignRole('qac')} className="min-h-11 justify-center rounded-xl bg-maroon/5 px-3 dark:bg-golden/10"><Text className="font-sans-bold text-xs text-maroon dark:text-golden">Assign</Text></Pressable></View><View className="mt-4 flex-row flex-wrap gap-2">{qacMembers.map((role) => <View key={role.id} className="min-h-11 flex-row items-center gap-2 rounded-full border border-line bg-zinc-50 pl-3 pr-1 dark:border-line-dark dark:bg-white/5"><Text className="font-sans-bold text-xs text-ink dark:text-white">{role.studentName}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${role.studentName} as QAC`} onPress={() => { void api.removeSectionRole(id!, role.studentId, 'qac').then(refreshRoles) }} className="h-9 w-9 items-center justify-center rounded-full"><MaterialIcons name="close" size={16} color="#DC2626" /></Pressable></View>)}{!qacMembers.length ? <Text className="font-sans text-xs text-muted dark:text-zinc-500">No QAC coordinators assigned.</Text> : null}</View></View>
        </CampusCard>
      </> : null}

      <SectionHeading eyebrow="Attendance" title="Section performance" />
      <AttendanceMetricGrid metrics={[{ label: 'Present', value: totalPresent, tone: 'success' }, { label: 'Late', value: totalLate, tone: 'warning' }, { label: 'Absent', value: totalAbsent, tone: 'danger' }]} />
      <View className="mb-4 min-h-14 flex-row items-center rounded-2xl border border-line bg-white px-4 dark:border-line-dark dark:bg-surface-dark"><MaterialIcons name="search" size={20} color="#746C6E" /><TextInput accessibilityLabel="Search enrolled students" className="h-full flex-1 px-3 font-sans text-sm text-ink dark:text-white" placeholder="Search roster" placeholderTextColor={isDark ? '#71717A' : '#8A8284'} value={search} onChangeText={setSearch} /></View>
      <View className="gap-3">{paged.map((student) => {
        const total = student.attendance.present + student.attendance.late + student.attendance.absent
        const rate = total ? Math.round((student.attendance.present / total) * 100) : 0
        return <CampusCard key={student.id} onPress={() => router.push({ pathname: '/(faculty)/student/[id]', params: { id: student.id, sectionId: section.id } })} accessibilityLabel={`Open ${student.fullName}`} className="p-4"><View className="flex-row items-center gap-3"><View className="h-12 w-12 items-center justify-center rounded-2xl bg-maroon dark:bg-golden"><Text className="font-sans-bold text-xs text-white dark:text-maroon-dark">{initials(student.fullName)}</Text></View><View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">{student.fullName}</Text><Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">{student.studentId} · {student.program}</Text></View><Text className="font-heading text-xl text-maroon dark:text-golden">{rate}%</Text><MaterialIcons name="chevron-right" size={20} color="#746C6E" /></View><View className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10"><View className="h-full rounded-full bg-golden" style={{ width: `${rate}%` }} /></View><View className="mt-3 flex-row gap-4"><Text className="font-sans-bold text-[10px] text-emerald-700 dark:text-emerald-300">{student.attendance.present} present</Text><Text className="font-sans-bold text-[10px] text-amber-700 dark:text-amber-300">{student.attendance.late} late</Text><Text className="font-sans-bold text-[10px] text-red-700 dark:text-red-300">{student.attendance.absent} absent</Text></View></CampusCard>
      })}{!paged.length ? <CampusEmptyState icon="person-search" title="No students found" description="Try a different name or student number." /> : null}</View>
      {pageCount > 1 ? <View className="mt-5 flex-row items-center justify-center gap-3"><CampusButton className="flex-1" label="Previous" variant="secondary" disabled={page === 0} onPress={() => setPage((value) => Math.max(0, value - 1))} /><Text className="font-sans-bold text-xs text-muted dark:text-zinc-400">{page + 1}/{pageCount}</Text><CampusButton className="flex-1" label="Next" variant="secondary" disabled={page === pageCount - 1} onPress={() => setPage((value) => Math.min(pageCount - 1, value + 1))} /></View> : null}
    </ScrollView>

    <ChoiceSheet visible={assignRole !== null} title={assignRole === 'president' ? 'Assign president' : 'Assign QAC coordinator'} options={assignCandidates.map((student) => ({ value: student.id, label: `${student.fullName} · ${student.studentId}` }))} value="" onSelect={(studentId) => { void assignStudentRole(studentId) }} onClose={() => setAssignRole(null)} />
  </SafeAreaView>
}
