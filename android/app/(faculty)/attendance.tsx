import { useEffect, useState } from 'react'
import { Alert, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { AttendanceReport, User } from '@polycheck/shared'
import * as Clipboard from 'expo-clipboard'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import DatePickerModal from '../../components/DatePickerModal'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusEmptyState, CampusIconButton, SectionHeading } from '../../components/CampusPrimitives'
import { AttendanceDateRangeCard, AttendanceMetricGrid, AttendanceSummaryCard } from '../../components/AttendanceReportCards'

const campusDateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
const campusDate = (date = new Date()) => {
  const parts = new Map(campusDateFormatter.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`
}
const defaultToDate = campusDate()
const defaultFrom = new Date(`${defaultToDate}T00:00:00.000Z`)
defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29)
const defaultFromDate = defaultFrom.toISOString().slice(0, 10)

export default function FacultyAttendanceScreen() {
  const { isDark, toggle } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [report, setReport] = useState<AttendanceReport | null>(null)
  const [fromDate, setFromDate] = useState(defaultFromDate)
  const [toDate, setToDate] = useState(defaultToDate)
  const [fromPickerVisible, setFromPickerVisible] = useState(false)
  const [toPickerVisible, setToPickerVisible] = useState(false)

  useEffect(() => { setUser(api.getCurrentUser()) }, [])
  useEffect(() => {
    if (!user || !fromDate || !toDate) return
    let active = true
    void api.getAttendanceReport({ startDate: fromDate, endDate: toDate })
      .then((nextReport) => { if (active) setReport(nextReport) })
      .catch(() => Alert.alert('Unable to load attendance', 'Check your connection and try again.'))
    return () => { active = false }
  }, [fromDate, toDate, user])

  if (!user) return null
  const totals = report?.totals ?? { totalRecords: 0, totalSessions: 0, present: 0, late: 0, absent: 0, pending: 0, disputed: 0 }
  const isFiltered = fromDate !== defaultFromDate || toDate !== defaultToDate

  const exportAttendance = async () => {
    try {
      const csv = await api.exportAttendanceCsv({ startDate: fromDate, endDate: toDate })
      await Clipboard.setStringAsync(csv)
      Alert.alert('Attendance copied', 'Paste the CSV into a spreadsheet or document.')
    } catch (error) {
      Alert.alert('Unable to export attendance', error instanceof Error ? error.message : 'Try again in a moment.')
    }
  }
  const signOut = () => { void api.logout(); router.replace('/') }

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow="Faculty records"
        title="Attendance overview"
        subtitle="Review class totals and export records for the selected period."
        actions={(
          <>
            <CampusIconButton icon="file-download" label="Export attendance CSV" onPress={() => void exportAttendance()} inverse />
            <CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />
            <CampusIconButton icon="logout" label="Sign out" onPress={signOut} inverse />
          </>
        )}
      />

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-24">
        <AttendanceDateRangeCard
          startDate={fromDate}
          endDate={toDate}
          onStartPress={() => setFromPickerVisible(true)}
          onEndPress={() => setToPickerVisible(true)}
          onReset={() => { setFromDate(defaultFromDate); setToDate(defaultToDate) }}
          filtered={isFiltered}
        />
        <AttendanceMetricGrid metrics={[
          { label: 'Sessions', value: totals.totalSessions, tone: 'brand' },
          { label: 'Present', value: totals.present, tone: 'success' },
          { label: 'Late', value: totals.late, tone: 'warning' },
          { label: 'Absent', value: totals.absent, tone: 'danger' },
          { label: 'Pending', value: totals.pending, tone: 'neutral' },
          { label: 'Disputed', value: totals.disputed, tone: 'disputed' },
        ]} />

        <SectionHeading eyebrow={`${report?.summaries.length ?? 0} classes`} title="Attendance by class" />
        <View className="gap-3">
          {!report?.summaries.length ? <CampusEmptyState icon="assessment" title="No attendance data" description="No records match the selected date range." /> : report.summaries.map((summary) => (
            <AttendanceSummaryCard key={summary.sectionId} summary={summary} onPress={() => router.push(`/(faculty)/sections/${summary.sectionId}` as never)} />
          ))}
        </View>
      </ScrollView>

      <DatePickerModal visible={fromPickerVisible} onClose={() => setFromPickerVisible(false)} onSelectDate={setFromDate} value={fromDate} title="Select From Date" isDark={isDark} />
      <DatePickerModal visible={toPickerVisible} onClose={() => setToPickerVisible(false)} onSelectDate={setToDate} value={toDate} title="Select To Date" isDark={isDark} />
    </SafeAreaView>
  )
}
