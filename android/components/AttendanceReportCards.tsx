import { Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { AttendanceReport, AttendanceReportSummary } from '@polycheck/shared'
import { useTheme } from '../theme/ThemeContext'
import { CampusCard } from './CampusPrimitives'

export const AttendanceDateRangeCard = ({
  startDate,
  endDate,
  onStartPress,
  onEndPress,
  onReset,
  filtered = false,
}: {
  startDate: string
  endDate: string
  onStartPress: () => void
  onEndPress: () => void
  onReset?: () => void
  filtered?: boolean
}) => {
  const { isDark } = useTheme()
  const DateButton = ({ label, value, onPress }: { label: string; value: string; onPress: () => void }) => (
    <View className="flex-1">
      <Text className="mb-2 font-sans-bold text-[10px] uppercase tracking-[1.2px] text-muted dark:text-zinc-500">{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} date ${value}`} onPress={onPress} className="min-h-12 flex-row items-center justify-between rounded-2xl border border-line bg-zinc-50 px-3 dark:border-line-dark dark:bg-white/5">
        <Text className="font-sans-semibold text-xs text-ink dark:text-white">{value}</Text>
        <MaterialIcons name="event" size={17} color={isDark ? '#FFDF00' : '#7B1113'} />
      </Pressable>
    </View>
  )

  return (
    <CampusCard className="mb-5 p-4">
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2"><MaterialIcons name="date-range" size={19} color={isDark ? '#FFDF00' : '#7B1113'} /><Text className="font-sans-bold text-sm text-ink dark:text-white">Date range</Text></View>
        {filtered && onReset ? <Pressable accessibilityRole="button" onPress={onReset} className="min-h-10 justify-center px-2"><Text className="font-sans-bold text-xs text-maroon dark:text-golden">Reset</Text></Pressable> : null}
      </View>
      <View className="flex-row gap-3"><DateButton label="From" value={startDate} onPress={onStartPress} /><DateButton label="To" value={endDate} onPress={onEndPress} /></View>
    </CampusCard>
  )
}

export type AttendanceMetric = {
  label: string
  value: string | number
  tone: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'disputed'
}

const toneClasses: Record<AttendanceMetric['tone'], string> = {
  brand: 'text-maroon dark:text-golden',
  success: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-700 dark:text-amber-300',
  danger: 'text-red-700 dark:text-red-300',
  neutral: 'text-muted dark:text-zinc-300',
  disputed: 'text-orange-700 dark:text-orange-300',
}

export const AttendanceMetricGrid = ({ metrics }: { metrics: AttendanceMetric[] }) => (
  <View className="mb-7 flex-row flex-wrap gap-2">
    {metrics.map((metric) => (
      <View key={metric.label} className="min-w-[31%] flex-1 rounded-2xl border border-line bg-white p-3 dark:border-line-dark dark:bg-surface-dark">
        <Text className={`font-heading text-xl ${toneClasses[metric.tone]}`}>{metric.value}</Text>
        <Text className="mt-1 font-sans-medium text-[10px] text-muted dark:text-zinc-400">{metric.label}</Text>
      </View>
    ))}
  </View>
)

const summaryStatus = [
  { key: 'present' as const, label: 'Present', color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
  { key: 'late' as const, label: 'Late', color: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-300' },
  { key: 'absent' as const, label: 'Absent', color: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
  { key: 'pending' as const, label: 'Pending', color: 'bg-zinc-400', text: 'text-muted dark:text-zinc-300' },
  { key: 'disputed' as const, label: 'Disputed', color: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300' },
]

export const AttendanceSummaryCard = ({ summary, onPress }: { summary: AttendanceReportSummary; onPress?: () => void }) => {
  const total = summary.present + summary.late + summary.absent + summary.pending + summary.disputed
  const attendanceRate = total ? Math.round((summary.present / total) * 100) : 0
  return (
    <CampusCard onPress={onPress} accessibilityLabel={onPress ? `Open ${summary.subjectName} attendance` : undefined} className="p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1"><Text className="font-sans-bold text-base text-ink dark:text-white">{summary.subjectName}</Text><Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">{summary.totalSessions} sessions · {attendanceRate}% present</Text></View>
        {onPress ? <MaterialIcons name="chevron-right" size={21} color="#746C6E" /> : null}
      </View>
      <View className="mt-4 h-2 flex-row overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
        {summaryStatus.map((status) => summary[status.key] > 0 ? <View key={status.key} className={status.color} style={{ flex: summary[status.key] }} /> : null)}
      </View>
      <View className="mt-4 flex-row flex-wrap gap-x-4 gap-y-2">
        {summaryStatus.map((status) => <View key={status.key} className="flex-row items-center gap-1.5"><View className={`h-2 w-2 rounded-full ${status.color}`} /><Text className={`font-sans-bold text-[10px] ${status.text}`}>{summary[status.key]} {status.label}</Text></View>)}
      </View>
    </CampusCard>
  )
}

export const AttendanceDistributionCard = ({ totals }: { totals: AttendanceReport['totals'] }) => {
  const total = totals.totalRecords || 1
  return (
    <CampusCard className="mb-7">
      <Text className="font-sans-bold text-[10px] uppercase tracking-[1.5px] text-muted dark:text-zinc-500">Record distribution</Text>
      <View className="mt-4 h-3 flex-row overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
        {summaryStatus.map((status) => totals[status.key] > 0 ? <View key={status.key} className={status.color} style={{ flex: totals[status.key] }} /> : null)}
      </View>
      <View className="mt-5 gap-3">
        {summaryStatus.map((status) => (
          <View key={status.key} className="flex-row items-center gap-2">
            <View className={`h-2.5 w-2.5 rounded-full ${status.color}`} />
            <Text className="flex-1 font-sans-medium text-xs text-ink dark:text-zinc-200">{status.label}</Text>
            <Text className={`font-sans-bold text-xs ${status.text}`}>{totals[status.key]} · {Math.round((totals[status.key] / total) * 100)}%</Text>
          </View>
        ))}
      </View>
    </CampusCard>
  )
}
