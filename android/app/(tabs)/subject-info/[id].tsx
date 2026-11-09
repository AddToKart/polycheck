import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import type { Section, SectionRole, Session, Subject } from '@polycheck/shared'
import { api } from '../../../services/api-client'
import { useLoadState } from '../../../hooks/use-load-state'
import { useTheme } from '../../../theme/ThemeContext'
import { pupColors } from '../../../theme/colors'
import { CampusHeader } from '../../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, CampusLoadError, CampusSkeleton, ListSkeleton, SectionHeading } from '../../../components/CampusPrimitives'
import { useCampusToast } from '../../../components/CampusToast'

const InfoRow = ({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) => {
  const { isDark } = useTheme()
  return (
    <View className="flex-row items-start gap-3 border-b border-line py-3 last:border-b-0 dark:border-line-dark">
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-maroon/5 dark:bg-golden/10">
        <MaterialIcons name={icon} size={19} color={isDark ? pupColors.golden : pupColors.maroon} />
      </View>
      <View className="flex-1">
        <Text className="font-sans-bold text-[9px] uppercase tracking-[1.2px] text-muted dark:text-zinc-500">{label}</Text>
        <Text className="mt-1 font-sans-semibold text-sm text-ink dark:text-white">{value}</Text>
      </View>
    </View>
  )
}

export default function StudentSubjectInfoScreen() {
  const { isDark } = useTheme()
  const { showToast } = useCampusToast()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [section, setSection] = useState<Section | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [roles, setRoles] = useState<SectionRole[]>([])
  const [hasPermission, setHasPermission] = useState(false)
  const [subject, setSubject] = useState<Subject | null>(null)
  const loadState = useLoadState()
  // Only the newest permission check may write; a stale response must not
  // overwrite a newer grant/revoke result.
  const permissionRequestRef = useRef(0)

  /**
   * Re-reads the current permission. Failures keep the last known state — the
   * card must not flash "No active permission" over a grant the instructor
   * just made because of a transient network hiccup.
   */
  const recheckPermission = useCallback(async (userId: string) => {
    if (!id) return
    const requestId = ++permissionRequestRef.current
    try {
      const permission = await api.checkSessionPermission(id, userId)
      if (requestId !== permissionRequestRef.current) return
      setHasPermission(permission)
    } catch {
      /* keep the last known permission */
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    const currentUser = api.getCurrentUser()
    if (!currentUser) return
    let active = true
    void Promise.all([api.getSection(id), api.getSectionSessions(id), api.getStudentRoles(currentUser.id)])
      .then(async ([nextSection, nextSessions, studentRoles]) => {
        const nextSubject = await api.getSubject(nextSection.subjectId)
        const president = studentRoles.some((role) => role.sectionId === id && role.role === 'president')
        // Keep the initial load's behavior: resolve the permission before the
        // card becomes visible so it never flickers from denied to granted.
        if (president) await recheckPermission(currentUser.id)
        if (!active) return
        setSection(nextSection)
        setSessions(nextSessions)
        setRoles(studentRoles)
        setSubject(nextSubject)
        if (!president) {
          // Clear any in-flight check from a previously viewed section.
          permissionRequestRef.current += 1
          setHasPermission(false)
        }
        loadState.markReady()
      })
      .catch(() => { if (active) loadState.markError() })
    return () => { active = false }
  }, [id, recheckPermission, loadState.reloadToken])

  const studentRoles = roles.filter((role) => role.sectionId === id)
  const isPresident = studentRoles.some((role) => role.role === 'president')
  const isQac = studentRoles.some((role) => role.role === 'qac')

  // Grants/revocations happen on other screens (instructor approvals) and the
  // create-session screen; re-check whenever this screen regains focus so the
  // card reflects the current permission instead of its mount-time snapshot.
  useFocusEffect(useCallback(() => {
    const currentUser = api.getCurrentUser()
    if (!id || !currentUser || !isPresident) return
    void recheckPermission(currentUser.id)
  }, [id, isPresident, recheckPermission]))

  if (loadState.state === 'loading') return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? pupColors.campusDark : pupColors.campus }}
      className="flex-1 bg-campus px-5 pt-10 dark:bg-campus-dark"
    >
      <CampusSkeleton className="h-28 w-full"><View /></CampusSkeleton>
      <View className="mt-3"><ListSkeleton rows={3} rowClass="h-20" /></View>
    </SafeAreaView>
  )
  if (loadState.state === 'error') return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? pupColors.campusDark : pupColors.campus }}
      className="flex-1 justify-center bg-campus px-5 dark:bg-campus-dark"
    >
      <CampusLoadError
        title="Unable to load this class"
        message="Class details could not be fetched. Check your connection and try again."
        onRetry={loadState.retry}
      />
    </SafeAreaView>
  )
  if (!section) return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? pupColors.campusDark : pupColors.campus }}
      className="flex-1 bg-campus p-5 dark:bg-campus-dark"
    >
      <CampusEmptyState icon="error-outline" title="Class not found" description="This class may have been removed or is no longer available to your account." />
    </SafeAreaView>
  )

  const createSession = () => {
    if (!hasPermission) {
      showToast('warning', 'Permission expired', 'Ask your instructor to renew your session creation permission.')
      return
    }
    router.push({ pathname: '/(tabs)/subject-info/[id]/create-session', params: { id } })
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? pupColors.campusDark : pupColors.campus }}
      className="flex-1 bg-campus dark:bg-campus-dark"
    >
      <CampusHeader
        eyebrow={`${subject?.code ?? 'Class'} · Section ${section.section}`}
        title={subject?.name ?? 'Class details'}
        subtitle={`${section.teacherName} · ${section.room || 'Room TBA'}`}
        onBack={() => router.back()}
      />

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-28">
        {studentRoles.length ? (
          <View className="mb-4 flex-row flex-wrap gap-2">
            {isPresident ? <View className="flex-row items-center gap-1.5 rounded-full bg-maroon px-3 py-2 dark:bg-golden"><MaterialIcons name="star" size={15} color={isDark ? pupColors.maroonDark : '#FFFFFF'} /><Text className="font-sans-bold text-xs text-white dark:text-maroon-dark">Section president</Text></View> : null}
            {isQac ? <View className="flex-row items-center gap-1.5 rounded-full border border-golden bg-maroon-dark px-3 py-2"><MaterialIcons name="camera-alt" size={15} color={pupColors.golden} /><Text className="font-sans-bold text-xs text-golden">QAC officer</Text></View> : null}
          </View>
        ) : null}

        {isPresident ? (
          <CampusCard className={`mb-5 ${hasPermission ? 'border-golden bg-golden/10' : ''}`}>
            <View className="flex-row items-start gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-maroon/5 dark:bg-golden/10"><MaterialIcons name="admin-panel-settings" size={21} color={isDark ? pupColors.golden : pupColors.maroon} /></View>
              <View className="flex-1">
                <Text className="font-sans-bold text-sm text-ink dark:text-white">Session permission</Text>
                <Text className="mt-1 font-sans text-xs leading-5 text-muted dark:text-zinc-400">{hasPermission ? 'Your instructor has authorized you to create a session for this class.' : 'No active permission. Ask your instructor to grant access.'}</Text>
              </View>
            </View>
            {hasPermission ? <CampusButton label="Create class session" icon="add" onPress={createSession} className="mt-4" /> : null}
          </CampusCard>
        ) : null}

        <SectionHeading eyebrow="Class profile" title="Subject information" />
        <CampusCard className="mb-7 py-2">
          <InfoRow icon="person" label="Instructor" value={section.teacherName} />
          <InfoRow icon="room" label="Room" value={section.room || 'To be announced'} />
          <InfoRow icon="school" label="Semester" value={section.semester} />
          <View className="py-3">
            <Text className="mb-2 font-sans-bold text-[9px] uppercase tracking-[1.2px] text-muted dark:text-zinc-500">Weekly schedule</Text>
            <View className="flex-row flex-wrap gap-2">
              {section.schedule.map((day, index) => (
                <View key={`${day.day}-${index}`} className="rounded-2xl bg-maroon/5 px-3 py-2 dark:bg-golden/10">
                  <Text className="font-sans-bold text-xs text-maroon dark:text-golden">{day.day}</Text>
                  <Text className="mt-0.5 font-sans text-[10px] text-muted dark:text-zinc-400">{day.startTime}–{day.endTime}{day.room ? ` · ${day.room}` : ''}</Text>
                </View>
              ))}
            </View>
          </View>
        </CampusCard>

        <SectionHeading eyebrow={`${sessions.length} total`} title="Class sessions" />
        <View className="gap-3">
          {!sessions.length ? <CampusEmptyState icon="event-busy" title="No sessions yet" description="Attendance sessions created for this class will appear here." /> : [...sessions].sort((a, b) => b.date.localeCompare(a.date)).map((session) => (
            <CampusCard
              key={session.id}
              onPress={() => router.push({ pathname: '/(tabs)/subject-info/[id]/sessions/[sessionId]', params: { id, sessionId: session.id } })}
              accessibilityLabel={`Open session on ${session.date}`}
              className="p-4"
            >
              <View className="flex-row items-center gap-3">
                <View className={`h-12 w-12 items-center justify-center rounded-2xl ${session.isActive ? 'bg-golden' : 'bg-maroon/5 dark:bg-white/5'}`}><MaterialIcons name={session.isActive ? 'radio-button-checked' : 'event'} size={21} color={session.isActive ? pupColors.maroonDark : isDark ? pupColors.golden : pupColors.maroon} /></View>
                <View className="flex-1">
                  <Text className="font-sans-bold text-sm text-ink dark:text-white">{new Date(`${session.date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                  <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">{session.startTime}–{session.endTime}{session.room ? ` · ${session.room}` : ''}</Text>
                </View>
                {isQac ? <MaterialIcons name="camera-alt" size={18} color={isDark ? pupColors.golden : pupColors.maroon} /> : null}
                <MaterialIcons name="chevron-right" size={21} color={isDark ? '#A1A1AA' : '#746C6E'} />
              </View>
            </CampusCard>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
