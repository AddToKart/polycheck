import { Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import Svg, { Circle, G } from 'react-native-svg'
import type { AttendanceReport, AttendanceReportSummary } from '@polycheck/shared'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
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
        <MaterialIcons name="event" size={17} color={isDark ? pupColors.golden : pupColors.maroon} />
      </Pressable>
    </View>
  )

  return (
    <CampusCard className="mb-5 p-4">
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2"><MaterialIcons name="date-range" size={19} color={isDark ? pupColors.golden : pupColors.maroon} /><Text className="font-sans-bold text-sm text-ink dark:text-white">Date range</Text></View>
        {filtered && onReset ? <Pressable accessibilityRole="button" onPress={onReset} className="min-h-10 justify-center px-2"><Text className="font-sans-bold text-xs text-maroon dark:text-golden">Reset</Text></Pressable> : null}
      </View>
      <View className="flex-row gap-3"><DateButton label="From" value={startDate} onPress={onStartPress} /><DateButton label="To" value={endDate} onPress={onEndPress} /></View>
    </CampusCard>
  )
}

export type AttendanceMetric = {
  label: string
  value: string | number
  tone: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'disputed' | 'excused'
}

const toneClasses: Record<AttendanceMetric['tone'], string> = {
  brand: 'text-maroon dark:text-golden',
  success: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-700 dark:text-amber-300',
  danger: 'text-red-700 dark:text-red-300',
  neutral: 'text-muted dark:text-zinc-300',
  disputed: 'text-orange-700 dark:text-orange-300',
  excused: 'text-cyan-700 dark:text-cyan-300',
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
  { key: 'excused' as const, label: 'Excused', color: 'bg-cyan-600', text: 'text-cyan-700 dark:text-cyan-300' },
]

export const AttendanceSummaryCard = ({ summary, onPress }: { summary: AttendanceReportSummary; onPress?: () => void }) => {
  const { isDark } = useTheme()
  const total = summary.present + summary.late + summary.absent + summary.pending + summary.disputed + summary.excused
  const attendanceRate = total ? Math.round((summary.present / total) * 100) : 0
  return (
    <CampusCard onPress={onPress} accessibilityLabel={onPress ? `Open ${summary.subjectName} attendance` : undefined} className="p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1"><Text className="font-sans-bold text-base text-ink dark:text-white">{summary.subjectName}</Text><Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">{summary.totalSessions} sessions · {attendanceRate}% present</Text></View>
        {onPress ? <MaterialIcons name="chevron-right" size={21} color={isDark ? pupColors.mutedLight : pupColors.muted} /> : null}
      </View>
      <View className="mt-4 h-2 flex-row overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
        {summaryStatus.map((status) => summary[status.key] > 0 ? (
          <View key={status.key} style={{ flex: summary[status.key] }}>
            <View className={`h-full w-full ${status.color}`} />
          </View>
        ) : null)}
      </View>
      <View className="mt-4 flex-row flex-wrap gap-x-4 gap-y-2">
        {summaryStatus.map((status) => <View key={status.key} className="flex-row items-center gap-1.5"><View className={`h-2 w-2 rounded-full ${status.color}`} /><Text className={`font-sans-bold text-[10px] ${status.text}`}>{summary[status.key]} {status.label}</Text></View>)}
      </View>
    </CampusCard>
  )
}

const DONUT_RADIUS = 60
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS
const donutColors: Record<(typeof summaryStatus)[number]['key'], string> = {
  present: pupColors.golden,
  late: pupColors.maroon,
  absent: pupColors.maroonDark,
  pending: pupColors.mutedLight,
  disputed: pupColors.maroonDeep,
  excused: pupColors.excused,
}

export const AttendanceDistributionCard = ({ totals }: { totals: AttendanceReport['totals'] }) => {
  const { isDark } = useTheme()
  const total = totals.totalRecords
  const segments = summaryStatus
    .map((status) => ({ ...status, value: totals[status.key], color: donutColors[status.key] }))
    .filter((status) => status.value > 0)
  let offset = 0

  return (
    <CampusCard className="mb-7">
      <Text className="font-sans-bold text-[10px] uppercase tracking-[1.5px] text-muted dark:text-zinc-500">Record distribution</Text>
      <View className="mt-4 flex-row items-center gap-4">
        <View className="relative">
          <Svg width={140} height={140} accessibilityLabel={`Attendance distribution across ${total} records`}>
            <G rotation={-90} origin="70, 70">
              <Circle cx={70} cy={70} r={DONUT_RADIUS} fill="none" stroke={isDark ? pupColors.lineDark : pupColors.campus} strokeWidth={20} />
              {segments.map((segment) => {
                const length = (segment.value / Math.max(1, total)) * DONUT_CIRCUMFERENCE
                const dashOffset = -offset
                offset += length
                return (
                  <Circle
                    key={segment.key}
                    cx={70}
                    cy={70}
                    r={DONUT_RADIUS}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={20}
                    strokeDasharray={[length, DONUT_CIRCUMFERENCE - length]}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="butt"
                  />
                )
              })}
            </G>
          </Svg>
          <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
            <Text className="font-heading text-2xl text-ink dark:text-white">{total.toLocaleString()}</Text>
            <Text className="font-sans-medium text-[10px] text-muted dark:text-zinc-400">records</Text>
          </View>
        </View>
        <View className="flex-1 gap-2">
          {summaryStatus.map((status) => (
            <View key={status.key} className="flex-row items-center gap-2">
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: donutColors[status.key] }}
              />
              <Text className="flex-1 font-sans-medium text-xs text-ink dark:text-zinc-200">{status.label}</Text>
              <Text className={`font-sans-bold text-xs ${status.text}`}>{totals[status.key]} · {Math.round((totals[status.key] / Math.max(1, total)) * 100)}%</Text>
            </View>
          ))}
        </View>
      </View>
    </CampusCard>
  )
}
