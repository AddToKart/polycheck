import { useEffect, useState } from 'react'
import { Modal, View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../../services/mock-api'
import { fonts } from '../../../theme/typography'
import { useTheme } from '../../../theme/ThemeContext'
import MapView from '../../../components/MapView'
import type { User, Subject, Section } from '@polycheck/shared'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]
const GRACE_OPTIONS = [0, 5, 10, 15, 20, 25, 30]
const VALIDITY_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60]

function pad(n: number) { return n.toString().padStart(2, '0') }

function formatTime(h: number, m: number) {
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${pad(m)} ${period}`
}

function TimePickerModal({ value, onChange, onClose }: { value: string; onChange: (t: string) => void; onClose: () => void }) {
  const { isDark } = useTheme()
  const [h, setH] = useState(parseInt(value.split(':')[0], 10))
  const [m, setM] = useState(parseInt(value.split(':')[1], 10))

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.timeSheet, isDark && styles.timeSheetDark]} onStartShouldSetResponder={() => true}>
          <Text style={[styles.timeSheetTitle, isDark && styles.timeSheetTitleDark]}>Select Time</Text>
          <View style={styles.timeColumns}>
            <ScrollView style={[styles.timeColumn, isDark && styles.timeColumnDark]} showsVerticalScrollIndicator={false}>
              {HOURS.map((hour) => {
                const isActive = h === hour
                return (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.timeItem,
                      isActive && (isDark ? styles.timeItemActiveDark : styles.timeItemActive)
                    ]}
                    onPress={() => setH(hour)}
                  >
                    <Text style={[
                      styles.timeItemText,
                      isDark && styles.textWhite,
                      isActive && (isDark ? styles.timeItemTextActiveDark : styles.timeItemTextActive)
                    ]}>
                      {formatTime(hour, 0)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
            <ScrollView style={[styles.timeColumn, isDark && styles.timeColumnDark, { borderRightWidth: 0 }]} showsVerticalScrollIndicator={false}>
              {MINUTES.map((min) => {
                const isActive = m === min
                return (
                  <TouchableOpacity
                    key={min}
                    style={[
                      styles.timeItem,
                      isActive && (isDark ? styles.timeItemActiveDark : styles.timeItemActive)
                    ]}
                    onPress={() => setM(min)}
                  >
                    <Text style={[
                      styles.timeItemText,
                      isDark && styles.textWhite,
                      isActive && (isDark ? styles.timeItemTextActiveDark : styles.timeItemTextActive)
                    ]}>
                      :{pad(min)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
          <TouchableOpacity
            style={[styles.timeOkBtn, isDark && styles.timeOkBtnDark]}
            onPress={() => { onChange(`${pad(h)}:${pad(m)}`); onClose() }}
          >
            <Text style={[styles.timeOkBtnText, isDark && styles.timeOkBtnTextDark]}>OK</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

export default function CreateSessionScreen() {
  const { isDark } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [mapFocus, setMapFocus] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [room, setRoom] = useState('')
  const [gracePeriod, setGracePeriod] = useState(15)
  const [qrValidity, setQrValidity] = useState(20)
  const [latitude, setLatitude] = useState(14.5863)
  const [longitude, setLongitude] = useState(120.9777)
  const [radius, setRadius] = useState(40)
  const [showSubjectPicker, setShowSubjectPicker] = useState(false)
  const [showSectionPicker, setShowSectionPicker] = useState(false)
  const [showStartTime, setShowStartTime] = useState(false)
  const [showEndTime, setShowEndTime] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkStartDate, setBulkStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [bulkEndDate, setBulkEndDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 4); return d.toISOString().slice(0, 10)
  })
  const [bulkDays, setBulkDays] = useState<string[]>([])
  const [isRescheduled, setIsRescheduled] = useState(false)
  const [rescheduledFromDate, setRescheduledFromDate] = useState('')
  const [showReplaceDatePicker, setShowReplaceDatePicker] = useState(false)
  const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu) {
      setUser(cu)
      setSubjects(api.getSubjects())
    }
  }, [])

  useEffect(() => {
    if (selectedSubjectId) {
      setSections(api.getSections(selectedSubjectId).filter((s) => s.teacherId === user?.id))
      setSectionId('')
    } else {
      setSections([])
      setSectionId('')
    }
  }, [selectedSubjectId])

  const filteredSections = selectedSubjectId
    ? sections.filter(s => s.subjectId === selectedSubjectId)
    : []

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId)
  const selectedSection = sections.find((s) => s.id === sectionId)
  const selectedParentSubject = selectedSection ? subjects.find((s) => s.id === selectedSection.subjectId) : undefined

  // Issue 3: Duplicate session detection
  const existingSessionOnDate = !bulkMode && sectionId && date
    ? api.getSessions(sectionId).find((s) => s.date === date)
    : null
  const hasDuplicateConflict = !!existingSessionOnDate && !isRescheduled

  useEffect(() => {
    if (selectedSection) {
      setBulkDays(selectedSection.schedule.map((s) => s.day as string))
      if (selectedSection.room) setRoom(selectedSection.room)
      setIsRescheduled(false)
      setRescheduledFromDate('')
    }
  }, [selectedSection])

  if (!user) return null

  const getStandardReplaceDates = () => {
    if (!selectedSection) return []
    const dates: { dateStr: string; label: string; scheduleTime: string; room?: string }[] = []
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const dayName = dayNames[d.getDay()]
      const sched = selectedSection.schedule.find((s) => s.day === dayName)
      if (sched) {
        const dateStr = d.toISOString().slice(0, 10)
        const dateLabel = d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        dates.push({
          dateStr,
          label: `${dateLabel} (${sched.startTime} - ${sched.endTime})`,
          scheduleTime: `${sched.startTime} - ${sched.endTime}`,
          room: selectedSection.room || undefined,
        })
      }
    }
    return dates
  }

  const calculateBulkCount = () => {
    if (!bulkStartDate || !bulkEndDate || bulkDays.length === 0) return 0
    const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 }
    const targetDays = bulkDays.map((d) => dayMap[d])
    const start = new Date(bulkStartDate)
    const end = new Date(bulkEndDate)
    let count = 0
    const cursor = new Date(start)
    while (cursor <= end) {
      if (targetDays.includes(cursor.getDay())) count++
      cursor.setDate(cursor.getDate() + 1)
    }
    return count
  }

  const handleCreate = () => {
    if (!sectionId || !selectedSection) return
    if (bulkMode) {
      const count = calculateBulkCount()
      if (count === 0) return
      api.createBulkSessions({
        sectionId,
        subjectName: selectedParentSubject?.name ?? '',
        startDate: bulkStartDate,
        endDate: bulkEndDate,
        daysOfWeek: bulkDays,
        startTime,
        endTime,
        room: room || undefined,
        qrValidityMinutes: qrValidity,
        gracePeriodMinutes: gracePeriod,
        geofence: { latitude, longitude, radiusMeters: radius },
        teacherId: user.id,
      })
      Alert.alert('Sessions Created', `${count} session${count !== 1 ? 's' : ''} created successfully.`)
      router.back()
    } else {
      const replaceDates = getStandardReplaceDates()
      const selectedReplaceOption = replaceDates.find((d) => d.dateStr === rescheduledFromDate)

      api.createSession({
        sectionId,
        subjectName: selectedParentSubject?.name ?? '',
        date,
        startTime,
        endTime,
        room: room || undefined,
        qrValidityMinutes: qrValidity,
        gracePeriodMinutes: gracePeriod,
        geofence: { latitude, longitude, radiusMeters: radius },
        teacherId: user.id,
        isRescheduled: isRescheduled || undefined,
        rescheduledFromDate: isRescheduled ? rescheduledFromDate : undefined,
        originalScheduleTime: isRescheduled ? selectedReplaceOption?.scheduleTime : undefined,
        originalRoom: isRescheduled ? selectedReplaceOption?.room : undefined,
      })
      router.back()
    }
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
        </TouchableOpacity>
        <Text style={[styles.heading, isDark && styles.headingDark]}>Create Session</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEnabled={!mapFocus}>
        {/* Step 1: Subject */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Step 1 — Subject</Text>
        <TouchableOpacity
          style={[styles.picker, isDark && styles.pickerDark]}
          onPress={() => setShowSubjectPicker(true)}
        >
          <Text style={[styles.pickerText, isDark && styles.textWhite, !selectedSubject && styles.pickerPlaceholder]}>
            {selectedSubject ? `${selectedSubject.name} (${selectedSubject.code})` : 'Select a subject'}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={20} color={isDark ? '#FFDF00' : '#888'} />
        </TouchableOpacity>

        <Modal visible={showSubjectPicker} transparent animationType="fade" onRequestClose={() => setShowSubjectPicker(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSubjectPicker(false)}>
            <View style={[styles.sheet, isDark && styles.sheetDark]} onStartShouldSetResponder={() => true}>
              <Text style={[styles.sheetTitle, isDark && styles.sheetTitleDark]}>Select Subject</Text>
              <ScrollView>
                {subjects.map((subj) => (
                  <TouchableOpacity
                    key={subj.id}
                    style={[
                      styles.sheetOption,
                      isDark && styles.sheetOptionDarkBorder,
                      subj.id === selectedSubjectId && (isDark ? styles.sheetOptionSelectedDark : styles.sheetOptionSelected)
                    ]}
                    onPress={() => { setSelectedSubjectId(subj.id); setShowSubjectPicker(false) }}
                  >
                    <Text style={[styles.sheetOptionText, isDark && styles.sheetOptionTextDark, subj.id === selectedSubjectId && (isDark ? styles.sheetOptionTextActiveDark : styles.sheetOptionTextActive)]}>
                      {subj.name} ({subj.code})
                    </Text>
                    {subj.id === selectedSubjectId && <MaterialIcons name="check" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Step 2: Section */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Step 2 — Section</Text>
        <TouchableOpacity
          style={[styles.picker, isDark && styles.pickerDark, !selectedSubject && styles.pickerDisabled]}
          onPress={() => selectedSubject && setShowSectionPicker(true)}
          disabled={!selectedSubject}
        >
          <Text style={[styles.pickerText, isDark && styles.textWhite, !selectedSection && styles.pickerPlaceholder, !selectedSubject && styles.pickerTextDisabled]}>
            {selectedSection
              ? `Section ${selectedSection.section}${selectedSection.room ? ` - ${selectedSection.room}` : ''}`
              : selectedSubject ? 'Select a section' : 'Select a subject first'}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={20} color={isDark ? (selectedSubject ? '#FFDF00' : 'rgba(245,168,0,0.3)') : (selectedSubject ? '#888' : '#CCC')} />
        </TouchableOpacity>

        <Modal visible={showSectionPicker} transparent animationType="fade" onRequestClose={() => setShowSectionPicker(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSectionPicker(false)}>
            <View style={[styles.sheet, isDark && styles.sheetDark]} onStartShouldSetResponder={() => true}>
              <Text style={[styles.sheetTitle, isDark && styles.sheetTitleDark]}>Select Section</Text>
              <ScrollView>
                {filteredSections.map((s) => {
                  const parent = subjects.find(sub => sub.id === s.subjectId)
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.sheetOption,
                        isDark && styles.sheetOptionDarkBorder,
                        s.id === sectionId && (isDark ? styles.sheetOptionSelectedDark : styles.sheetOptionSelected)
                      ]}
                      onPress={() => { setSectionId(s.id); setShowSectionPicker(false) }}
                    >
                      <Text style={[styles.sheetOptionText, isDark && styles.sheetOptionTextDark, s.id === sectionId && (isDark ? styles.sheetOptionTextActiveDark : styles.sheetOptionTextActive)]}>
                        {parent?.name ?? ''} ({parent?.code ?? ''}) - Sec {s.section}{s.room ? ` - ${s.room}` : ''}
                      </Text>
                      {s.id === sectionId && <MaterialIcons name="check" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Bulk Create Toggle */}
        <View style={styles.bulkToggle}>
          <TouchableOpacity
            style={styles.bulkToggleRow}
            onPress={() => setBulkMode(!bulkMode)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, bulkMode && styles.checkboxActive, isDark && styles.checkboxDark, bulkMode && isDark && styles.checkboxActiveDark]}>
              {bulkMode && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
            </View>
            <Text style={[styles.bulkToggleLabel, isDark && styles.textWhite]}>Create recurring sessions for the semester</Text>
          </TouchableOpacity>
        </View>

        {bulkMode ? (
          <>
            <Text style={[styles.label, isDark && styles.labelDark, { marginTop: 8 }]}>Bulk Session Range</Text>
            <View style={[styles.bulkBox, isDark && styles.bulkBoxDark]}>
              <Text style={[styles.hint, isDark && styles.hintDark, { marginBottom: 12 }]}>
                Create sessions for all selected days between the start and end dates.
              </Text>
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={[styles.bulkFieldLabel, isDark && styles.textWhite50]}>Start Date</Text>
                  <TextInput
                    style={[styles.picker, isDark && styles.pickerDark, { marginTop: 4 }]}
                    value={bulkStartDate}
                    onChangeText={setBulkStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#AAA"
                  />
                </View>
                <View style={styles.half}>
                  <Text style={[styles.bulkFieldLabel, isDark && styles.textWhite50]}>End Date</Text>
                  <TextInput
                    style={[styles.picker, isDark && styles.pickerDark, { marginTop: 4 }]}
                    value={bulkEndDate}
                    onChangeText={setBulkEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#AAA"
                  />
                </View>
              </View>
              <Text style={[styles.bulkFieldLabel, isDark && styles.textWhite50, { marginTop: 12, marginBottom: 6 }]}>Days of Week</Text>
              <View style={styles.bulkDaysRow}>
                {ALL_DAYS.map((day) => {
                  const selected = bulkDays.includes(day)
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.bulkDayChip, selected && styles.bulkDayChipActive, isDark && styles.bulkDayChipDark, selected && isDark && styles.bulkDayChipActiveDark]}
                      onPress={() => {
                        setBulkDays((prev) => selected ? prev.filter((d) => d !== day) : [...prev, day])
                      }}
                    >
                      <Text style={[styles.bulkDayText, selected && styles.bulkDayTextActive, isDark && styles.bulkDayTextDark]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <View style={[styles.bulkCountBadge, isDark && styles.bulkCountBadgeDark]}>
                <Text style={[styles.bulkCountText, isDark && styles.bulkCountTextDark]}>
                  {calculateBulkCount()} session{calculateBulkCount() !== 1 ? 's' : ''} will be created
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.label, isDark && styles.labelDark]}>Date</Text>
            <TextInput
              style={[styles.picker, isDark && styles.pickerDark]}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#AAA"
            />

            {/* Duplicate session warning */}
            {hasDuplicateConflict && (
              <View style={{ backgroundColor: '#FFFBEB', borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 12, marginTop: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#B45309', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                  Session Conflict
                </Text>
                <Text style={{ fontSize: 12, color: '#92400E', lineHeight: 17 }}>
                  A session already exists for this section on {date}. Change the date or enable "Reschedule" to replace it.
                </Text>
              </View>
            )}
            
            {selectedSection && selectedSection.schedule.length > 0 && (
              <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : '#EEE', paddingTop: 12 }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
                  onPress={() => {
                    const nextVal = !isRescheduled
                    setIsRescheduled(nextVal)
                    if (nextVal) {
                      const dates = getStandardReplaceDates()
                      if (dates.length > 0) {
                        setRescheduledFromDate(dates[0].dateStr)
                      }
                    } else {
                      setRescheduledFromDate('')
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, isRescheduled && styles.checkboxActive, isDark && styles.checkboxDark, isRescheduled && isDark && styles.checkboxActiveDark]}>
                    {isRescheduled && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', fontFamily: fonts.bodyBold, color: isDark ? '#FFDF00' : '#7B1113' }}>
                    Reschedule a standard class slot
                  </Text>
                </TouchableOpacity>

                {isRescheduled && (
                  <View style={{ marginTop: 10, padding: 12, backgroundColor: isDark ? '#121215' : '#FAFAFA', borderWidth: 1, borderColor: isDark ? 'rgba(245,168,0,0.15)' : '#E0E0E0' }}>
                    <Text style={[styles.label, isDark && styles.labelDark, { marginTop: 0, marginBottom: 6 }]}>
                      Standard slot to replace
                    </Text>
                    <TouchableOpacity
                      style={[styles.picker, isDark && styles.pickerDark]}
                      onPress={() => setShowReplaceDatePicker(true)}
                    >
                      <Text style={[styles.pickerText, isDark && styles.textWhite]}>
                        {getStandardReplaceDates().find((d) => d.dateStr === rescheduledFromDate)?.label || 'Select standard slot'}
                      </Text>
                      <MaterialIcons name="keyboard-arrow-down" size={20} color={isDark ? '#FFDF00' : '#888'} />
                    </TouchableOpacity>

                    <Text style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                      The selected standard slot will be visually marked as "MOVED" for students.
                    </Text>

                    <Modal visible={showReplaceDatePicker} transparent animationType="fade" onRequestClose={() => setShowReplaceDatePicker(false)}>
                      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowReplaceDatePicker(false)}>
                        <View style={[styles.sheet, isDark && styles.sheetDark]} onStartShouldSetResponder={() => true}>
                          <Text style={[styles.sheetTitle, isDark && styles.sheetTitleDark]}>Select Standard Slot</Text>
                          <ScrollView>
                            {getStandardReplaceDates().map((d) => (
                              <TouchableOpacity
                                key={d.dateStr}
                                style={[
                                  styles.sheetOption,
                                  isDark && styles.sheetOptionDarkBorder,
                                  d.dateStr === rescheduledFromDate && (isDark ? styles.sheetOptionSelectedDark : styles.sheetOptionSelected)
                                ]}
                                onPress={() => { setRescheduledFromDate(d.dateStr); setShowReplaceDatePicker(false) }}
                              >
                                <Text style={[styles.sheetOptionText, isDark && styles.sheetOptionTextDark, d.dateStr === rescheduledFromDate && (isDark ? styles.sheetOptionTextActiveDark : styles.sheetOptionTextActive)]}>
                                  {d.label}
                                </Text>
                                {d.dateStr === rescheduledFromDate && <MaterialIcons name="check" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />}
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      </TouchableOpacity>
                    </Modal>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* Time row */}
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={[styles.label, isDark && styles.labelDark]}>Start Time</Text>
            <TouchableOpacity style={[styles.picker, isDark && styles.pickerDark]} onPress={() => setShowStartTime(true)}>
              <Text style={[styles.pickerText, isDark && styles.textWhite]}>{formatTime(parseInt(startTime.split(':')[0], 10), parseInt(startTime.split(':')[1], 10))}</Text>
              <MaterialIcons name="access-time" size={18} color={isDark ? '#FFDF00' : '#888'} />
            </TouchableOpacity>
          </View>
          <View style={styles.half}>
            <Text style={[styles.label, isDark && styles.labelDark]}>End Time</Text>
            <TouchableOpacity style={[styles.picker, isDark && styles.pickerDark]} onPress={() => setShowEndTime(true)}>
              <Text style={[styles.pickerText, isDark && styles.textWhite]}>{formatTime(parseInt(endTime.split(':')[0], 10), parseInt(endTime.split(':')[1], 10))}</Text>
              <MaterialIcons name="access-time" size={18} color={isDark ? '#FFDF00' : '#888'} />
            </TouchableOpacity>
          </View>
        </View>

        {showStartTime && <TimePickerModal value={startTime} onChange={setStartTime} onClose={() => setShowStartTime(false)} />}
        {showEndTime && <TimePickerModal value={endTime} onChange={setEndTime} onClose={() => setShowEndTime(false)} />}

        {/* Room */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Room</Text>
        <View style={[styles.picker, isDark && styles.pickerDark]}>
          <TextInput
            style={[styles.pickerText, isDark && styles.textWhite]}
            value={room}
            onChangeText={setRoom}
            placeholder="e.g. CCIS Lab 3"
            placeholderTextColor="#AAA"
          />
        </View>

        {/* Grace Period + QR Validity as selector rows */}
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={[styles.label, isDark && styles.labelDark]}>Grace Period</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionRow}>
              {GRACE_OPTIONS.map((g) => {
                const isActive = gracePeriod === g
                return (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.optChip,
                      isDark && styles.optChipDark,
                      isActive && styles.optChipActive,
                      isActive && isDark && styles.optChipActiveDark
                    ]}
                    onPress={() => setGracePeriod(g)}
                  >
                    <Text style={[
                      styles.optChipText,
                      isDark && styles.optChipTextDark,
                      isActive && styles.optChipTextActive
                    ]}>{g} min</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
          <View style={styles.half}>
            <Text style={[styles.label, isDark && styles.labelDark]}>QR Validity (default)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionRow}>
              {VALIDITY_OPTIONS.map((t) => {
                const isActive = qrValidity === t
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.optChip,
                      isDark && styles.optChipDark,
                      isActive && styles.optChipActive,
                      isActive && isDark && styles.optChipActiveDark
                    ]}
                    onPress={() => setQrValidity(t)}
                  >
                    <Text style={[
                      styles.optChipText,
                      isDark && styles.optChipTextDark,
                      isActive && styles.optChipTextActive
                    ]}>{t} min</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </View>

        {/* Geofence */}
        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Geofence</Text>
        <Text style={[styles.hint, isDark && styles.hintDark]}>Pan and zoom the map. Drag the pin or tap anywhere to set the attendance location.</Text>
        <View
          onTouchStart={() => setMapFocus(true)}
          onTouchEnd={() => setMapFocus(false)}
          onTouchCancel={() => setMapFocus(false)}
        >
          <MapView
            latitude={latitude}
            longitude={longitude}
            radius={radius}
            interactive
            onLocationChange={(lat, lng) => { setLatitude(lat); setLongitude(lng) }}
            onRadiusChange={setRadius}
          />
        </View>

        {/* Create button */}
        <TouchableOpacity
          style={[styles.createBtn, isDark && styles.createBtnDark, (!sectionId || (bulkMode && calculateBulkCount() === 0) || hasDuplicateConflict) && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!sectionId || (bulkMode && calculateBulkCount() === 0) || hasDuplicateConflict}
          accessibilityRole="button"
          accessibilityLabel={bulkMode ? 'Create bulk sessions' : 'Create session'}
        >
          <MaterialIcons name="add" size={20} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
          <Text style={[styles.createBtnText, isDark && styles.createBtnTextDark]}>
            {bulkMode ? `Create ${calculateBulkCount()} Sessions` : 'Create Session'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0C' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  backBtn: { padding: 4, marginRight: 12 },
  heading: { flex: 1, fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A' },
  headingDark: { color: '#FFDF00' },
  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },
  label: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#888', marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelDark: { color: 'rgba(255,255,255,0.5)' },
  hint: { fontSize: 12, fontFamily: fonts.body, color: '#999', marginBottom: 10, lineHeight: 16 },
  hintDark: { color: 'rgba(255,255,255,0.4)' },
  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A', marginTop: 24, marginBottom: 2 },
  sectionTitleDark: { color: '#FFFFFF' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  pickerDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  pickerDisabled: { opacity: 0.4 },
  pickerText: { fontSize: 15, fontFamily: fonts.body, color: '#333', flex: 1 },
  pickerPlaceholder: { color: '#AAA' },
  pickerTextDisabled: { color: 'rgba(255,255,255,0.3)' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', paddingTop: 20, paddingBottom: 40, maxHeight: '70%' },
  sheetDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  sheetTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A', paddingHorizontal: 20, marginBottom: 12 },
  sheetTitleDark: { color: '#FFFFFF' },
  sheetOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sheetOptionDarkBorder: { borderBottomColor: 'rgba(255,255,255,0.05)' },
  sheetOptionSelected: { backgroundColor: 'rgba(123,17,19,0.04)' },
  sheetOptionSelectedDark: { backgroundColor: 'rgba(245, 168, 0, 0.1)' },
  sheetOptionText: { fontSize: 15, fontFamily: fonts.body, color: '#333', flex: 1 },
  sheetOptionTextDark: { color: '#FFF' },
  sheetOptionTextActive: { fontFamily: fonts.bodySemiBold, color: '#7B1113' },
  sheetOptionTextActiveDark: { fontFamily: fonts.bodySemiBold, color: '#FFDF00' },
  optionRow: { flexDirection: 'row', gap: 0, marginTop: 2 },
  optChip: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#FFFFFF', marginRight: 6 },
  optChipActive: { borderColor: '#7B1113', backgroundColor: '#7B1113' },
  optChipDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  optChipActiveDark: { borderColor: '#FFDF00', backgroundColor: '#FFDF00' },
  optChipText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#666' },
  optChipTextDark: { color: 'rgba(255,255,255,0.7)' },
  optChipTextActive: { color: '#FFFFFF' },
  createBtn: { backgroundColor: '#7B1113', paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 32 },
  createBtnDark: { backgroundColor: '#FFDF00' },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  createBtnTextDark: { color: '#4A0A0B' },
  timeSheet: { backgroundColor: '#FFFFFF', paddingTop: 20, paddingBottom: 24 },
  timeSheetDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  timeSheetTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A', textAlign: 'center', marginBottom: 16 },
  timeSheetTitleDark: { color: '#FFFFFF' },
  timeColumns: { flexDirection: 'row', maxHeight: 240 },
  timeColumn: { flex: 1, borderRightWidth: 1, borderRightColor: '#F0F0F0' },
  timeColumnDark: { borderRightColor: 'rgba(255,255,255,0.05)' },
  timeItem: { paddingVertical: 10, alignItems: 'center' },
  timeItemActive: { backgroundColor: 'rgba(123,17,19,0.08)' },
  timeItemActiveDark: { backgroundColor: 'rgba(245, 168, 0, 0.1)' },
  timeItemText: { fontSize: 15, fontFamily: fonts.body, color: '#333' },
  timeItemTextActive: { fontFamily: fonts.bodySemiBold, color: '#7B1113' },
  timeItemTextActiveDark: { fontFamily: fonts.bodySemiBold, color: '#FFDF00' },
  timeOkBtn: { backgroundColor: '#7B1113', marginHorizontal: 20, marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  timeOkBtnDark: { backgroundColor: '#FFDF00' },
  timeOkBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  timeOkBtnTextDark: { color: '#4A0A0B' },
  bulkToggle: { marginTop: 8 },
  bulkToggleDark: {},
  bulkToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: '#7B1113', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#7B1113' },
  checkboxDark: { borderColor: '#FFDF00' },
  checkboxActiveDark: { backgroundColor: '#FFDF00' },
  bulkToggleLabel: { fontSize: 14, fontFamily: fonts.body, color: '#333', flex: 1 },
  bulkBox: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#E0E0E0', padding: 14 },
  bulkBoxDark: { backgroundColor: '#121215', borderColor: 'rgba(245, 168, 0, 0.15)' },
  bulkFieldLabel: { fontSize: 11, fontFamily: fonts.bodyMedium, color: '#888', marginTop: 4 },
  bulkDaysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bulkDayChip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#FFFFFF' },
  bulkDayChipActive: { backgroundColor: '#7B1113', borderColor: '#7B1113' },
  bulkDayChipDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  bulkDayChipActiveDark: { backgroundColor: '#FFDF00', borderColor: '#FFDF00' },
  bulkDayText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#666' },
  bulkDayTextActive: { color: '#FFFFFF' },
  bulkDayTextDark: { color: 'rgba(255,255,255,0.7)' },
  bulkCountBadge: { marginTop: 12, backgroundColor: 'rgba(123,17,19,0.08)', paddingVertical: 6, paddingHorizontal: 10 },
  bulkCountBadgeDark: { backgroundColor: 'rgba(245, 168, 0, 0.1)' },
  bulkCountText: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: '#7B1113' },
  bulkCountTextDark: { color: '#FFDF00' },
})
