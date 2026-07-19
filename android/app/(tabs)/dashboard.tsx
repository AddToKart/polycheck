import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { AttendanceRecord, AttendanceStatus, ScheduleDay, Section, Subject } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { CampusHeader } from '../../components/CampusHeader'
import {
  AttendanceStatusPill,
  CampusButton,
  CampusCard,
  CampusEmptyState,
  CampusIconButton,
  MetricTile,
  SectionHeading,
} from '../../components/CampusPrimitives'
import { IdCardModal } from '../../components/IdCardModal'

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const greeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardScreen() {
  const { isDark, toggle } = useTheme()
  const [refreshing, setRefreshing] = useState(false)
  const [showIdModal, setShowIdModal] = useState(false)
  const user = api.getCurrentUser()
  const student = useMemo(() => {
    if (!user) return null
    return {
      id: user.id,
      fullName: user.fullName || 'Student',
      studentId: user.studentId || user.id || '2024-00001',
      program: user.program || 'PUP Student',
      yearLevel: user.yearLevel || 1,
    }
  }, [user])

  const [mySections, setMySections] = useState<Section[]>([])
  const [myAttendance, setMyAttendance] = useState<AttendanceRecord[]>([])
  const [subjects, setSubjects] = useState<Record<string, Subject>>({})

  const loadDashboard = useCallback(async () => {
    if (!student) return
    const [sections, attendance, allSubjects] = await Promise.all([
      api.getStudentSections(student.id),
      api.getMyAttendance(student.id),
      api.getSubjects(),
    ])
    setMySections(sections)
    setMyAttendance(attendance)
    setSubjects(Object.fromEntries(allSubjects.map((subject) => [subject.id, subject])))
  }, [student?.id])

  useEffect(() => {
    void loadDashboard().catch(() => undefined)
  }, [loadDashboard])

  const attendanceTotals = useMemo(() => myAttendance.reduce(
    (totals, record) => ({ ...totals, [record.status]: totals[record.status] + 1 }),
    { present: 0, late: 0, absent: 0, pending: 0, disputed: 0 } as Record<AttendanceStatus, number>,
  ), [myAttendance])

  const attendanceRate = myAttendance.length > 0
    ? Math.round((attendanceTotals.present / myAttendance.length) * 100)
    : 0
  const todayName = dayNames[new Date().getDay()]
  const todaySchedule = useMemo(
    () => mySections.filter((section) => section.schedule.some((day) => day.day === todayName)),
    [mySections, todayName],
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadDashboard()
    } finally {
      setRefreshing(false)
    }
  }, [loadDashboard])

  if (!student) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-campus dark:bg-campus-dark">
        <ActivityIndicator size="large" color="#7B1113" />
      </SafeAreaView>
    )
  }

  const signOut = () => {
    void api.logout()
    router.replace('/')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0B0B0E' : '#F7F6F6' }}>
      <CampusHeader
        eyebrow={greeting()}
        title={student.fullName.split(' ')[0]}
        subtitle={`${student.program} · Year ${student.yearLevel}`}
        actions={(
          <>
            <CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />
            <CampusIconButton icon="logout" label="Sign out" onPress={signOut} inverse />
          </>
        )}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#FFDF00' : '#7B1113'} />}
      >
        {/* Credential Card */}
        <CampusCard className="mb-4 bg-white dark:bg-surface-dark border-l-4 border-l-golden rounded-none">
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1">
              <Text className="font-sans-bold text-[10px] uppercase tracking-[2.5px] text-muted dark:text-zinc-400">Student Credential</Text>
              <Text className="mt-1 font-mono text-xl font-bold text-maroon dark:text-golden">{student.studentId}</Text>
              <Text className="mt-0.5 font-sans text-xs text-muted dark:text-zinc-400">Verified PUP Account</Text>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-none bg-maroon/5 dark:bg-golden/10 border border-maroon/10 dark:border-golden/20">
              <MaterialIcons name="verified-user" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
            </View>
          </View>
          <CampusButton
            label="View Digital ID Card"
            icon="badge"
            variant="secondary"
            onPress={() => setShowIdModal(true)}
            className="mt-4"
          />
        </CampusCard>

        <View className="mb-6 flex-row flex-wrap gap-3">
          <MetricTile label="Enrolled Classes" value={mySections.length} icon="auto-stories" />
          <MetricTile label="Attendance Rate" value={`${attendanceRate}%`} icon="insights" />
        </View>

        <CampusCard className="mb-7 rounded-none border-t-4 border-t-maroon dark:border-t-golden">
          <Text className="mb-4 font-sans-bold text-[10px] uppercase tracking-[2.5px] text-muted dark:text-zinc-400">Attendance Snapshot</Text>
          <View className="flex-row justify-between">
            {([
              ['Present', attendanceTotals.present, 'text-emerald-700 dark:text-emerald-300'],
              ['Late', attendanceTotals.late, 'text-amber-700 dark:text-amber-300'],
              ['Absent', attendanceTotals.absent, 'text-red-700 dark:text-red-300'],
              ['Disputed', attendanceTotals.disputed, 'text-maroon dark:text-golden'],
            ] as const).map(([label, value, color]) => (
              <View key={label} className="items-center">
                <Text className={`font-heading text-3xl font-bold ${color}`}>{value}</Text>
                <Text className="mt-1 font-sans-bold text-[10px] uppercase tracking-wider text-muted dark:text-zinc-400">{label}</Text>
              </View>
            ))}
          </View>
        </CampusCard>

        <SectionHeading
          eyebrow="Today"
          title="Your Class Schedule"
          actionLabel="Full Schedule"
          onAction={() => router.push('/(tabs)/schedule')}
        />

        <View className="mb-7 gap-3">
          {todaySchedule.length === 0 ? (
            <CampusEmptyState icon="event-available" title="YOUR DAY IS CLEAR" description="There are no enrolled classes scheduled for today." />
          ) : todaySchedule.map((section) => {
            const parent = subjects[section.subjectId]
            const schedule = section.schedule.find((day: ScheduleDay) => day.day === todayName)
            const status = myAttendance.find((record) => record.sectionId === section.id)?.status ?? 'pending'

            return (
              <CampusCard
                key={section.id}
                onPress={() => router.push(`/(tabs)/subject-info/${section.id}`)}
                accessibilityLabel={`Open ${parent?.name ?? 'class'} details`}
                className="p-4 rounded-none border-l-4 border-l-maroon dark:border-l-golden"
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-none bg-maroon dark:bg-golden">
                    <Text className="font-sans-bold text-xs text-white dark:text-maroon-dark">{schedule?.startTime ?? '—'}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-sans-bold text-base text-ink dark:text-white" numberOfLines={1}>{parent?.name ?? 'Class'}</Text>
                    <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400 uppercase tracking-wider">
                      {parent?.code} · Sec {section.section} · {section.room || 'Room TBA'}
                    </Text>
                    <View className="mt-3"><AttendanceStatusPill status={status} /></View>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={isDark ? '#A1A1AA' : '#746C6E'} />
                </View>
              </CampusCard>
            )
          })}
        </View>

        <CampusButton label="Enroll in a class" icon="add" onPress={() => router.push('/(tabs)/enroll')} className="mb-8" />

        <SectionHeading eyebrow="Enrolled" title="My Classes" />
        <View className="gap-3">
          {mySections.length === 0 ? (
            <CampusEmptyState icon="auto-stories" title="NO CLASSES YET" description="Use an enrollment code from your instructor to add a class." />
          ) : mySections.slice(0, 4).map((section) => {
            const parent = subjects[section.subjectId]
            const records = myAttendance.filter((record) => record.sectionId === section.id)
            const presentCount = records.filter((record) => record.status === 'present').length
            const rate = records.length ? Math.round((presentCount / records.length) * 100) : 0

            return (
              <CampusCard
                key={section.id}
                onPress={() => router.push(`/(tabs)/subject-info/${section.id}`)}
                accessibilityLabel={`Open ${parent?.name ?? 'class'}`}
                className="rounded-none border-l-4 border-l-maroon dark:border-l-golden"
              >
                <View className="flex-row items-start gap-4">
                  <View className="h-10 w-10 items-center justify-center rounded-none bg-maroon/5 dark:bg-golden/10 border border-maroon/10 dark:border-golden/20">
                    <MaterialIcons name="menu-book" size={20} color={isDark ? '#FFDF00' : '#7B1113'} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-sans-bold text-base text-ink dark:text-white">{parent?.name ?? 'Class'}</Text>
                    <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400 uppercase tracking-wider">{parent?.code} · Sec {section.section} · {section.teacherName}</Text>
                    <View className="mt-4 flex-row items-center gap-3">
                      <View className="h-2 flex-1 overflow-hidden rounded-none bg-zinc-100 dark:bg-white/10">
                        <View className="h-full bg-golden" style={{ width: `${rate}%` }} />
                      </View>
                      <Text className="w-9 text-right font-sans-bold text-xs text-muted dark:text-zinc-300">{records.length ? `${rate}%` : '—'}</Text>
                    </View>
                  </View>
                </View>
              </CampusCard>
            )
          })}
        </View>

        {mySections.length > 4 ? (
          <CampusButton
            label={`View all ${mySections.length} classes`}
            icon="arrow-forward"
            variant="secondary"
            onPress={() => router.push('/(tabs)/subjects')}
            className="mt-4"
          />
        ) : null}
      </ScrollView>

      <IdCardModal
        visible={showIdModal}
        student={student}
        onClose={() => setShowIdModal(false)}
      />
    </SafeAreaView>
  )
}
