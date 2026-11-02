import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { AttendanceStanding } from '@polycheck/shared'
import { api } from '../services/api-client'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import { CampusCard } from './CampusPrimitives'
import {
  dismissStandingAlert,
  formatStandingRate,
  isStandingAlertDismissed,
  pickStandingAlert,
} from '../lib/standing-alert'

/**
 * Supportive, dismissible attendance-standing notice for the student
 * dashboard. Supplementary by design: any failure (offline, missing endpoint)
 * simply renders nothing so core dashboard flows are untouched.
 */
export function StudentStandingBanner({ userId }: { userId: string }) {
  const { isDark } = useTheme()
  const [alert, setAlert] = useState<AttendanceStanding | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!userId) return
      const current = api.getCurrentUser()
      if (!current || current.role !== 'student') return
      try {
        const standings = await api.getMyStanding()
        if (cancelled) return
        const standing = pickStandingAlert(standings)
        if (!standing || standing.attendanceRate === null) return
        if (isStandingAlertDismissed(userId, standing.sectionId)) return
        setAlert(standing)
      } catch {
        // Offline or unavailable: the notice is not critical to the dashboard.
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!alert || alert.attendanceRate === null) return null

  const professor = alert.professorName.trim() || 'your professor'
  const rate = formatStandingRate(alert.attendanceRate)
  const accent = isDark ? pupColors.golden : pupColors.maroon

  const dismiss = () => {
    dismissStandingAlert(userId, alert.sectionId)
    setAlert(null)
  }

  return (
    <CampusCard
      testID="student-standing-banner"
      onPress={() => router.push(`/(tabs)/subject-info/${alert.sectionId}`)}
      accessibilityLabel={`View attendance standing for ${alert.subjectName}`}
      className="mb-4 border-golden/60 border-l-golden bg-golden/10 pr-12 dark:border-golden/25 dark:bg-golden/5"
    >
      <View className="flex-row items-start gap-3">
        <View className="mt-0.5 h-9 w-9 items-center justify-center bg-golden/20 dark:bg-golden/10">
          <MaterialIcons name="error-outline" size={20} color={accent} />
        </View>
        <View className="flex-1">
          <Text className="font-sans-bold text-[10px] uppercase tracking-[2px] text-maroon dark:text-golden">
            Attendance check
          </Text>
          <Text className="mt-1 font-sans-bold text-sm leading-5 text-maroon-dark dark:text-golden">
            {alert.subjectName} · Section {alert.sectionName}
          </Text>
          <Text className="mt-1 font-sans text-sm leading-5 text-ink dark:text-zinc-200">
            {rate}% (minimum {alert.thresholdPercent}%)
          </Text>
          <Text className="mt-1 font-sans text-xs leading-5 text-ink/80 dark:text-zinc-300">
            {alert.status === 'at_risk'
              ? 'One more recorded absence drops you below the minimum.'
              : `You are below the minimum. Consider talking to ${professor}.`}
          </Text>
          {alert.caveat ? (
            <Text className="mt-1 font-sans text-[11px] leading-4 text-muted dark:text-zinc-500">{alert.caveat}</Text>
          ) : null}
          <View className="mt-2 flex-row items-center gap-1">
            <Text className="font-sans-bold text-[10px] uppercase tracking-widest text-maroon dark:text-golden">View class</Text>
            <MaterialIcons name="chevron-right" size={15} color={accent} />
          </View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss attendance notice"
        testID="student-standing-banner-dismiss"
        hitSlop={10}
        onPress={dismiss}
        className="absolute right-1 top-1 h-10 w-10 items-center justify-center"
      >
        <MaterialIcons name="close" size={18} color={isDark ? pupColors.mutedLight : pupColors.muted} />
      </Pressable>
    </CampusCard>
  )
}
