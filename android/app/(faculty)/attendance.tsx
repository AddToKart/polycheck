import { useEffect, useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { getRecentCampusDateRange, type AttendanceReport, type Section, type Subject } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useAuthGate } from '../../hooks/use-auth-gate'
import { shareCsvFile } from '../../services/file-sharing'
import { useTheme } from '../../theme/ThemeContext'
import DatePickerModal from '../../components/DatePickerModal'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusEmptyState, CampusIconButton, SectionHeading } from '../../components/CampusPrimitives'
import { AttendanceDateRangeCard, AttendanceMetricGrid, AttendanceSummaryCard } from '../../components/AttendanceReportCards'
import { FilterChip, FilterPanel, FilterSelect } from '../../components/FilterPrimitives'
import { useCampusToast } from '../../components/CampusToast'
import { datePresetRange } from '../../lib/filters'

const { startDate: defaultFromDate, endDate: defaultToDate } = getRecentCampusDateRange(30)

type QuickRange = 'today' | '7d' | '30d'

const quickRanges: Array<{ value: QuickRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

export default function FacultyAttendanceScreen() {
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const user = useAuthGate(['teacher', 'super_admin'])
  const [report, setReport] = useState<AttendanceReport | null>(null)
  const [fromDate, setFromDate] = useState(defaultFromDate)
  const [toDate, setToDate] = useState(defaultToDate)
  const [fromPickerVisible, setFromPickerVisible] = useState(false)
  const [toPickerVisible, setToPickerVisible] = useState(false)
  const [quickRange, setQuickRange] = useState<QuickRange | null>('30d')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedSection, setSelectedSection] = useState('')

  useEffect(() => {
    if (!user) return
    void Promise.all([api.getSubjects(), api.getSections()])
      .then(([nextSubjects, nextSections]) => {
        setSubjects(nextSubjects)
        setSections(nextSections)
      })
      .catch(() => showToast('error', 'Unable to load filters', 'Subject and section choices are temporarily unavailable.'))
  }, [showToast, user])

  useEffect(() => {
    if (!user || !fromDate || !toDate) return
    let active = true
    void api.getAttendanceReport({
      startDate: fromDate,
      endDate: toDate,
      subjectId: selectedSubject || undefined,
      sectionId: selectedSection || undefined,
    })
      .then((nextReport) => { if (active) setReport(nextReport) })
      .catch(() => showToast('error', 'Unable to load attendance', 'Check your connection and try again.'))
    return () => { active = false }
  }, [fromDate, selectedSection, selectedSubject, toDate, user])

  const sectionOptions = useMemo(() => sections
    .filter((section) => !selectedSubject || section.subjectId === selectedSubject)
    .map((section) => ({ id: section.id, label: `Section ${section.section}`, hint: subjects.find((subject) => subject.id === section.subjectId)?.code })), [sections, selectedSubject, subjects])

  const isFiltered = fromDate !== defaultFromDate || toDate !== defaultToDate || selectedSubject !== '' || selectedSection !== ''

  if (!user) return null
  const totals = report?.totals ?? { totalRecords: 0, totalSessions: 0, present: 0, late: 0, absent: 0, pending: 0, disputed: 0, excused: 0 }

  const applyQuickRange = (range: QuickRange) => {
    const next = datePresetRange(range)
    if (!next.startDate || !next.endDate) return
    setQuickRange(range)
    setFromDate(next.startDate)
    setToDate(next.endDate)
  }

  const selectSubject = (subjectId: string) => {
    setSelectedSubject(subjectId)
    if (selectedSection && subjectId) {
      const section = sections.find((candidate) => candidate.id === selectedSection)
      if (section?.subjectId !== subjectId) setSelectedSection('')
    }
  }

  const selectSection = (sectionId: string) => {
    setSelectedSection(sectionId)
    if (sectionId) {
      const section = sections.find((candidate) => candidate.id === sectionId)
      if (section && !selectedSubject) setSelectedSubject(section.subjectId)
    }
  }

  const resetFilters = () => {
    setFromDate(defaultFromDate)
    setToDate(defaultToDate)
    setQuickRange('30d')
    setSelectedSubject('')
    setSelectedSection('')
  }

  const exportAttendance = async () => {
    try {
      const csv = await api.exportAttendanceCsv({
        startDate: fromDate,
        endDate: toDate,
        subjectId: selectedSubject || undefined,
        sectionId: selectedSection || undefined,
      })
      await shareCsvFile(csv, `polycheck-attendance-${fromDate}-to-${toDate}.csv`)
    } catch (error) {
      showToast('error', 'Unable to export attendance', error instanceof Error ? error.message : 'Try again in a moment.')
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
        <FilterPanel filtered={isFiltered} onClear={resetFilters} title="Report scope">
          <View className="flex-row flex-wrap gap-2">
            <FilterSelect
              label="Subject"
              value={selectedSubject}
              placeholder="All subjects"
              options={subjects.map((subject) => ({ id: subject.id, label: `${subject.name} (${subject.code})` }))}
              onSelect={selectSubject}
              testID="attendance-subject-filter"
            />
            <FilterSelect
              label="Section"
              value={selectedSection}
              placeholder="All sections"
              options={sectionOptions}
              onSelect={selectSection}
              testID="attendance-section-filter"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {quickRanges.map((range) => (
              <FilterChip
                key={range.value}
                label={range.label}
                selected={quickRange === range.value}
                onPress={() => applyQuickRange(range.value)}
                testID={`attendance-range-${range.value}`}
              />
            ))}
          </ScrollView>
        </FilterPanel>

        <AttendanceDateRangeCard
          startDate={fromDate}
          endDate={toDate}
          onStartPress={() => setFromPickerVisible(true)}
          onEndPress={() => setToPickerVisible(true)}
          onReset={resetFilters}
          filtered={isFiltered}
        />
        <AttendanceMetricGrid metrics={[
          { label: 'Sessions', value: totals.totalSessions, tone: 'brand' },
          { label: 'Present', value: totals.present, tone: 'success' },
          { label: 'Late', value: totals.late, tone: 'warning' },
          { label: 'Absent', value: totals.absent, tone: 'danger' },
          { label: 'Excused', value: totals.excused, tone: 'excused' },
          { label: 'Pending', value: totals.pending, tone: 'neutral' },
          { label: 'Disputed', value: totals.disputed, tone: 'disputed' },
        ]} />

        <SectionHeading eyebrow={`${report?.summaries.length ?? 0} classes`} title="Attendance by class" />
        <View className="gap-3">
          {!report?.summaries.length ? <CampusEmptyState icon="assessment" title="No attendance data" description="No records match the selected subject, section, and date range." /> : report.summaries.map((summary) => (
            <AttendanceSummaryCard key={summary.sectionId} summary={summary} onPress={() => router.push(`/(faculty)/sections/${summary.sectionId}` as never)} />
          ))}
        </View>
      </ScrollView>

      <DatePickerModal visible={fromPickerVisible} onClose={() => setFromPickerVisible(false)} onSelectDate={(value) => { setFromDate(value); setQuickRange(null) }} value={fromDate} title="Select From Date" isDark={isDark} />
      <DatePickerModal visible={toPickerVisible} onClose={() => setToPickerVisible(false)} onSelectDate={(value) => { setToDate(value); setQuickRange(null) }} value={toDate} title="Select To Date" isDark={isDark} />
    </SafeAreaView>
  )
}
