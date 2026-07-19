import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import type { AttendanceReport, Subject, Teacher, User } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import DatePickerModal from '../../components/DatePickerModal'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusCard, CampusEmptyState, CampusIconButton, SectionHeading } from '../../components/CampusPrimitives'
import {
  AttendanceDateRangeCard,
  AttendanceDistributionCard,
  AttendanceMetricGrid,
  AttendanceSummaryCard,
} from '../../components/AttendanceReportCards'

const campusDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const campusDate = (date = new Date()) => {
  const parts = new Map(campusDateFormatter.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`
}

const defaultEndDate = campusDate()
const defaultStart = new Date(`${defaultEndDate}T00:00:00.000Z`)
defaultStart.setUTCDate(defaultStart.getUTCDate() - 29)
const defaultStartDate = defaultStart.toISOString().slice(0, 10)

type ReportSelectProps = {
  label: string
  value: string
  placeholder: string
  options: Array<{ id: string; label: string }>
  open: boolean
  onToggle: () => void
  onSelect: (id: string) => void
}

const ReportSelect = ({ label, value, placeholder, options, open, onToggle, onSelect }: ReportSelectProps) => {
  const { isDark } = useTheme()
  const selectedLabel = options.find((option) => option.id === value)?.label ?? placeholder

  return (
    <View>
      <Text className="mb-2 font-sans-bold text-[10px] uppercase tracking-[1.2px] text-muted dark:text-zinc-500">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedLabel}`}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        className="min-h-14 flex-row items-center justify-between rounded-2xl border border-line bg-zinc-50 px-4 dark:border-line-dark dark:bg-white/5"
      >
        <Text className="flex-1 font-sans-semibold text-sm text-ink dark:text-white" numberOfLines={1}>{selectedLabel}</Text>
        <MaterialIcons name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
      </Pressable>
      {open ? (
        <View className="mt-2 overflow-hidden rounded-2xl border border-line bg-white dark:border-line-dark dark:bg-[#1A1517]">
          <Pressable accessibilityRole="button" onPress={() => onSelect('')} className="min-h-12 justify-center border-b border-line px-4 dark:border-line-dark">
            <Text className={`font-sans-semibold text-sm ${value ? 'text-ink dark:text-white' : 'text-maroon dark:text-golden'}`}>{placeholder}</Text>
          </Pressable>
          {options.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: option.id === value }}
              onPress={() => onSelect(option.id)}
              className="min-h-12 flex-row items-center justify-between border-b border-line px-4 last:border-b-0 dark:border-line-dark"
            >
              <Text className={`flex-1 font-sans-medium text-sm ${option.id === value ? 'text-maroon dark:text-golden' : 'text-ink dark:text-white'}`}>{option.label}</Text>
              {option.id === value ? <MaterialIcons name="check" size={18} color={isDark ? '#FFDF00' : '#7B1113'} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

export default function FacultyReportsScreen() {
  const { isDark, toggle } = useTheme()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [report, setReport] = useState<AttendanceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false)
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false)
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [startPickerVisible, setStartPickerVisible] = useState(false)
  const [endPickerVisible, setEndPickerVisible] = useState(false)

  useEffect(() => {
    const user = api.getCurrentUser()
    if (!user || user.role !== 'super_admin') {
      router.replace('/(faculty)/dashboard')
      return
    }
    setCurrentUser(user)
    void Promise.all([api.getSubjects(), api.getTeachers()])
      .then(([nextSubjects, nextTeachers]) => {
        setSubjects(nextSubjects)
        setTeachers(nextTeachers)
      })
      .catch(() => Alert.alert('Unable to load filters', 'Subject and teacher choices are temporarily unavailable.'))
  }, [])

  useEffect(() => {
    if (!currentUser || !startDate || !endDate) return
    let active = true
    setLoading(true)
    void api.getAttendanceReport({
      startDate,
      endDate,
      subjectId: selectedSubject || undefined,
      teacherId: selectedTeacher || undefined,
    }).then((nextReport) => {
      if (active) setReport(nextReport)
    }).catch(() => {
      if (active) Alert.alert('Unable to load report', 'Please check the selected filters and try again.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [currentUser, selectedSubject, selectedTeacher, startDate, endDate])

  if (!currentUser) return null

  const totals = report?.totals ?? { totalRecords: 0, totalSessions: 0, present: 0, late: 0, absent: 0, pending: 0, disputed: 0 }
  const presentRate = totals.totalRecords ? Math.round((totals.present / totals.totalRecords) * 100) : 0
  const isFiltered = selectedSubject !== '' || selectedTeacher !== '' || startDate !== defaultStartDate || endDate !== defaultEndDate

  const resetFilters = () => {
    setSelectedSubject('')
    setSelectedTeacher('')
    setStartDate(defaultStartDate)
    setEndDate(defaultEndDate)
    setShowSubjectDropdown(false)
    setShowTeacherDropdown(false)
  }

  const handleExport = async () => {
    try {
      const csv = await api.exportAttendanceCsv({
        startDate,
        endDate,
        subjectId: selectedSubject || undefined,
        teacherId: selectedTeacher || undefined,
      })
      await Clipboard.setStringAsync(csv)
      Alert.alert('Report copied', 'The filtered attendance CSV is ready in your clipboard.')
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Please narrow the report filters.')
    }
  }

  const handleLogout = () => {
    api.logout()
    router.replace('/')
  }

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow="Institution oversight"
        title="Attendance reports"
        subtitle="Review campus-wide trends, then narrow the evidence by subject, teacher, or date."
        actions={(
          <>
            <CampusIconButton inverse icon="file-download" label="Export filtered report" onPress={() => void handleExport()} />
            <CampusIconButton inverse icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle theme" onPress={toggle} />
            <CampusIconButton inverse icon="logout" label="Sign out" onPress={handleLogout} />
          </>
        )}
      />

      <ScrollView contentContainerClassName="px-4 pb-32 pt-3" showsVerticalScrollIndicator={false}>
        <CampusCard className="mb-4 gap-4 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="tune" size={19} color={isDark ? '#FFDF00' : '#7B1113'} />
              <Text className="font-sans-bold text-sm text-ink dark:text-white">Report scope</Text>
            </View>
            {isFiltered ? (
              <Pressable accessibilityRole="button" onPress={resetFilters} className="min-h-11 justify-center px-2">
                <Text className="font-sans-bold text-xs text-maroon dark:text-golden">Clear all</Text>
              </Pressable>
            ) : null}
          </View>
          <ReportSelect
            label="Subject"
            value={selectedSubject}
            placeholder="All subjects"
            options={subjects.map((subject) => ({ id: subject.id, label: `${subject.name} (${subject.code})` }))}
            open={showSubjectDropdown}
            onToggle={() => {
              setShowSubjectDropdown((open) => !open)
              setShowTeacherDropdown(false)
            }}
            onSelect={(id) => {
              setSelectedSubject(id)
              setShowSubjectDropdown(false)
            }}
          />
          <ReportSelect
            label="Teacher"
            value={selectedTeacher}
            placeholder="All teachers"
            options={teachers.map((teacher) => ({ id: teacher.id, label: teacher.fullName }))}
            open={showTeacherDropdown}
            onToggle={() => {
              setShowTeacherDropdown((open) => !open)
              setShowSubjectDropdown(false)
            }}
            onSelect={(id) => {
              setSelectedTeacher(id)
              setShowTeacherDropdown(false)
            }}
          />
        </CampusCard>

        <AttendanceDateRangeCard
          startDate={startDate}
          endDate={endDate}
          onStartPress={() => setStartPickerVisible(true)}
          onEndPress={() => setEndPickerVisible(true)}
          onReset={resetFilters}
          filtered={isFiltered}
        />

        {loading ? (
          <View accessibilityRole="progressbar" className="items-center py-16">
            <ActivityIndicator size="large" color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text className="mt-4 font-sans-medium text-sm text-muted dark:text-zinc-400">Building the report…</Text>
          </View>
        ) : (
          <>
            <SectionHeading eyebrow="Campus pulse" title="At a glance" />
            <AttendanceMetricGrid metrics={[
              { label: 'Total records', value: totals.totalRecords, tone: 'brand' },
              { label: 'Present rate', value: `${presentRate}%`, tone: 'success' },
              { label: 'Late', value: totals.late, tone: 'warning' },
              { label: 'Absent', value: totals.absent, tone: 'danger' },
              { label: 'Pending', value: totals.pending, tone: 'neutral' },
              { label: 'Disputed', value: totals.disputed, tone: 'disputed' },
            ]} />
            <AttendanceDistributionCard totals={totals} />

            <SectionHeading eyebrow="Academic units" title="Summary by subject" />
            <View className="gap-3">
              {(report?.summaries ?? []).map((summary) => <AttendanceSummaryCard key={summary.sectionId} summary={summary} />)}
              {!report?.summaries.length ? (
                <CampusEmptyState icon="query-stats" title="No report data" description="Try a wider date range or clear one of the report filters." />
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <DatePickerModal visible={startPickerVisible} onClose={() => setStartPickerVisible(false)} onSelectDate={setStartDate} value={startDate} title="Select From Date" isDark={isDark} />
      <DatePickerModal visible={endPickerVisible} onClose={() => setEndPickerVisible(false)} onSelectDate={setEndDate} value={endDate} title="Select To Date" isDark={isDark} />
    </SafeAreaView>
  )
}
