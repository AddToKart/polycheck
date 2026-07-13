import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/mock-api'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import { getWeekDays, formatTime, getMonthName, getDayName, formatDate, generateStudentCalendarEvents, getMonthDays, getDateRangeForMonth } from '@polycheck/shared/utils'
import type { User, Subject, Section, CalendarEvent, AttendanceRecord, Session } from '@polycheck/shared'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const WEEK_COL_WIDTH = 140
const DAY_CELL_SIZE = Math.floor((SCREEN_WIDTH - 40) / 7)

const STATUS_BORDER: Record<string, string> = {
  present: '#22C55E',
  late: '#FFDF00',
  absent: '#EF4444',
  pending: '#7B1113',
  disputed: '#7B1113',
}

const STATUS_LABEL: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  pending: 'Pending',
  disputed: 'Disputed',
}

export default function StudentScheduleScreen() {
  const { isDark } = useTheme()
  const now = new Date()
  const todayStr = formatDate(now)
  const [user, setUser] = useState<User | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [subjects, setSubjects] = useState<Record<string, Subject>>({})
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'student') { router.replace('/'); return }
    setUser(cu)
    setSelectedDay(formatDate(new Date()))
    void Promise.all([api.getMyAttendance(cu.id), api.getStudentSections(cu.id), api.getSessions(), api.getSubjects()]).then(([nextRecords, nextSections, nextSessions, subjectList]) => {
      setRecords(nextRecords)
      setSections(nextSections)
      setSessions(nextSessions)
      setSubjects(Object.fromEntries(subjectList.map((subject) => [subject.id, subject])))
    })
  }, [])

  const student = user && 'studentId' in user
    ? (user as typeof user & { studentId: string; program: string; yearLevel: number })
    : null

  const mySections = student ? sections : []
  const allSessions = sessions

  const monthDays = useMemo(() => {
    if (viewMode !== 'month') return []
    return getMonthDays(currentDate.getFullYear(), currentDate.getMonth())
  }, [currentDate, viewMode])

  const weekDays = useMemo(() => {
    return getWeekDays(currentDate)
  }, [currentDate])

  const events = useMemo(() => {
    if (!student || mySections.length === 0) return []
    let start: string, end: string
    if (viewMode === 'month') {
      const range = getDateRangeForMonth(currentDate.getFullYear(), currentDate.getMonth())
      start = range.start
      end = range.end
    } else {
      start = weekDays[0].date
      end = weekDays[6].date
    }
    return generateStudentCalendarEvents(
      mySections,
      allSessions,
      records,
      (id) => {
        const subj = subjects[id]
        return subj ? { name: subj.name, code: subj.code } : undefined
      },
      start,
      end,
    )
  }, [mySections, allSessions, records, subjects, weekDays, student, viewMode, currentDate])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const list = map.get(ev.date) || []
      list.push(ev)
      map.set(ev.date, list)
    }
    return map
  }, [events])

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return []
    return eventsByDate.get(selectedDay) || []
  }, [selectedDay, eventsByDate])

  const goToPrev = useCallback(() => {
    setSelectedDay(null)
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    } else {
      const d = new Date(currentDate)
      d.setDate(d.getDate() - 7)
      setCurrentDate(d)
    }
  }, [viewMode, currentDate])

  const goToNext = useCallback(() => {
    setSelectedDay(null)
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    } else {
      const d = new Date(currentDate)
      d.setDate(d.getDate() + 7)
      setCurrentDate(d)
    }
  }, [viewMode, currentDate])

  const goToToday = useCallback(() => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDay(formatDate(today))
  }, [])

  if (!student) return null

  const displayedRange = (() => {
    if (viewMode === 'month') {
      return `${getMonthName(currentDate.getMonth())} ${currentDate.getFullYear()}`
    }
    if (weekDays.length < 7) return ''
    const start = new Date(weekDays[0].date + 'T00:00:00')
    const end = new Date(weekDays[6].date + 'T00:00:00')
    return `${getMonthName(start.getMonth()).slice(0, 3)} ${start.getDate()} - ${getMonthName(end.getMonth()).slice(0, 3)} ${end.getDate()}`
  })()

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.heading, isDark && styles.textGolden]}>Schedule</Text>
        <View style={[styles.toggleRow, isDark && styles.toggleRowDark]}>
          <TouchableOpacity
            style={[styles.toggleBtn, isDark && styles.toggleBtnDark, viewMode === 'month' && styles.toggleActive, isDark && viewMode === 'month' && styles.toggleActiveDark]}
            onPress={() => setViewMode('month')}
          >
            <Text style={[
              styles.toggleText,
              isDark && styles.toggleTextDark,
              viewMode === 'month' && styles.toggleTextActive,
              isDark && viewMode === 'month' && styles.toggleTextActiveDark
            ]}>Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, isDark && styles.toggleBtnDark, viewMode === 'week' && styles.toggleActive, isDark && viewMode === 'week' && styles.toggleActiveDark]}
            onPress={() => setViewMode('week')}
          >
            <Text style={[
              styles.toggleText,
              isDark && styles.toggleTextDark,
              viewMode === 'week' && styles.toggleTextActive,
              isDark && viewMode === 'week' && styles.toggleTextActiveDark
            ]}>Week</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.navBar, isDark && styles.navBarDark]}>
        <TouchableOpacity onPress={goToPrev} style={styles.navBtn} accessibilityLabel="Previous">
          <MaterialIcons name="chevron-left" size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday} style={[styles.todayBtn, isDark && styles.todayBtnDark]}>
          <Text style={[styles.todayText, isDark && styles.textGolden]}>Today</Text>
        </TouchableOpacity>
        <Text style={[styles.dateLabel, isDark && styles.textWhite]}>{displayedRange}</Text>
        <TouchableOpacity onPress={goToNext} style={styles.navBtn} accessibilityLabel="Next">
          <MaterialIcons name="chevron-right" size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
        </TouchableOpacity>
      </View>

      <View style={[styles.legendRow, isDark && styles.legendRowDark]}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { borderWidth: 1, borderColor: '#CCC', backgroundColor: 'transparent' }]} /><Text style={[styles.legendText, isDark && styles.textWhite50]}>No session</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#D4D4D8', borderWidth: 1, borderColor: '#CCC', borderStyle: 'dashed' }]} /><Text style={[styles.legendText, isDark && styles.textWhite50]}>Moved</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} /><Text style={[styles.legendText, isDark && styles.textWhite50]}>Present</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#FFDF00' }]} /><Text style={[styles.legendText, isDark && styles.textWhite50]}>Late</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} /><Text style={[styles.legendText, isDark && styles.textWhite50]}>Absent</Text></View>
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
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {viewMode === 'month' ? (
            <View style={[styles.calendarCard, isDark && styles.cardDark]}>
              <View style={[styles.weekdayRow, isDark && styles.weekdayRowDark]}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <View key={d} style={styles.weekdayCell}>
                    <Text style={[styles.weekdayLabel, isDark && styles.textWhite50]}>{d}</Text>
                  </View>
                ))}
              </View>
              {monthDays.map((week, wi) => (
                <View key={wi} style={styles.weekRow}>
                  {week.map((day, di) => {
                    if (!day) return <View key={`e-${di}`} style={[styles.dayCell, isDark && styles.dayCellDark]} />
                    const dateStr = formatDate(day)
                    const dayEvents = eventsByDate.get(dateStr) || []
                    const isToday = dateStr === todayStr
                    const isSel = dateStr === selectedDay
                    const isCM = day.getMonth() === currentDate.getMonth()
                    return (
                      <TouchableOpacity
                        key={dateStr}
                        style={[
                          styles.dayCell,
                          isDark && styles.dayCellDark,
                          isSel && styles.dayCellSel,
                          isDark && isSel && styles.dayCellSelDark
                        ]}
                        onPress={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
                        activeOpacity={0.6}
                      >
                        <View style={[styles.dayNumWrap, isToday && styles.dayNumToday, isDark && isToday && styles.dayNumTodayDark]}>
                          <Text style={[
                            styles.dayNum,
                            isToday && styles.dayNumTodayText,
                            !isCM && styles.dayNumOther,
                            isDark && !isCM && styles.dayNumOtherDark,
                            isDark && isCM && !isToday && styles.textWhite,
                          ]}>
                            {day.getDate()}
                          </Text>
                        </View>
                        {dayEvents.length > 0 && (
                          <View style={styles.dotRow}>
                            {dayEvents.slice(0, 3).map((ev, ei) => (
                              <View
                                key={ei}
                                style={[
                                  styles.eventDot,
                                  { backgroundColor: ev.status === 'moved' ? '#D4D4D8' : ev.type === 'schedule' ? '#CCCCCC' : (ev.studentStatus === 'present' ? '#22C55E' : ev.studentStatus === 'late' ? '#FFDF00' : ev.studentStatus === 'absent' ? '#EF4444' : '#7B1113') },
                                ]}
                              />
                            ))}
                            {dayEvents.length > 3 && (
                              <Text style={[styles.moreDots, isDark && styles.textWhite50]}>+{dayEvents.length - 3}</Text>
                            )}
                          </View>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekContainer}>
              {weekDays.map((wd) => {
                const dayEvs = (eventsByDate.get(wd.date) || []).sort((a, b) => a.startTime.localeCompare(b.startTime))
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
                      {dayEvs.length === 0 ? (
                        <Text style={[styles.weekEmpty, isDark && styles.textWhite50]}>No classes</Text>
                      ) : (
                        dayEvs.map((ev) => {
                          const isGhost = ev.type === 'schedule'
                          const isMoved = ev.status === 'moved'
                          const borderColor = isMoved ? '#D4D4D8' : isGhost ? '#CCC' : (ev.studentStatus ? STATUS_BORDER[ev.studentStatus] : '#7B1113')
                          
                          const formatRescheduledTo = (to: typeof ev.rescheduledTo) => {
                            if (!to) return ''
                            const dateObj = new Date(to.date + 'T00:00:00')
                            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
                            return `${dayName} ${formatTime(to.startTime)}`
                          }

                          return (
                            <TouchableOpacity
                              key={ev.id}
                              style={[
                                styles.classCard,
                                isDark && styles.classCardDark,
                                { borderLeftColor: borderColor },
                                isGhost && styles.ghostCard,
                                isMoved && styles.movedCard
                              ]}
                              onPress={() => (ev.type === 'session' || ev.status === 'moved') && setSelectedEvent(ev)}
                              activeOpacity={isGhost && !isMoved ? 1 : 0.7}
                            >
                              <View style={[styles.classDot, { backgroundColor: borderColor }]} />
                              <Text style={[styles.classTime, isDark && styles.textGolden, isGhost && styles.ghostText, isMoved && styles.movedText]} numberOfLines={1}>
                                {formatTime(ev.startTime)}
                              </Text>
                              <Text style={[styles.className, isDark && styles.textWhite, isGhost && styles.ghostText, isMoved && styles.movedText]} numberOfLines={2}>
                                {isMoved 
                                  ? `${ev.subjectCode || 'Class'} (MOVED)`
                                  : isGhost 
                                    ? 'No session yet' 
                                    : ev.subjectCode || ev.subjectName}
                              </Text>
                              {isMoved && ev.rescheduledTo && (
                                <Text style={{ fontSize: 9, color: isDark ? '#FFDF00' : '#7B1113', fontWeight: 'bold', marginTop: 2, marginBottom: 2 }}>
                                  MOVED to {formatRescheduledTo(ev.rescheduledTo)}
                                </Text>
                              )}
                              <Text style={[styles.classRoom, isDark && styles.textWhite50, isGhost && styles.ghostText, isMoved && styles.movedText]} numberOfLines={1}>
                                {ev.room}
                              </Text>
                              <Text style={[styles.classSection, isDark && styles.textWhite50, isGhost && styles.ghostText, isMoved && styles.movedText]} numberOfLines={1}>
                                Sec {ev.sectionName}
                              </Text>
                              {!isGhost && ev.studentStatus && (
                                <Text style={[
                                  styles.statusLabel,
                                  { color: STATUS_BORDER[ev.studentStatus] || '#888' },
                                ]}>
                                  {STATUS_LABEL[ev.studentStatus] || ''}
                                </Text>
                              )}
                              {!isGhost && ev.isRescheduled && (
                                <View style={{ alignSelf: 'flex-start', backgroundColor: '#FFDF00', paddingHorizontal: 4, paddingVertical: 1, marginTop: 4 }}>
                                  <Text style={{ fontSize: 8, color: '#4A0A0B', fontWeight: '800' }}>TIME MOVED</Text>
                                </View>
                              )}
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

          {viewMode === 'month' && selectedDay && (
            <View style={styles.dayEvSection}>
              <Text style={[styles.dayEvTitle, isDark && styles.textGolden]}>
                {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
              {selectedDayEvents.length === 0 ? (
                <View style={[styles.emptyCard, isDark && styles.cardDark]}>
                  <MaterialIcons name="event-busy" size={32} color={isDark ? 'rgba(245,168,0,0.3)' : '#CCC'} />
                  <Text style={[styles.emptyText, isDark && styles.textWhite50]}>No classes this day</Text>
                </View>
              ) : (
                selectedDayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime)).map((ev) => {
                  const isGhost = ev.type === 'schedule'
                  const isMoved = ev.status === 'moved'
                  const borderColor = isMoved ? '#D4D4D8' : isGhost ? '#CCC' : (ev.studentStatus ? STATUS_BORDER[ev.studentStatus] : '#7B1113')

                  const formatRescheduledTo = (to: typeof ev.rescheduledTo) => {
                    if (!to) return ''
                    const dateObj = new Date(to.date + 'T00:00:00')
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
                    return `${dayName} ${formatTime(to.startTime)}`
                  }

                  return (
                    <TouchableOpacity
                      key={ev.id}
                      style={[styles.dayEvCard, isDark && styles.cardDark, isMoved && styles.movedCard]}
                      onPress={() => (ev.type === 'session' || ev.status === 'moved') && setSelectedEvent(ev)}
                      activeOpacity={isGhost && !isMoved ? 1 : 0.7}
                    >
                      <View style={[styles.dayEvTime, isDark && styles.dayEvTimeDark]}>
                        <Text style={[styles.dayEvTimeText, isDark && styles.textGolden, isMoved && styles.movedText]}>{formatTime(ev.startTime)}</Text>
                        <Text style={[styles.dayEvTimeSep, isDark && styles.textWhite50]}>—</Text>
                        <Text style={[styles.dayEvTimeText, isDark && styles.textGolden, isMoved && styles.movedText]}>{formatTime(ev.endTime)}</Text>
                      </View>
                      <View style={[styles.timeDivider, isDark && styles.timeDividerDark]} />
                      <View style={styles.dayEvBody}>
                        <Text style={[styles.dayEvName, isDark && styles.textWhite, isMoved && styles.movedText]}>
                          {isMoved ? `${ev.subjectCode || 'Class'} (MOVED)` : isGhost ? 'No session yet' : ev.subjectName}
                        </Text>
                        <Text style={[styles.dayEvMeta, isDark && styles.textWhite50, isMoved && styles.movedText]}>
                          Sec {ev.sectionName}{ev.room ? ` · ${ev.room}` : ''}
                        </Text>
                        {isMoved && ev.rescheduledTo && (
                          <Text style={{ fontSize: 9, color: isDark ? '#FFDF00' : '#7B1113', fontWeight: 'bold', marginTop: 2 }}>
                            Moved to: {ev.rescheduledTo.date} {formatTime(ev.rescheduledTo.startTime)}
                          </Text>
                        )}
                        {!isGhost && ev.studentStatus && (
                          <View style={styles.dayEvStatusRow}>
                            <View style={[styles.miniDot, { backgroundColor: STATUS_BORDER[ev.studentStatus] }]} />
                            <Text style={[styles.dayEvStatus, { color: STATUS_BORDER[ev.studentStatus] }]}>{STATUS_LABEL[ev.studentStatus]}</Text>
                          </View>
                        )}
                        {!isGhost && ev.isRescheduled && (
                          <View style={{ alignSelf: 'flex-start', backgroundColor: '#FFDF00', paddingHorizontal: 4, paddingVertical: 1, marginTop: 4 }}>
                            <Text style={{ fontSize: 8, color: '#4A0A0B', fontWeight: '800' }}>TIME MOVED</Text>
                          </View>
                        )}
                      </View>
                      {(ev.type === 'session' || ev.status === 'moved') && (
                        <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.3)' : '#CCC'} />
                      )}
                    </TouchableOpacity>
                  )
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={!!selectedEvent} transparent animationType="fade" onRequestClose={() => setSelectedEvent(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSelectedEvent(null)}>
          {selectedEvent && (
            <View style={[styles.sheet, isDark && styles.sheetDark]} onStartShouldSetResponder={() => true}>
              <View style={[styles.sheetHandle, isDark && styles.sheetHandleDark]} />
              {selectedEvent.status === 'moved' ? (
                <View style={[styles.typeBadge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.typeBadgeText}>MOVED</Text>
                </View>
              ) : (
                <View style={[styles.typeBadge, { backgroundColor: selectedEvent.studentStatus === 'present' ? '#22C55E' : selectedEvent.studentStatus === 'late' ? '#FFDF00' : selectedEvent.studentStatus === 'absent' ? '#EF4444' : '#7B1113' }]}>
                  <Text style={[styles.typeBadgeText, selectedEvent.studentStatus === 'late' && { color: '#4A0A0B' }]}>
                    {selectedEvent.studentStatus ? STATUS_LABEL[selectedEvent.studentStatus]?.toUpperCase() : 'PENDING'}
                  </Text>
                </View>
              )}
              <Text style={[styles.sheetTitle, isDark && styles.textWhite]}>
                {selectedEvent.status === 'moved' 
                  ? `${selectedEvent.sectionName || 'Class'} (MOVED)`
                  : selectedEvent.subjectName}
              </Text>
              
              {selectedEvent.status === 'moved' && selectedEvent.rescheduledTo && (
                <View style={{ padding: 12, backgroundColor: isDark ? '#1C1C21' : '#FFF9E6', borderLeftWidth: 3, borderLeftColor: '#FFDF00', marginBottom: 16 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#FFDF00' : '#4A0A0B', textTransform: 'uppercase', marginBottom: 4 }}>
                    Class Slot Rescheduled
                  </Text>
                  <Text style={{ fontSize: 12, color: isDark ? '#FFF' : '#333' }}>
                    This class slot has been moved to:
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#FFDF00' : '#7B1113', marginTop: 4 }}>
                    {new Date(selectedEvent.rescheduledTo.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#FFDF00' : '#7B1113' }}>
                    {formatTime(selectedEvent.rescheduledTo.startTime)} — {formatTime(selectedEvent.rescheduledTo.endTime)}
                  </Text>
                  {selectedEvent.rescheduledTo.room && (
                    <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.6)' : '#666', marginTop: 2 }}>
                      Room: {selectedEvent.rescheduledTo.room}
                    </Text>
                  )}
                </View>
              )}

              {selectedEvent.isRescheduled && (
                <View style={{ padding: 12, backgroundColor: isDark ? '#1C1C21' : '#FFF9E6', borderLeftWidth: 3, borderLeftColor: '#FFDF00', marginBottom: 16 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#FFDF00' : '#4A0A0B', textTransform: 'uppercase', marginBottom: 2 }}>
                    Rescheduled Session
                  </Text>
                  <Text style={{ fontSize: 12, color: isDark ? '#FFF' : '#333' }}>
                    This is a rescheduled make-up class meeting.
                  </Text>
                </View>
              )}

              <View style={[styles.sheetDetail, isDark && styles.sheetDetailDark]}>
                <View style={styles.sheetRow}>
                  <MaterialIcons name="class" size={18} color="#FFDF00" />
                  <Text style={[styles.sheetRowLabel, isDark && styles.textWhite50]}>Section</Text>
                  <Text style={[styles.sheetRowValue, isDark && styles.textWhite]}>Sec {selectedEvent.sectionName}</Text>
                </View>
                {selectedEvent.room && (
                  <View style={styles.sheetRow}>
                    <MaterialIcons name="room" size={18} color="#FFDF00" />
                    <Text style={[styles.sheetRowLabel, isDark && styles.textWhite50]}>Room</Text>
                    <Text style={[styles.sheetRowValue, isDark && styles.textWhite]}>{selectedEvent.room}</Text>
                  </View>
                )}
                <View style={styles.sheetRow}>
                  <MaterialIcons name="access-time" size={18} color="#FFDF00" />
                  <Text style={[styles.sheetRowLabel, isDark && styles.textWhite50]}>Time</Text>
                  <Text style={[styles.sheetRowValue, isDark && styles.textWhite]}>
                    {formatTime(selectedEvent.startTime)} — {formatTime(selectedEvent.endTime)}
                  </Text>
                </View>
                <View style={styles.sheetRow}>
                  <MaterialIcons name="today" size={18} color="#FFDF00" />
                  <Text style={[styles.sheetRowLabel, isDark && styles.textWhite50]}>Date</Text>
                  <Text style={[styles.sheetRowValue, isDark && styles.textWhite]}>
                    {new Date(selectedEvent.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.viewSessionBtn}
                onPress={() => {
                  setSelectedEvent(null)
                  router.push(`/(tabs)/subject-info/${selectedEvent.sectionId}`)
                }}
              >
                <MaterialIcons name="visibility" size={18} color="#FFF" />
                <Text style={styles.viewSessionBtnText}>View Subject</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.closeBtn, isDark && styles.closeBtnDark]} onPress={() => setSelectedEvent(null)}>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  heading: { fontSize: 20, fontWeight: '700', fontFamily: fonts.heading, color: '#7B1113' },
  toggleRow: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#7B1113' },
  toggleRowDark: { borderColor: '#FFDF00' },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#FFF' },
  toggleBtnDark: { backgroundColor: '#121215' },
  toggleActive: { backgroundColor: '#7B1113' },
  toggleActiveDark: { backgroundColor: '#FFDF00' },
  toggleText: { fontSize: 12, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#7B1113', textTransform: 'uppercase', letterSpacing: 0.5 },
  toggleTextDark: { color: '#FFDF00' },
  toggleTextActive: { color: '#FFF' },
  toggleTextActiveDark: { color: '#4A0A0B' },
  textWhite: { color: '#FFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#FFDF00' },

  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  navBarDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  navBtn: { padding: 8 },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#7B1113' },
  todayBtnDark: { borderColor: '#FFDF00' },
  todayText: { fontSize: 12, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#7B1113', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateLabel: { fontSize: 14, fontWeight: '700', fontFamily: fonts.bodySemiBold, color: '#333', flex: 1, textAlign: 'center' },

  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingVertical: 8, backgroundColor: '#F9F9F9', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  legendRowDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 9, fontFamily: fonts.bodyBold, color: '#888', textTransform: 'uppercase', letterSpacing: 0.3 },

  emptyContainer: { margin: 20, padding: 48, alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', borderStyle: 'dashed' },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245,168,0,0.15)' },
  emptyText: { fontSize: 16, fontFamily: fonts.bodyBold, color: '#AAA' },
  emptyHint: { fontSize: 12, fontFamily: fonts.body, color: '#BBB', textAlign: 'center' },

  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },

  calendarCard: { backgroundColor: '#FFF', borderRadius: 0, overflow: 'hidden' },
  weekdayRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  weekdayRowDark: { borderBottomColor: 'rgba(255, 255, 255, 0.08)' },
  weekdayCell: { width: DAY_CELL_SIZE, alignItems: 'center', paddingVertical: 8 },
  weekdayLabel: { fontSize: 11, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  weekRow: { flexDirection: 'row' },
  dayCell: { width: DAY_CELL_SIZE, height: 56, alignItems: 'center', paddingTop: 4, borderWidth: 0.5, borderColor: '#F0F0F0' },
  dayCellDark: { borderColor: 'rgba(255, 255, 255, 0.08)' },
  dayCellSel: { backgroundColor: 'rgba(123,17,19,0.08)' },
  dayCellSelDark: { backgroundColor: 'rgba(255,223,0,0.12)' },
  dayNumWrap: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  dayNumToday: { backgroundColor: '#7B1113' },
  dayNumTodayDark: { backgroundColor: '#FFDF00' },
  dayNum: { fontSize: 13, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  dayNumTodayText: { color: '#FFF' },
  dayNumOther: { color: '#CCC' },
  dayNumOtherDark: { color: 'rgba(255,255,255,0.2)' },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 14 },
  eventDot: { width: 5, height: 5, borderRadius: 2.5 },
  moreDots: { fontSize: 8, fontFamily: fonts.body, color: '#AAA' },

  weekContainer: { paddingRight: 8 },
  weekCol: { width: WEEK_COL_WIDTH, marginRight: 8, backgroundColor: '#FFF', borderRadius: 0 },
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
  ghostCard: { opacity: 0.4, borderStyle: 'dashed' as const },
  movedCard: { opacity: 0.6, borderStyle: 'dashed' as const },
  ghostText: { opacity: 0.5 },
  movedText: { textDecorationLine: 'line-through' as const, opacity: 0.6 },
  classDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 4 },
  classTime: { fontSize: 10, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#7B1113', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  className: { fontSize: 12, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333', marginBottom: 2 },
  classRoom: { fontSize: 10, fontFamily: fonts.body, color: '#888', marginBottom: 1 },
  classSection: { fontSize: 9, fontFamily: fonts.body, color: '#AAA', textTransform: 'uppercase', letterSpacing: 0.3 },
  statusLabel: { fontSize: 8, fontWeight: '700', fontFamily: fonts.bodyBold, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  dayEvSection: { marginTop: 20 },
  dayEvTitle: { fontSize: 16, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  emptyCard: { backgroundColor: '#FFF', padding: 32, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#EEE', borderStyle: 'dashed' },
  dayEvCard: { backgroundColor: '#FFF', padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  dayEvTime: { width: 68, alignItems: 'center', justifyContent: 'center', gap: 2, marginRight: 8, paddingVertical: 4, backgroundColor: 'transparent' },
  dayEvTimeDark: { backgroundColor: 'transparent' },
  timeDivider: { width: 1, height: '80%', backgroundColor: '#E4E4E7', marginRight: 12 },
  timeDividerDark: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  dayEvTimeText: { fontSize: 11, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#7B1113' },
  dayEvTimeSep: { fontSize: 8, color: '#CCC' },
  dayEvBody: { flex: 1 },
  dayEvName: { fontSize: 14, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  dayEvMeta: { fontSize: 11, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  dayEvStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  dayEvStatus: { fontSize: 10, fontWeight: '700', fontFamily: fonts.bodyBold, textTransform: 'uppercase', letterSpacing: 0.5 },

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
  viewSessionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7B1113', paddingVertical: 14, marginBottom: 12 },
  viewSessionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700', fontFamily: fonts.bodyBold, textTransform: 'uppercase', letterSpacing: 0.5 },
  closeBtn: { alignItems: 'center', paddingVertical: 10 },
  closeBtnDark: {},
  closeBtnText: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  closeBtnTextDark: { color: 'rgba(255,255,255,0.5)' },
})
