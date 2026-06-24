import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { api } from '../../services/mock-api'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import { getWeekDays, formatTime, getMonthName, getDayName } from '@polycheck/shared/utils'
import type { User, Section, ScheduleDay } from '@polycheck/shared'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const WEEK_COL_WIDTH = 140

export default function StudentScheduleScreen() {
  const { isDark } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedSection, setSelectedSection] = useState<{ section: Section; schedule: ScheduleDay; parentName: string; parentCode: string } | null>(null)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'student') return
    setUser(cu)
  }, [])

  const student = user && 'studentId' in user
    ? (user as typeof user & { studentId: string; program: string; yearLevel: number })
    : null

  const mySections: Section[] = student ? api.getStudentSections(student.id) : []

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate])

  const dayEventsMap = useMemo(() => {
    const map = new Map<string, { section: Section; schedule: ScheduleDay }[]>()
    for (const section of mySections) {
      for (const sched of section.schedule) {
        const events = map.get(sched.day) || []
        events.push({ section, schedule: sched })
        map.set(sched.day, events)
      }
    }
    return map
  }, [mySections])

  const goToPrev = useCallback(() => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 7)
    setCurrentDate(d)
  }, [currentDate])

  const goToNext = useCallback(() => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 7)
    setCurrentDate(d)
  }, [currentDate])

  const goToToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  if (!student) return null

  const displayedWeekRange = (() => {
    if (weekDays.length < 7) return ''
    const start = new Date(weekDays[0].date + 'T00:00:00')
    const end = new Date(weekDays[6].date + 'T00:00:00')
    return `${getMonthName(start.getMonth()).slice(0, 3)} ${start.getDate()} - ${getMonthName(end.getMonth()).slice(0, 3)} ${end.getDate()}`
  })()

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.heading, isDark && styles.textGolden]}>Schedule</Text>
      </View>

      <View style={[styles.navBar, isDark && styles.navBarDark]}>
        <TouchableOpacity onPress={goToPrev} style={styles.navBtn} accessibilityLabel="Previous week">
          <MaterialIcons name="chevron-left" size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday} style={styles.todayBtn}>
          <Text style={[styles.todayText, isDark && styles.textGolden]}>Today</Text>
        </TouchableOpacity>
        <Text style={[styles.dateLabel, isDark && styles.textWhite]}>{displayedWeekRange}</Text>
        <TouchableOpacity onPress={goToNext} style={styles.navBtn} accessibilityLabel="Next week">
          <MaterialIcons name="chevron-right" size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
        </TouchableOpacity>
      </View>

      {mySections.length === 0 ? (
        <View style={[styles.emptyContainer, isDark && styles.cardDark]}>
          <MaterialIcons name="calendar-today" size={48} color={isDark ? 'rgba(245,168,0,0.3)' : '#CCC'} />
          <Text style={[styles.emptyText, isDark && styles.textWhite50]}>No enrolled subjects</Text>
          <Text style={[styles.emptyHint, isDark && styles.textWhite50]}>
            Enroll in a subject to see your schedule.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekContainer}>
          {weekDays.map((wd) => {
            const events = (dayEventsMap.get(wd.day) || []).sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime))
            const isToday = wd.isToday
            return (
              <View key={wd.date} style={[styles.weekCol, isDark && styles.weekColDark, isToday && styles.weekColToday]}>
                <View style={[styles.weekColHeader, isDark && styles.weekColHeaderDark, isToday && styles.weekColHeaderToday]}>
                  <Text style={[styles.weekColDayName, isDark && styles.textWhite50]}>{wd.day}</Text>
                  <Text style={[styles.weekColDayNum, isToday && styles.weekColDayNumToday, isDark && !isToday && styles.textWhite]}>
                    {new Date(wd.date + 'T00:00:00').getDate()}
                  </Text>
                </View>
                <View style={styles.weekColBody}>
                  {events.length === 0 ? (
                    <Text style={[styles.weekEmpty, isDark && styles.textWhite50]}>No classes</Text>
                  ) : (
                    events.map((ev, ei) => {
                      const parent = api.getSubject(ev.section.subjectId)
                      return (
                        <TouchableOpacity
                          key={`${ev.section.id}-${ev.schedule.day}-${ei}`}
                          style={[styles.classCard, isDark && styles.classCardDark]}
                          onPress={() => setSelectedSection({ ...ev, parentName: parent?.name ?? '', parentCode: parent?.code ?? '' })}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.classDot, { backgroundColor: isToday ? '#7B1113' : '#FFDF00' }]} />
                          <Text style={[styles.classTime, isDark && styles.textGolden]} numberOfLines={1}>
                            {formatTime(ev.schedule.startTime)}
                          </Text>
                          <Text style={[styles.className, isDark && styles.textWhite]} numberOfLines={2}>
                            {parent?.name ?? ''}
                          </Text>
                          <Text style={[styles.classRoom, isDark && styles.textWhite50]} numberOfLines={1}>
                            {ev.schedule.room || ev.section.room}
                          </Text>
                          <Text style={[styles.classSection, isDark && styles.textWhite50]} numberOfLines={1}>
                            Sec {ev.section.section}
                          </Text>
                        </TouchableOpacity>
                      )
                    })
                  )}
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}

      <Modal visible={!!selectedSection} transparent animationType="fade" onRequestClose={() => setSelectedSection(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSelectedSection(null)}>
          {selectedSection && (
            <View style={[styles.sheet, isDark && styles.sheetDark]} onStartShouldSetResponder={() => true}>
              <View style={[styles.sheetHandle, isDark && styles.sheetHandleDark]} />
              <View style={[styles.typeBadge, { backgroundColor: '#7B1113' }]}>
                <Text style={styles.typeBadgeText}>CLASS</Text>
              </View>
              <Text style={[styles.sheetTitle, isDark && styles.textWhite]}>{selectedSection.parentName}</Text>

              <View style={[styles.sheetDetail, isDark && styles.sheetDetailDark]}>
                <View style={styles.sheetRow}>
                  <MaterialIcons name="class" size={18} color="#FFDF00" />
                  <Text style={[styles.sheetRowLabel, isDark && styles.textWhite50]}>Code</Text>
                  <Text style={[styles.sheetRowValue, isDark && styles.textWhite]}>{selectedSection.parentCode}</Text>
                </View>
                <View style={styles.sheetRow}>
                  <MaterialIcons name="groups" size={18} color="#FFDF00" />
                  <Text style={[styles.sheetRowLabel, isDark && styles.textWhite50]}>Section</Text>
                  <Text style={[styles.sheetRowValue, isDark && styles.textWhite]}>Sec {selectedSection.section.section}</Text>
                </View>
                <View style={styles.sheetRow}>
                  <MaterialIcons name="person" size={18} color="#FFDF00" />
                  <Text style={[styles.sheetRowLabel, isDark && styles.textWhite50]}>Instructor</Text>
                  <Text style={[styles.sheetRowValue, isDark && styles.textWhite]}>{selectedSection.section.teacherName}</Text>
                </View>
                <View style={styles.sheetRow}>
                  <MaterialIcons name="room" size={18} color="#FFDF00" />
                  <Text style={[styles.sheetRowLabel, isDark && styles.textWhite50]}>Room</Text>
                  <Text style={[styles.sheetRowValue, isDark && styles.textWhite]}>
                    {selectedSection.schedule.room || selectedSection.section.room}
                  </Text>
                </View>
                <View style={styles.sheetRow}>
                  <MaterialIcons name="access-time" size={18} color="#FFDF00" />
                  <Text style={[styles.sheetRowLabel, isDark && styles.textWhite50]}>Time</Text>
                  <Text style={[styles.sheetRowValue, isDark && styles.textWhite]}>
                    {formatTime(selectedSection.schedule.startTime)} — {formatTime(selectedSection.schedule.endTime)}
                  </Text>
                </View>
                <View style={styles.sheetRow}>
                  <MaterialIcons name="calendar-today" size={18} color="#FFDF00" />
                  <Text style={[styles.sheetRowLabel, isDark && styles.textWhite50]}>Day</Text>
                  <Text style={[styles.sheetRowValue, isDark && styles.textWhite]}>{selectedSection.schedule.day}</Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.closeBtn, isDark && styles.closeBtnDark]} onPress={() => setSelectedSection(null)}>
                <Text style={[styles.closeBtnText, isDark && styles.closeBtnTextDark]}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0C' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFF', borderBottomWidth: 2, borderBottomColor: '#D4D4D8' },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  heading: { fontSize: 20, fontWeight: '700', fontFamily: fonts.heading, color: '#7B1113' },
  textWhite: { color: '#FFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#FFDF00' },

  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  navBarDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  navBtn: { padding: 8 },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#7B1113' },
  todayText: { fontSize: 12, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#7B1113', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateLabel: { fontSize: 14, fontWeight: '700', fontFamily: fonts.bodySemiBold, color: '#333', flex: 1, textAlign: 'center' },

  emptyContainer: { margin: 20, padding: 48, alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', borderStyle: 'dashed' },
  cardDark: { backgroundColor: '#121215', borderColor: 'rgba(245,168,0,0.15)' },
  emptyText: { fontSize: 16, fontFamily: fonts.bodyBold, color: '#AAA' },
  emptyHint: { fontSize: 12, fontFamily: fonts.body, color: '#BBB', textAlign: 'center' },

  weekContainer: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 120 },
  weekCol: { width: WEEK_COL_WIDTH, marginRight: 8, backgroundColor: '#FFF' },
  weekColDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245,168,0,0.15)' },
  weekColToday: { borderWidth: 2, borderColor: '#7B1113' },
  weekColHeader: { alignItems: 'center', paddingVertical: 10, backgroundColor: '#F9F9F9', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  weekColHeaderDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  weekColHeaderToday: { backgroundColor: 'rgba(123,17,19,0.08)' },
  weekColDayName: { fontSize: 11, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  weekColDayNum: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#333', marginTop: 2 },
  weekColDayNumToday: { color: '#7B1113' },
  weekColBody: { padding: 8, gap: 8, minHeight: 200 },
  weekEmpty: { fontSize: 10, fontFamily: fonts.body, color: '#AAA', textAlign: 'center', marginTop: 20, textTransform: 'uppercase', letterSpacing: 0.5 },

  classCard: { backgroundColor: '#F9F9F9', padding: 8, borderLeftWidth: 3, borderLeftColor: '#FFDF00' },
  classCardDark: { backgroundColor: '#0A0A0C' },
  classDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 4 },
  classTime: { fontSize: 10, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#7B1113', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  className: { fontSize: 12, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333', marginBottom: 2 },
  classRoom: { fontSize: 10, fontFamily: fonts.body, color: '#888', marginBottom: 1 },
  classSection: { fontSize: 9, fontFamily: fonts.body, color: '#AAA', textTransform: 'uppercase', letterSpacing: 0.3 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', padding: 24, paddingBottom: 40 },
  sheetDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245,168,0,0.15)' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16 },
  sheetHandleDark: { backgroundColor: '#444' },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, marginBottom: 12 },
  typeBadgeText: { fontSize: 10, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#FFF', textTransform: 'uppercase', letterSpacing: 0.5 },
  sheetTitle: { fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A', marginBottom: 20 },
  sheetDetail: { backgroundColor: '#F9F9F9', padding: 16, marginBottom: 20, gap: 12 },
  sheetDetailDark: { backgroundColor: '#0A0A0C' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetRowLabel: { fontSize: 11, fontFamily: fonts.bodyBold, color: '#888', width: 65, textTransform: 'uppercase', letterSpacing: 0.3 },
  sheetRowValue: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#333', flex: 1 },
  closeBtn: { alignItems: 'center', paddingVertical: 10 },
  closeBtnDark: {},
  closeBtnText: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  closeBtnTextDark: { color: 'rgba(255,255,255,0.5)' },
})
