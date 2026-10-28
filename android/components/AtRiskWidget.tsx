import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { Section, StudentAtRisk } from '@polycheck/shared'
import { api } from '../services/api-client'
import { describeAtRiskDetail, describeAtRiskStatus, formatAtRiskRate } from '../lib/at-risk'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import { CampusCard, CampusEmptyState, SectionHeading } from './CampusPrimitives'
import { FilterChipsRow } from './FilterPrimitives'

const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

/**
 * Deterministic "students to check on" list. The backend performs the scoped
 * standing calculation; this widget only renders and filters by section.
 */
export function AtRiskWidget({
  sections,
  refreshSignal = 0,
}: {
  sections: Section[]
  refreshSignal?: number
}) {
  const { isDark } = useTheme()
  const [selectedSectionId, setSelectedSectionId] = useState('all')
  const [items, setItems] = useState<StudentAtRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    setError(null)
    try {
      const next = await api.getAtRiskStudents({
        limit: 8,
        ...(selectedSectionId !== 'all' ? { sectionId: selectedSectionId } : {}),
      })
      if (request !== requestRef.current) return
      setItems(next)
    } catch (loadError) {
      if (request !== requestRef.current) return
      setError(loadError instanceof Error ? loadError.message : 'Unable to load students.')
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [selectedSectionId])

  useEffect(() => {
    void load()
  }, [load, refreshSignal])

  const sectionOptions = [
    { value: 'all', label: 'All sections' },
    ...sections.map((section) => ({ value: section.id, label: `Sec ${section.section}` })),
  ]

  return (
    <>
      <SectionHeading eyebrow="Oversight" title="Students to check on" />
      <CampusCard className="mb-7 gap-4 p-4" testID="at-risk-widget">
        {sections.length > 1 ? (
          <FilterChipsRow
            label="Filter by section"
            options={sectionOptions}
            value={selectedSectionId}
            onChange={setSelectedSectionId}
            testID="at-risk-section-filter"
          />
        ) : null}

        {loading && items.length === 0 ? (
          <View className="items-center py-8" accessibilityRole="progressbar" accessibilityLabel="Loading students to check on">
            <ActivityIndicator color={isDark ? pupColors.golden : pupColors.maroon} />
            <Text className="mt-2 font-sans text-xs text-muted dark:text-zinc-400">Checking attendance standings…</Text>
          </View>
        ) : error ? (
          <View className="items-center py-6">
            <MaterialIcons name="cloud-off" size={24} color={isDark ? pupColors.golden : pupColors.maroon} />
            <Text className="mt-2 text-center font-sans text-xs leading-5 text-muted dark:text-zinc-400">{error}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Retry loading students" onPress={() => void load()} className="mt-3 min-h-11 justify-center px-3">
              <Text className="font-sans-bold text-xs uppercase tracking-wider text-maroon dark:text-golden">Try again</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <CampusEmptyState
            icon="verified"
            title="EVERYONE IS ON TRACK"
            description="No student in this scope is near the attendance minimum right now."
          />
        ) : (
          <View className="gap-2">
            {items.map((student) => {
              const meta = describeAtRiskStatus(student.status)
              const rate = formatAtRiskRate(student.attendanceRate)
              return (
                <Pressable
                  key={`${student.sectionId}:${student.studentId}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${student.studentName}, ${meta.label}, ${rate} attendance`}
                  onPress={() => router.push({
                    pathname: '/(faculty)/student/[id]',
                    params: { id: student.studentId, sectionId: student.sectionId },
                  })}
                  className="min-h-16 flex-row items-center gap-3 border border-line bg-zinc-50 p-3 dark:border-line-dark dark:bg-white/5"
                >
                  <View className="h-11 w-11 items-center justify-center rounded-none bg-maroon dark:bg-golden">
                    <Text className="font-sans-bold text-xs text-white dark:text-maroon-dark">{initials(student.studentName)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-sans-bold text-sm text-ink dark:text-white" numberOfLines={1}>{student.studentName}</Text>
                    <Text className="mt-0.5 font-sans text-[10px] uppercase tracking-wider text-muted dark:text-zinc-400" numberOfLines={1}>
                      {student.subjectName} · Sec {student.sectionName}
                    </Text>
                    <Text className="mt-1 font-sans text-[11px] text-muted dark:text-zinc-400" numberOfLines={1}>
                      {describeAtRiskDetail(student)}
                    </Text>
                  </View>
                  <View className={`rounded-none border px-2 py-1 ${meta.classes}`}>
                    <Text className={`font-sans-bold text-[9px] uppercase tracking-wider ${meta.textClasses}`}>{meta.label}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={19} color={isDark ? pupColors.mutedLight : pupColors.muted} />
                </Pressable>
              )
            })}
          </View>
        )}
      </CampusCard>
    </>
  )
}
