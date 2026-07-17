import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, ScrollView, TouchableOpacity, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../../../services/api-client'
import { useTheme } from '../../../theme/ThemeContext'
import type { Section, Student, Subject, SectionRole, SessionPermission } from '@polycheck/shared'

const PAGE_SIZE = 10

export default function SectionDetailScreen() {
  const { isDark } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [section, setSection] = useState<Section | null>(null)
  const [students, setStudents] = useState<(Student & { attendance: { present: number; late: number; absent: number; disputed: number } })[]>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [parentSubject, setParentSubject] = useState<Subject | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [isEnrollOpen, setIsEnrollOpen] = useState(false)
  const [enrollSearch, setEnrollSearch] = useState('')
  const [sectionRoles, setSectionRoles] = useState<SectionRole[]>([])
  const [sessionPermissions, setSessionPermissions] = useState<SessionPermission[]>([])
  const [presSelectOpen, setPresSelectOpen] = useState(false)
  const [qacSelectOpen, setQacSelectOpen] = useState(false)
  const isTeacher = api.getCurrentUser()?.role === 'teacher'

  const refreshRoster = useCallback(async () => {
    if (id) setStudents(await api.getSectionStudents(id))
  }, [id])
  const refreshRoles = useCallback(async () => {
    if (id) setSectionRoles(await api.getSectionRoles(id))
  }, [id])
  const refreshPermissions = useCallback(async () => {
    if (id) setSessionPermissions(await api.getActiveSessionPermissions(id))
  }, [id])

  useEffect(() => {
    if (!id) return
    const cu = api.getCurrentUser()
    void (async () => {
      const [nextSection, nextStudents] = await Promise.all([api.getSection(id), api.getSectionStudents(id)])
      if (cu?.role === 'teacher' && nextSection.teacherId !== cu.id) { router.replace('/'); return }
      setSection(nextSection)
      setStudents(nextStudents)
      if (cu?.role === 'teacher') {
        const [nextRoles, nextPermissions, nextAllStudents] = await Promise.all([
          api.getSectionRoles(id), api.getActiveSessionPermissions(id), api.getStudents(),
        ])
        setSectionRoles(nextRoles)
        setSessionPermissions(nextPermissions)
        setAllStudents(nextAllStudents)
      }
      setParentSubject(await api.getSubject(nextSection.subjectId))
    })().catch(() => router.back())
  }, [id])

  const enrolledIds = new Set(students.map((s) => s.id))
  const enrollCandidates = useMemo(() => {
    if (!enrollSearch.trim()) return []
    const q = enrollSearch.toLowerCase()
    return allStudents.filter(
      (s) => !enrolledIds.has(s.id) && (s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q))
    )
  }, [allStudents, enrollSearch, enrolledIds])

  const handleEnrollStudent = async (targetId: string, targetName: string) => {
    try {
      await api.enrollStudent({ sectionId: id!, studentId: targetId, studentName: targetName })
      await refreshRoster()
      setSection(await api.getSection(id!))
      Alert.alert('Enrolled', `${targetName} has been enrolled successfully.`)
      setEnrollSearch('')
    } catch (error) {
      Alert.alert('Unable to enroll', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter((s) =>
      s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q)
    )
  }, [students, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => { setPage(0) }, [search])

  const handleResetCode = async () => {
    if (!id) return
    const { enrollmentCode } = await api.resetEnrollmentCode(id)
    setSection(await api.getSection(id))
    Alert.alert('Code Reset', `New enrollment code: ${enrollmentCode}`)
  }

  const handleDisableCode = () => {
    if (!id) return
    Alert.alert(
      'Disable Code',
      'Students will no longer be able to enroll using this code. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: () => {
            void api.disableEnrollmentCode(id).then(async () => setSection(await api.getSection(id)))
          },
        },
      ],
    )
  }

  if (!section) return null

  const totalPresent = students.reduce((sum, s) => sum + s.attendance.present, 0)
  const totalLate = students.reduce((sum, s) => sum + s.attendance.late, 0)
  const totalAbsent = students.reduce((sum, s) => sum + s.attendance.absent, 0)

  const bg = isDark ? '#0A0A0C' : '#F5F5F5'
  const surface = isDark ? '#121215' : '#FFFFFF'
  const border = isDark ? 'rgba(245, 168, 0, 0.15)' : '#EEE'
  const borderInput = isDark ? 'rgba(245, 168, 0, 0.2)' : '#DDD'
  const textPrimary = isDark ? '#FFFFFF' : '#333'
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#888'
  const textTertiary = isDark ? 'rgba(255,255,255,0.5)' : '#999'
  const iconColor = isDark ? '#FFDF00' : '#7B1113'
  const chipBg = isDark ? '#0A0A0C' : '#F5F5F5'
  const chipBorder = isDark ? 'rgba(245, 168, 0, 0.15)' : '#DDD'
  const pillPresentBg = isDark ? 'rgba(245, 168, 0, 0.15)' : '#FFF5E0'
  const pillLateBg = isDark ? 'rgba(239, 68, 68, 0.15)' : '#FDE8E8'
  const pillAbsentBg = isDark ? 'rgba(255, 255, 255, 0.1)' : '#F0F0F0'
  const statBorder = isDark ? 'rgba(245, 168, 0, 0.15)' : '#EEE'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: surface, borderBottomWidth: 1, borderBottomColor: border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={iconColor} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text className="text-lg font-heading font-bold" style={{ color: isDark ? '#FFDF00' : '#4A0A0B' }} numberOfLines={1}>{parentSubject?.name ?? ''}</Text>
          <Text className="text-xs mt-0.5" style={{ color: textSecondary }}>{parentSubject?.code ?? ''} · Sec {section.section}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Subject Info Card */}
        <View style={{ backgroundColor: surface, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border }}>
          <View className="flex-row gap-6 mb-3">
            <View className="flex-1">
              <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px] mb-0.5" style={{ color: textSecondary }}>Room</Text>
              <Text className="text-sm font-sans-bold" style={{ color: textPrimary }}>{section.room}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px] mb-0.5" style={{ color: textSecondary }}>Semester</Text>
              <Text className="text-sm font-sans-bold" style={{ color: textPrimary }}>{section.semester}</Text>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            {section.schedule.map((sd, i) => (
              <View key={i} className="flex-row items-center gap-1 px-2 py-1 border" style={{ backgroundColor: chipBg, borderColor: chipBorder }}>
                <Text className="text-[10px] font-sans-semibold" style={{ color: isDark ? '#FFDF00' : '#7B1113' }}>{sd.day}</Text>
                <Text className="text-[10px]" style={{ color: textSecondary }}>{sd.startTime}-{sd.endTime}</Text>
                {sd.room ? <Text className="text-[9px]" style={{ color: textTertiary }}>{sd.room}</Text> : null}
              </View>
            ))}
          </View>
        </View>

        {isTeacher && <>
        {/* Enrollment Code Card */}
        <View style={{ backgroundColor: surface, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border }}>
          <View className="flex-row items-center gap-1.5 mb-2.5">
            <MaterialIcons name="vpn-key" size={18} color={iconColor} />
            <Text className="text-base font-sans-bold" style={{ color: textPrimary }}>Enrollment Code</Text>
          </View>
          <View className="flex-row items-center gap-3 mb-2.5">
            {section.enrollmentCode ? (
              <>
                <Text className="text-xl font-[monospace] font-bold tracking-[2px]" style={{ color: isDark ? '#FFDF00' : '#7B1113' }}>{section.enrollmentCode}</Text>
                {(() => {
                  const expiry = section.enrollmentCodeExpiry ? new Date(section.enrollmentCodeExpiry) : null
                  if (!expiry) return <Text className="text-[11px]" style={{ color: textSecondary }}>No expiry set</Text>
                  const now = new Date()
                  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  if (daysLeft < 0) {
                    return (
                      <View style={{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA', paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#DC2626', textTransform: 'uppercase', letterSpacing: 0.5 }}>Expired</Text>
                      </View>
                    )
                  } else if (daysLeft <= 3) {
                    return (
                      <View style={{ backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706', textTransform: 'uppercase', letterSpacing: 0.5 }}>Expires in {daysLeft}d</Text>
                      </View>
                    )
                  } else {
                    return <Text className="text-[11px]" style={{ color: textSecondary }}>Expires: {expiry.toLocaleDateString()}</Text>
                  }
                })()}
              </>
            ) : (
              <Text className="text-sm italic" style={{ color: textTertiary }}>Enrollment code is disabled</Text>
            )}
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity className="flex-row items-center gap-1 px-3.5 py-1.5" style={{ backgroundColor: isDark ? '#FFDF00' : '#7B1113' }} onPress={handleResetCode} accessibilityRole="button">
              <MaterialIcons name="autorenew" size={16} color={isDark ? '#4A0A0B' : '#FFF'} />
              <Text className="text-xs font-sans-semibold" style={{ color: isDark ? '#4A0A0B' : '#FFF' }}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity className="px-3.5 py-1.5 flex-row items-center gap-1 border" style={{ borderColor: '#EF4444' }} onPress={handleDisableCode} accessibilityRole="button">
              <MaterialIcons name="block" size={16} color="#EF4444" />
              <Text className="text-red-500 text-xs font-sans-semibold">Disable</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Enroll Student */}
        <View style={{ backgroundColor: surface, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border }}>
          <TouchableOpacity className="flex-row items-center" onPress={() => setIsEnrollOpen(!isEnrollOpen)} accessibilityRole="button">
            <MaterialIcons name="person-add" size={18} color={iconColor} />
            <Text className="text-base font-sans-bold flex-1 ml-1.5" style={{ color: textPrimary }}>Enroll Student</Text>
            <MaterialIcons name={isEnrollOpen ? 'expand-less' : 'expand-more'} size={22} color={textSecondary} />
          </TouchableOpacity>

          {isEnrollOpen && (
            <View className="mt-3">
              <View className="flex-row items-center gap-2 px-3 mb-2" style={{ backgroundColor: isDark ? '#0A0A0C' : '#FAFAFA', borderWidth: 1, borderColor: borderInput }}>
                <MaterialIcons name="search" size={18} color="#888" />
                <TextInput
                  className="flex-1 h-10 text-sm"
                  style={{ color: textPrimary }}
                  value={enrollSearch}
                  onChangeText={setEnrollSearch}
                  placeholder="Search students by name or ID..."
                  placeholderTextColor="#888"
                />
                {enrollSearch ? (
                  <TouchableOpacity onPress={() => setEnrollSearch('')}>
                    <MaterialIcons name="close" size={18} color="#888" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {enrollCandidates.length === 0 ? (
                <Text className="text-sm text-center py-4" style={{ color: textTertiary }}>
                  {enrollSearch.trim() ? 'No matching students found.' : 'Type a name or ID to search for students.'}
                </Text>
              ) : (
                <>
                  {enrollCandidates.slice(0, 10).map((s) => {
                    const isAlreadyEnrolled = enrolledIds.has(s.id)
                    return (
                      <View key={s.id} className="flex-row items-center justify-between p-2.5 mb-1 border" style={{ backgroundColor: isDark ? '#0A0A0C' : '#F9F9F9', borderColor: border }}>
                        <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                          <View className="w-9 h-9 items-center justify-center" style={{ backgroundColor: isDark ? '#FFDF00' : '#7B1113' }}>
                            <Text className="text-xs font-sans-semibold" style={{ color: isDark ? '#4A0A0B' : '#FFF' }}>
                              {s.fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <View className="flex-1 min-w-0">
                            <Text className="text-sm font-sans-semibold" style={{ color: textPrimary }} numberOfLines={1}>{s.fullName}</Text>
                            <Text className="text-[11px]" style={{ color: textSecondary }}>{s.studentId} · {s.program}</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          className="px-3 py-1.5 ml-2"
                          style={{ backgroundColor: isAlreadyEnrolled ? (isDark ? '#333' : '#CCC') : (isDark ? '#FFDF00' : '#7B1113'), opacity: isAlreadyEnrolled ? 0.5 : 1 }}
                          onPress={() => handleEnrollStudent(s.id, s.fullName)}
                          disabled={isAlreadyEnrolled}
                          accessibilityRole="button"
                        >
                          <Text className="text-xs font-sans-semibold" style={{ color: isAlreadyEnrolled ? '#888' : (isDark ? '#4A0A0B' : '#FFF') }}>
                            {isAlreadyEnrolled ? 'Enrolled' : 'Enroll'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )
                  })}
                  {enrollCandidates.length > 10 && (
                    <Text className="text-[11px] text-center py-1.5" style={{ color: textTertiary }}>
                      {enrollCandidates.length - 10} more student{enrollCandidates.length - 10 !== 1 ? 's' : ''} found. Refine your search.
                    </Text>
                  )}
                </>
              )}
            </View>
          )}
        </View>

        {/* Section Roles */}
        <View style={{ backgroundColor: surface, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border }}>
          <View className="flex-row items-center gap-1.5 mb-3">
            <MaterialIcons name="security" size={18} color={iconColor} />
            <Text className="text-base font-sans-bold" style={{ color: textPrimary }}>Section Roles</Text>
          </View>

          {/* President */}
          <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: border }}>
            <View className="flex-row items-center gap-1.5 mb-2">
              <MaterialIcons name="star" size={16} color={iconColor} />
              <Text className="text-sm font-sans-bold" style={{ color: textPrimary }}>President</Text>
            </View>
            {(() => {
              const pres = sectionRoles.find((r) => r.role === 'president')
              if (pres) {
                const perm = sessionPermissions.find((p) => p.studentId === pres.studentId)
                const isExpired = perm ? Date.now() >= new Date(perm.expiresAt).getTime() : true
                return (
                  <View style={{ backgroundColor: isDark ? '#0A0A0C' : '#F9F9F9', padding: 12, borderWidth: 1, borderColor: border, marginBottom: 8 }}>
                    <View className="flex-row items-center gap-2.5 mb-2">
                      <View className="w-8 h-8 items-center justify-center" style={{ backgroundColor: isDark ? '#FFDF00' : '#7B1113' }}>
                        <Text className="text-[10px] font-sans-bold" style={{ color: isDark ? '#4A0A0B' : '#FFF' }}>
                          {pres.studentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-sans-semibold" style={{ color: textPrimary }}>{pres.studentName}</Text>
                        <Text className="text-[10px]" style={{ color: isDark ? '#FFDF00' : '#7B1113' }}>
                          {perm && !isExpired ? `Active until ${new Date(perm.expiresAt).toLocaleString()}` : 'No active permission'}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row gap-2">
                      {perm && !isExpired ? (
                        <TouchableOpacity className="px-3 py-1.5 border" style={{ borderColor: '#EF4444' }} onPress={() => {
                          void api.revokeSessionPermission(id, pres.studentId).then(refreshPermissions)
                        }} accessibilityRole="button">
                          <Text className="text-xs font-sans-semibold text-red-500">Revoke</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity className="px-3 py-1.5" style={{ backgroundColor: isDark ? '#FFDF00' : '#7B1113' }} onPress={() => {
                          void api.grantSessionPermission(id, pres.studentId).then(refreshPermissions)
                        }} accessibilityRole="button">
                          <Text className="text-xs font-sans-semibold" style={{ color: isDark ? '#4A0A0B' : '#FFF' }}>Grant 24hr</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity className="px-3 py-1.5 border" style={{ borderColor: '#FCA5A5' }} onPress={() => {
                        void api.removeSectionRole(id, pres.studentId, 'president').then(refreshRoles)
                      }} accessibilityRole="button">
                        <Text className="text-xs font-sans-semibold text-red-400">Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              }
              return (
                <View>
                  <Text className="text-sm mb-1.5" style={{ color: textTertiary }}>No president assigned</Text>
                  <View style={{ position: 'relative', zIndex: 20 }}>
                    <TouchableOpacity className="flex-row items-center gap-1 px-3 py-1.5 border self-start" style={{ borderColor: border }} onPress={() => setPresSelectOpen(!presSelectOpen)} accessibilityRole="button">
                      <MaterialIcons name="star" size={14} color={iconColor} />
                      <Text className="text-xs font-sans-semibold" style={{ color: textPrimary }}>Assign President</Text>
                    </TouchableOpacity>
                    {presSelectOpen && (
                      <View style={{ position: 'absolute', top: 32, left: 0, width: 260, backgroundColor: surface, borderWidth: 1, borderColor: border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8, maxHeight: 200, zIndex: 100 }}>
                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                          {students.filter(s => !sectionRoles.find(r => r.studentId === s.id && r.role === 'president')).map((s) => (
                            <TouchableOpacity key={s.id} className="px-3 py-2 flex-row items-center gap-2" style={{ borderBottomWidth: 1, borderBottomColor: border }} onPress={() => {
                              void api.assignSectionRole(id, s.id, 'president').then(refreshRoles)
                              setPresSelectOpen(false)
                            }} accessibilityRole="button">
                              <Text className="text-[10px] font-sans-medium" style={{ color: textSecondary }}>{s.studentId}</Text>
                              <Text className="text-sm font-sans-medium" style={{ color: textPrimary }}>{s.fullName}</Text>
                            </TouchableOpacity>
                          ))}
                          {students.filter(s => !sectionRoles.find(r => r.studentId === s.id && r.role === 'president')).length === 0 && (
                            <Text className="px-3 py-2 text-xs" style={{ color: textTertiary }}>All students assigned</Text>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>
              )
            })()}
          </View>

          {/* QAC */}
          <View>
            <View className="flex-row items-center gap-1.5 mb-2">
              <MaterialIcons name="camera-alt" size={16} color={iconColor} />
              <Text className="text-sm font-sans-bold" style={{ color: textPrimary }}>Quality Assurance Coordinator</Text>
              <Text className="text-[10px]" style={{ color: textTertiary }}>(multiple)</Text>
            </View>
            {(() => {
              const qacs = sectionRoles.filter((r) => r.role === 'qac')
              return (
                <View>
                  {qacs.length > 0 ? (
                    <View className="flex-row flex-wrap gap-2 mb-2">
                      {qacs.map((qac) => (
                        <View key={qac.id} className="flex-row items-center gap-1.5 px-2.5 py-1 border" style={{ backgroundColor: isDark ? '#0A0A0C' : '#F9F9F9', borderColor: border }}>
                          <Text className="text-xs font-sans-medium" style={{ color: textPrimary }}>{qac.studentName}</Text>
                          <TouchableOpacity onPress={() => {
                            void api.removeSectionRole(id, qac.studentId, 'qac').then(refreshRoles)
                          }} accessibilityRole="button">
                            <MaterialIcons name="close" size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-sm mb-1.5" style={{ color: textTertiary }}>No QAC assigned</Text>
                  )}
                  <View style={{ position: 'relative', zIndex: 19 }}>
                    <TouchableOpacity className="flex-row items-center gap-1 px-3 py-1.5 border self-start" style={{ borderColor: border }} onPress={() => setQacSelectOpen(!qacSelectOpen)} accessibilityRole="button">
                      <MaterialIcons name="camera-alt" size={14} color={iconColor} />
                      <Text className="text-xs font-sans-semibold" style={{ color: textPrimary }}>Assign QAC</Text>
                    </TouchableOpacity>
                    {qacSelectOpen && (
                      <View style={{ position: 'absolute', top: 32, left: 0, width: 260, backgroundColor: surface, borderWidth: 1, borderColor: border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8, maxHeight: 200, zIndex: 99 }}>
                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                          {students.filter(s => !sectionRoles.find(r => r.studentId === s.id && r.role === 'qac')).map((s) => (
                            <TouchableOpacity key={s.id} className="px-3 py-2 flex-row items-center gap-2" style={{ borderBottomWidth: 1, borderBottomColor: border }} onPress={() => {
                              void api.assignSectionRole(id, s.id, 'qac').then(refreshRoles)
                              setQacSelectOpen(false)
                            }} accessibilityRole="button">
                              <Text className="text-[10px] font-sans-medium" style={{ color: textSecondary }}>{s.studentId}</Text>
                              <Text className="text-sm font-sans-medium" style={{ color: textPrimary }}>{s.fullName}</Text>
                            </TouchableOpacity>
                          ))}
                          {students.filter(s => !sectionRoles.find(r => r.studentId === s.id && r.role === 'qac')).length === 0 && (
                            <Text className="px-3 py-2 text-xs" style={{ color: textTertiary }}>All students assigned</Text>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>
              )
            })()}
          </View>
        </View>
        </>}

        {/* Attendance Overview */}
        <View className="flex-row mb-3" style={{ backgroundColor: surface, borderWidth: 1, borderColor: border }}>
          <View className="flex-1 items-center py-3.5" style={{ borderRightWidth: 1, borderRightColor: statBorder }}>
            <Text className="text-[22px] font-sans-bold" style={{ color: '#FFDF00' }}>{totalPresent}</Text>
            <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px] mt-0.5" style={{ color: textSecondary }}>Present</Text>
          </View>
          <View className="flex-1 items-center py-3.5" style={{ borderRightWidth: 1, borderRightColor: statBorder }}>
            <Text className="text-[22px] font-sans-bold" style={{ color: isDark ? '#FFDF00' : '#7B1113' }}>{totalLate}</Text>
            <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px] mt-0.5" style={{ color: textSecondary }}>Late</Text>
          </View>
          <View className="flex-1 items-center py-3.5">
            <Text className="text-[22px] font-sans-bold" style={{ color: isDark ? '#EF4444' : '#4A0A0B' }}>{totalAbsent}</Text>
            <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px] mt-0.5" style={{ color: textSecondary }}>Absent</Text>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center gap-2 px-3 mb-2" style={{ backgroundColor: surface, borderWidth: 1, borderColor: borderInput }}>
          <MaterialIcons name="search" size={18} color="#888" />
          <TextInput
            className="flex-1 h-10 text-sm"
            style={{ color: textPrimary }}
            value={search}
            onChangeText={setSearch}
            placeholder="Search students..."
            placeholderTextColor="#888"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={18} color="#888" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Student count */}
        <Text className="text-[11px] font-sans-medium uppercase tracking-[0.5px] mb-2" style={{ color: textSecondary }}>
          {filtered.length} student{filtered.length !== 1 ? 's' : ''}
          {search ? ` matching "${search}"` : ''}
        </Text>

        {/* Student List */}
        {paged.map((student) => {
          const total = student.attendance.present + student.attendance.late + student.attendance.absent
          return (
            <Pressable
              key={student.id}
              onPress={() => router.push({ pathname: '/(faculty)/student/[id]', params: { id: student.id, sectionId: id } })}
              className="active:opacity-70"
            >
              <View className="flex-row justify-between p-3.5 mb-2 border" style={{ backgroundColor: surface, borderColor: border }}>
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="w-10 h-10 items-center justify-center" style={{ backgroundColor: isDark ? '#FFDF00' : '#7B1113' }}>
                    <Text className="text-xs font-sans-semibold" style={{ color: isDark ? '#4A0A0B' : '#FFF' }}>
                      {student.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-sans-semibold" style={{ color: textPrimary }}>{student.fullName}</Text>
                    <Text className="text-[11px] mt-0.5" style={{ color: textSecondary }}>{student.studentId}</Text>
                    <Text className="text-[10px] mt-0.5" style={{ color: textTertiary }}>{student.program}</Text>
                  </View>
                </View>
                <View className="items-end gap-1.5 ml-3">
                  <View className="flex-row gap-1">
                    <View className="items-center px-1.5 py-0.5 min-w-[28px]" style={{ backgroundColor: pillPresentBg }}>
                      <Text className="text-sm font-sans-bold" style={{ color: '#FFDF00' }}>{student.attendance.present}</Text>
                      <Text className="text-[8px] font-sans-medium uppercase" style={{ color: textSecondary }}>P</Text>
                    </View>
                    <View className="items-center px-1.5 py-0.5 min-w-[28px]" style={{ backgroundColor: pillLateBg }}>
                      <Text className="text-sm font-sans-bold" style={{ color: isDark ? '#FFDF00' : '#7B1113' }}>{student.attendance.late}</Text>
                      <Text className="text-[8px] font-sans-medium uppercase" style={{ color: textSecondary }}>L</Text>
                    </View>
                    <View className="items-center px-1.5 py-0.5 min-w-[28px]" style={{ backgroundColor: pillAbsentBg }}>
                      <Text className="text-sm font-sans-bold" style={{ color: isDark ? '#EF4444' : '#4A0A0B' }}>{student.attendance.absent}</Text>
                      <Text className="text-[8px] font-sans-medium uppercase" style={{ color: textSecondary }}>A</Text>
                    </View>
                  </View>
                  {total > 0 && (
                    <View className="flex-row items-center gap-1.5 w-[120px]">
                      <View className="flex-1 h-1 rounded" style={{ backgroundColor: isDark ? '#333' : '#EEE' }}>
                        <View style={{ width: `${(student.attendance.present / total) * 100}%`, height: 4, backgroundColor: '#FFDF00', borderRadius: 2 }} />
                      </View>
                      <Text className="text-[10px] font-sans-medium min-w-[30px] text-right" style={{ color: textSecondary }}>
                        {Math.round((student.attendance.present / total) * 100)}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          )
        })}

        {filtered.length === 0 && (
          <Text className="text-center py-10" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#BBB' }}>No students found.</Text>
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <View className="flex-row justify-center items-center gap-3 mt-4 mb-10">
            <TouchableOpacity
              className="px-4 py-2 border"
              style={{ borderColor: page === 0 ? (isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E0') : (isDark ? '#FFDF00' : '#7B1113'), opacity: page === 0 ? 0.4 : 1, backgroundColor: page === 0 ? 'transparent' : (isDark ? '#FFDF00' : '#7B1113') }}
              onPress={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              accessibilityLabel="Previous page"
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: page === 0 ? '#999' : (isDark ? '#4A0A0B' : '#FFFFFF') }}>← Prev</Text>
            </TouchableOpacity>

            <View className="flex-row items-center px-4 py-2" style={{ borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E0' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#FFFFFF' : '#333' }}>
                Page {page + 1} of {pageCount}
              </Text>
            </View>

            <TouchableOpacity
              className="px-4 py-2 border"
              style={{ borderColor: page === pageCount - 1 ? (isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E0') : (isDark ? '#FFDF00' : '#7B1113'), opacity: page === pageCount - 1 ? 0.4 : 1, backgroundColor: page === pageCount - 1 ? 'transparent' : (isDark ? '#FFDF00' : '#7B1113') }}
              onPress={() => setPage(Math.min(pageCount - 1, page + 1))}
              disabled={page === pageCount - 1}
              accessibilityLabel="Next page"
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: page === pageCount - 1 ? '#999' : (isDark ? '#4A0A0B' : '#FFFFFF') }}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
