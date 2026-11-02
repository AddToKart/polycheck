import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { canAccessAcademicOversight, type StudentAtRisk } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useAuthGate } from '../../hooks/use-auth-gate'
import { useTheme } from '../../theme/ThemeContext'
import { pupColors } from '../../theme/colors'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusButton, CampusCard, CampusIconButton } from '../../components/CampusPrimitives'

const STATUS_LABELS: Record<StudentAtRisk['status'], string> = {
  below_threshold: 'Below threshold',
  at_risk: 'At risk',
  on_track: 'On track',
  insufficient_data: 'Insufficient data',
}

export default function FacultyAtRiskScreen() {
  const currentUser = useAuthGate(['teacher', 'super_admin'], canAccessAcademicOversight)
  const { isDark, toggle } = useTheme()
  const [rows, setRows] = useState<StudentAtRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await api.getAtRiskStudents({ limit: 50 }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load at-risk students')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!currentUser) return
    void load()
  }, [currentUser, load])

  if (!currentUser) return null

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow="Academic Department Oversight"
        title="At-risk students"
        subtitle={`Students near the attendance floor in ${currentUser.department ?? 'your department'}.`}
        onBack={() => router.back()}
        actions={
          <CampusIconButton
            icon={isDark ? 'light-mode' : 'dark-mode'}
            label="Toggle color theme"
            onPress={toggle}
            inverse
          />
        }
      />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={isDark ? pupColors.golden : pupColors.maroon} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => `${item.sectionId}:${item.studentId}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 12 }}
          ListHeaderComponent={
            error ? (
              <View className="mb-3 border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/30">
                <Text className="font-sans text-xs text-red-700 dark:text-red-300">{error}</Text>
              </View>
            ) : (
              <View className="mb-1" />
            )
          }
          ListEmptyComponent={
            <CampusCard className="items-center p-8">
              <MaterialIcons name="verified" size={32} color={isDark ? pupColors.golden : pupColors.maroon} />
              <Text className="mt-3 font-heading text-lg text-ink dark:text-white">Everyone is on track</Text>
              <Text className="mt-1 text-center font-sans text-xs text-muted dark:text-zinc-400">
                No students are close to the attendance threshold in your department.
              </Text>
            </CampusCard>
          }
          renderItem={({ item }) => (
            <CampusCard className="p-4" testID={`at-risk-${item.studentId}-${item.sectionId}`}>
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="font-sans-bold text-sm text-ink dark:text-white">{item.studentName}</Text>
                  <Text className="mt-0.5 font-sans text-[10px] text-muted dark:text-zinc-500">
                    {item.studentNumber ?? '—'} · {item.subjectName} {item.sectionName}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="font-sans-bold text-sm text-maroon dark:text-golden">
                    {item.attendanceRate === null ? '—' : `${item.attendanceRate}%`}
                  </Text>
                  <Text className="font-sans text-[9px] uppercase tracking-wider text-muted dark:text-zinc-500">
                    {STATUS_LABELS[item.status]}
                  </Text>
                </View>
              </View>
              <Text className="mt-2 font-sans text-[11px] text-muted dark:text-zinc-400">
                Professor {item.professorName} · {item.absencesBeforeBelowThreshold ?? '—'} absence(s) before the{' '}
                {item.thresholdPercent}% floor
              </Text>
            </CampusCard>
          )}
          ListFooterComponent={
            <CampusButton
              label="Refresh"
              icon="refresh"
              variant="secondary"
              onPress={() => void load()}
              className="mt-4"
            />
          }
        />
      )}
    </SafeAreaView>
  )
}
