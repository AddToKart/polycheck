import { useEffect, useState } from 'react'
import { Modal, View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../../../services/mock-api'
import { fonts } from '../../../theme/typography'
import { useTheme } from '../../../theme/ThemeContext'
import type { User, Subject, DayOfWeek } from '@polycheck/shared'

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

function pad(n: number) { return n.toString().padStart(2, '0') }

function formatTime(h: number, m: number) {
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${pad(m)} ${period}`
}

function generateEnrollmentCode(subjectName: string): string {
  const prefix = subjectName.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 4) || 'CODE'
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${prefix}${suffix}`
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

export default function CreateSectionScreen() {
  const { isDark } = useTheme()
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [section, setSection] = useState('')
  const [room, setRoom] = useState('')
  const [semester, setSemester] = useState('')
  const [showSemesterPicker, setShowSemesterPicker] = useState(false)
  const [showDayPicker, setShowDayPicker] = useState(false)
  const [showStartTime, setShowStartTime] = useState(false)
  const [showEndTime, setShowEndTime] = useState(false)
  const [scheduleEntries, setScheduleEntries] = useState<{ day: DayOfWeek; startTime: string; endTime: string; room?: string }[]>([])
  const [newDay, setNewDay] = useState<DayOfWeek>('Mon')
  const [newStartTime, setNewStartTime] = useState('08:00')
  const [newEndTime, setNewEndTime] = useState('09:00')
  const [newSchedRoom, setNewSchedRoom] = useState('')

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu) setUser(cu)
    if (subjectId) {
      const subj = api.getSubject(subjectId)
      if (subj) setSubject(subj)
    }
  }, [subjectId])

  if (!user || !subject) return null

  const enrollmentCode = generateEnrollmentCode(subject.name)

  const addScheduleEntry = () => {
    setScheduleEntries([...scheduleEntries, { day: newDay, startTime: newStartTime, endTime: newEndTime, room: newSchedRoom || undefined }])
  }

  const removeScheduleEntry = (index: number) => {
    setScheduleEntries(scheduleEntries.filter((_, i) => i !== index))
  }

  const handleCreate = () => {
    if (!section || !room || !semester || scheduleEntries.length === 0) return
    const newSection = api.createSection({
      subjectId,
      section,
      room,
      schedule: scheduleEntries.map((s) => ({ day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room })),
      semester,
      teacherId: user.id,
      teacherName: user.fullName,
    })
    api.resetEnrollmentCode(newSection.id)
    router.back()
  }

  const isValid = section.trim() && room.trim() && semester && scheduleEntries.length > 0

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heading, isDark && styles.headingDark]}>Create Section</Text>
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>{subject.name} ({subject.code})</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Section Name */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Section</Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          value={section}
          onChangeText={setSection}
          placeholder="e.g. A, B, C"
          placeholderTextColor="#AAA"
        />

        {/* Room */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Room</Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          value={room}
          onChangeText={setRoom}
          placeholder="e.g. CCIS Lab 3"
          placeholderTextColor="#AAA"
        />

        {/* Semester */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Semester</Text>
        <TouchableOpacity
          style={[styles.picker, isDark && styles.pickerDark]}
          onPress={() => setShowSemesterPicker(true)}
        >
          <Text style={[styles.pickerText, isDark && styles.textWhite, !semester && styles.pickerPlaceholder]}>
            {semester || 'Select semester'}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={20} color={isDark ? '#FFDF00' : '#888'} />
        </TouchableOpacity>

        <Modal visible={showSemesterPicker} transparent animationType="fade" onRequestClose={() => setShowSemesterPicker(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSemesterPicker(false)}>
            <View style={[styles.sheet, isDark && styles.sheetDark]} onStartShouldSetResponder={() => true}>
              <Text style={[styles.sheetTitle, isDark && styles.sheetTitleDark]}>Select Semester</Text>
              <ScrollView>
                {SEMESTERS.map((sem) => {
                  const isActive = semester === sem
                  return (
                    <TouchableOpacity
                      key={sem}
                      style={[
                        styles.sheetOption,
                        isDark && styles.sheetOptionDarkBorder,
                        isActive && (isDark ? styles.sheetOptionSelectedDark : styles.sheetOptionSelected)
                      ]}
                      onPress={() => { setSemester(sem); setShowSemesterPicker(false) }}
                    >
                      <Text style={[
                        styles.sheetOptionText,
                        isDark && styles.sheetOptionTextDark,
                        isActive && (isDark ? styles.sheetOptionTextActiveDark : styles.sheetOptionTextActive)
                      ]}>{sem}</Text>
                      {isActive && <MaterialIcons name="check" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Schedule Builder */}
        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Schedule</Text>

        {scheduleEntries.map((entry, index) => (
          <View key={index} style={[styles.schedCard, isDark && styles.schedCardDark]}>
            <View style={styles.schedCardHeader}>
              <View style={[styles.dayBadge, isDark && styles.dayBadgeDark]}>
                <Text style={[styles.dayBadgeText, isDark && styles.dayBadgeTextDark]}>{entry.day}</Text>
              </View>
              <Text style={[styles.schedTime, isDark && styles.textWhite]}>
                {formatTime(parseInt(entry.startTime.split(':')[0], 10), parseInt(entry.startTime.split(':')[1], 10))} - {formatTime(parseInt(entry.endTime.split(':')[0], 10), parseInt(entry.endTime.split(':')[1], 10))}
              </Text>
              <TouchableOpacity onPress={() => removeScheduleEntry(index)} style={styles.removeBtn} accessibilityLabel="Remove schedule entry">
                <MaterialIcons name="close" size={18} color="#E53935" />
              </TouchableOpacity>
            </View>
            {entry.room ? (
              <Text style={[styles.schedRoom, isDark && styles.textWhite50]}>Room: {entry.room}</Text>
            ) : null}
          </View>
        ))}

        {/* Add Schedule Entry */}
        <View style={[styles.addSchedBox, isDark && styles.addSchedBoxDark]}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.smallLabel, isDark && styles.labelDark]}>Day</Text>
              <TouchableOpacity
                style={[styles.picker, isDark && styles.pickerDark]}
                onPress={() => setShowDayPicker(!showDayPicker)}
              >
                <Text style={[styles.pickerText, isDark && styles.textWhite]}>{newDay}</Text>
                <MaterialIcons name="keyboard-arrow-down" size={18} color={isDark ? '#FFDF00' : '#888'} />
              </TouchableOpacity>
            </View>
          </View>

          <Modal visible={showDayPicker} transparent animationType="fade" onRequestClose={() => setShowDayPicker(false)}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowDayPicker(false)}>
              <View style={[styles.sheet, isDark && styles.sheetDark]} onStartShouldSetResponder={() => true}>
                <Text style={[styles.sheetTitle, isDark && styles.sheetTitleDark]}>Select Day</Text>
                <ScrollView>
                  {DAYS.map((day) => {
                    const isActive = newDay === day
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.sheetOption,
                          isDark && styles.sheetOptionDarkBorder,
                          isActive && (isDark ? styles.sheetOptionSelectedDark : styles.sheetOptionSelected)
                        ]}
                        onPress={() => { setNewDay(day); setShowDayPicker(false) }}
                      >
                        <Text style={[
                          styles.sheetOptionText,
                          isDark && styles.sheetOptionTextDark,
                          isActive && (isDark ? styles.sheetOptionTextActiveDark : styles.sheetOptionTextActive)
                        ]}>{day}</Text>
                        {isActive && <MaterialIcons name="check" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />}
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={[styles.smallLabel, isDark && styles.labelDark]}>Start</Text>
              <TouchableOpacity style={[styles.picker, isDark && styles.pickerDark]} onPress={() => setShowStartTime(true)}>
                <Text style={[styles.pickerText, isDark && styles.textWhite]}>{formatTime(parseInt(newStartTime.split(':')[0], 10), parseInt(newStartTime.split(':')[1], 10))}</Text>
                <MaterialIcons name="access-time" size={16} color={isDark ? '#FFDF00' : '#888'} />
              </TouchableOpacity>
            </View>
            <View style={styles.half}>
              <Text style={[styles.smallLabel, isDark && styles.labelDark]}>End</Text>
              <TouchableOpacity style={[styles.picker, isDark && styles.pickerDark]} onPress={() => setShowEndTime(true)}>
                <Text style={[styles.pickerText, isDark && styles.textWhite]}>{formatTime(parseInt(newEndTime.split(':')[0], 10), parseInt(newEndTime.split(':')[1], 10))}</Text>
                <MaterialIcons name="access-time" size={16} color={isDark ? '#FFDF00' : '#888'} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.smallLabel, isDark && styles.labelDark]}>Room (optional)</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            value={newSchedRoom}
            onChangeText={setNewSchedRoom}
            placeholder="e.g. CCIS Lab 3"
            placeholderTextColor="#AAA"
          />

          <TouchableOpacity style={[styles.addBtn, isDark && styles.addBtnDark]} onPress={addScheduleEntry}>
            <MaterialIcons name="add" size={16} color="#FFFFFF" />
            <Text style={[styles.addBtnText, isDark && styles.addBtnTextDark]}>Add Schedule</Text>
          </TouchableOpacity>
        </View>

        {/* Enrollment Code (auto-generated, read-only) */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Enrollment Code (auto)</Text>
        <View style={[styles.codeBox, isDark && styles.codeBoxDark]}>
          <Text style={[styles.codeText, isDark && styles.codeTextDark]}>{enrollmentCode}</Text>
          <Text style={[styles.codeHint, isDark && styles.codeHintDark]}>Code will be set on creation</Text>
        </View>

        {/* Create button */}
        <TouchableOpacity
          style={[styles.createBtn, isDark && styles.createBtnDark, !isValid && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!isValid}
          accessibilityRole="button"
          accessibilityLabel="Create section"
        >
          <MaterialIcons name="add" size={20} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
          <Text style={[styles.createBtnText, isDark && styles.createBtnTextDark]}>Create Section</Text>
        </TouchableOpacity>
      </ScrollView>

      {showStartTime && <TimePickerModal value={newStartTime} onChange={setNewStartTime} onClose={() => setShowStartTime(false)} />}
      {showEndTime && <TimePickerModal value={newEndTime} onChange={setNewEndTime} onClose={() => setShowEndTime(false)} />}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0C' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  backBtn: { padding: 4, marginRight: 12 },
  heading: { fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A' },
  headingDark: { color: '#FFDF00' },
  subtitle: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 1 },
  subtitleDark: { color: 'rgba(255,255,255,0.4)' },
  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },
  label: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#888', marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelDark: { color: 'rgba(255,255,255,0.5)' },
  smallLabel: { fontSize: 11, fontFamily: fonts.bodyMedium, color: '#888', marginBottom: 4, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A', marginTop: 24, marginBottom: 12 },
  sectionTitleDark: { color: '#FFFFFF' },
  input: { borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: fonts.body, color: '#333', backgroundColor: '#FFFFFF' },
  inputDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215', color: '#FFF' },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  pickerDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  pickerText: { fontSize: 15, fontFamily: fonts.body, color: '#333', flex: 1 },
  pickerPlaceholder: { color: '#AAA' },
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
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  schedCard: { backgroundColor: '#FFFFFF', padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#EEE' },
  schedCardDark: { backgroundColor: '#121215', borderColor: 'rgba(245, 168, 0, 0.15)' },
  schedCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayBadge: { backgroundColor: '#7B1113', paddingHorizontal: 10, paddingVertical: 4 },
  dayBadgeDark: { backgroundColor: '#FFDF00' },
  dayBadgeText: { color: '#FFFFFF', fontSize: 12, fontFamily: fonts.bodySemiBold },
  dayBadgeTextDark: { color: '#4A0A0B' },
  schedTime: { flex: 1, fontSize: 14, fontFamily: fonts.body, color: '#333' },
  schedRoom: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 4, marginLeft: 4 },
  removeBtn: { padding: 4 },
  addSchedBox: { backgroundColor: '#FFFFFF', padding: 12, borderWidth: 1, borderColor: '#EEE', borderStyle: 'dashed' },
  addSchedBoxDark: { backgroundColor: '#121215', borderColor: 'rgba(245, 168, 0, 0.2)' },
  addBtn: { backgroundColor: '#7B1113', paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 },
  addBtnDark: { backgroundColor: '#FFDF00' },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  addBtnTextDark: { color: '#4A0A0B' },
  codeBox: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD', padding: 14, alignItems: 'center' },
  codeBoxDark: { backgroundColor: '#121215', borderColor: 'rgba(245, 168, 0, 0.15)' },
  codeText: { fontSize: 20, fontFamily: 'monospace', fontWeight: '700', letterSpacing: 3, color: '#7B1113' },
  codeTextDark: { color: '#FFDF00' },
  codeHint: { fontSize: 11, fontFamily: fonts.body, color: '#999', marginTop: 4 },
  codeHintDark: { color: 'rgba(255,255,255,0.4)' },
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
})
