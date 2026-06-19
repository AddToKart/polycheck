import { useState, useEffect } from 'react'
import { View, Text, TextInput, ScrollView, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../../services/mock-api'
import { fonts } from '../../../theme/typography'
import { useTheme } from '../../../theme/ThemeContext'
import type { User } from '@polycheck/shared'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const SEMESTERS = ['1st Semester AY 2025-2026', '2nd Semester AY 2025-2026', 'Summer AY 2025-2026']
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

function pad(n: number) { return n.toString().padStart(2, '0') }

function formatTime(h: number, m: number) {
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${pad(m)} ${period}`
}

function generateEnrollmentCode(name: string): string {
  const words = name.split(' ').filter(Boolean)
  if (words.length === 0) return ''
  const prefix = words.map((w) => w[0]).join('').toUpperCase().slice(0, 4)
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${prefix}${suffix}`
}

function TimePickerModal({ value, onChange, onClose }: { value: string; onChange: (t: string) => void; onClose: () => void }) {
  const [h, setH] = useState(parseInt(value.split(':')[0], 10))
  const [m, setM] = useState(parseInt(value.split(':')[1], 10))
  const { isDark } = useTheme()

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={tpStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[tpStyles.sheet, isDark && tpStyles.sheetDark]} onStartShouldSetResponder={() => true}>
          <Text style={[tpStyles.title, isDark && tpStyles.titleDark]}>Select Time</Text>
          <View style={tpStyles.columns}>
            <ScrollView style={tpStyles.column} showsVerticalScrollIndicator={false}>
              {HOURS.map((hour) => (
                <TouchableOpacity
                  key={hour}
                  style={[tpStyles.item, h === hour && tpStyles.itemActive, h === hour && isDark && tpStyles.itemActiveDark]}
                  onPress={() => setH(hour)}
                >
                  <Text style={[tpStyles.itemText, h === hour && tpStyles.itemTextActive, h === hour && isDark && tpStyles.itemTextActiveDark]}>
                    {formatTime(hour, 0)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView style={tpStyles.column} showsVerticalScrollIndicator={false}>
              {MINUTES.map((min) => (
                <TouchableOpacity
                  key={min}
                  style={[tpStyles.item, m === min && tpStyles.itemActive, m === min && isDark && tpStyles.itemActiveDark]}
                  onPress={() => setM(min)}
                >
                  <Text style={[tpStyles.itemText, m === min && tpStyles.itemTextActive, m === min && isDark && tpStyles.itemTextActiveDark]}>
                    :{pad(m)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity
            style={[tpStyles.okBtn, isDark && tpStyles.okBtnDark]}
            onPress={() => { onChange(`${pad(h)}:${pad(m)}`); onClose() }}
          >
            <Text style={[tpStyles.okBtnText, isDark && tpStyles.okBtnTextDark]}>OK</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

export default function CreateSubjectScreen() {
  const { isDark } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [section, setSection] = useState('A')
  const [room, setRoom] = useState('')
  const [semester, setSemester] = useState(SEMESTERS[1])
  const [enrollmentCode, setEnrollmentCode] = useState('')
  const [schedule, setSchedule] = useState<{ day: string; startTime: string; endTime: string; room: string }[]>([])
  const [showSemesterPicker, setShowSemesterPicker] = useState(false)
  const [showDayPicker, setShowDayPicker] = useState(false)
  const [showStartTime, setShowStartTime] = useState(false)
  const [showEndTime, setShowEndTime] = useState(false)
  const [tempDay, setTempDay] = useState<string>('Mon')
  const [tempStart, setTempStart] = useState('09:00')
  const [tempEnd, setTempEnd] = useState('10:30')
  const [tempRoom, setTempRoom] = useState('')

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu) setUser(cu)
  }, [])

  useEffect(() => {
    if (name) setEnrollmentCode(generateEnrollmentCode(name))
  }, [name])

  const handleCreate = () => {
    if (!user || !name || !code || !room) return
    const subject = api.createSubject({ name, code })
    api.createSection({
      subjectId: subject.id,
      section,
      room,
      schedule,
      semester,
      teacherId: user.id,
      teacherName: user.fullName,
    })
    router.back()
  }

  const addScheduleEntry = () => {
    setSchedule([...schedule, { day: tempDay, startTime: tempStart, endTime: tempEnd, room: tempRoom }])
  }

  const removeScheduleEntry = (idx: number) => {
    setSchedule(schedule.filter((_, i) => i !== idx))
  }

  if (!user) return null

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#F5A800' : '#7B1113'} />
        </TouchableOpacity>
        <Text style={[styles.heading, isDark && styles.headingDark]}>Create Subject</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Subject Name */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Subject Name</Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Software Engineering"
          placeholderTextColor="#AAA"
        />

        {/* Code + Section row */}
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={[styles.label, isDark && styles.labelDark]}>Subject Code</Text>
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={code}
              onChangeText={setCode}
              placeholder="e.g. CCIS 3104"
              placeholderTextColor="#AAA"
            />
          </View>
          <View style={styles.half}>
            <Text style={[styles.label, isDark && styles.labelDark]}>Section</Text>
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={section}
              onChangeText={setSection}
              placeholder="e.g. A"
              placeholderTextColor="#AAA"
            />
          </View>
        </View>

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
          <Text style={[styles.pickerText, isDark && styles.textWhite]}>{semester}</Text>
          <MaterialIcons name="unfold-more" size={20} color="#888" />
        </TouchableOpacity>

        <Modal visible={showSemesterPicker} transparent animationType="fade" onRequestClose={() => setShowSemesterPicker(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSemesterPicker(false)}>
            <View style={[styles.sheet, isDark && styles.sheetDark]} onStartShouldSetResponder={() => true}>
              <Text style={[styles.sheetTitle, isDark && styles.sheetTitleDark]}>Select Semester</Text>
              {SEMESTERS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sheetOption, s === semester && styles.sheetOptionSelected, s === semester && isDark && styles.sheetOptionSelectedDark]}
                  onPress={() => { setSemester(s); setShowSemesterPicker(false) }}
                >
                  <Text style={[styles.sheetOptionText, isDark && styles.sheetOptionTextDark, s === semester && styles.sheetOptionTextActive, s === semester && isDark && styles.sheetOptionTextActiveDark]}>
                    {s}
                  </Text>
                  {s === semester && <MaterialIcons name="check" size={18} color={isDark ? '#F5A800' : '#7B1113'} />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Enrollment Code */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Enrollment Code</Text>
        <View style={[styles.codeRow, isDark && styles.codeRowDark]}>
          <Text style={[styles.codeText, isDark && styles.textGolden]}>{enrollmentCode || '\u2014'}</Text>
          {enrollmentCode ? <MaterialIcons name="autorenew" size={18} color="#888" /> : null}
        </View>
        <Text style={[styles.codeHint, isDark && styles.hintDark]}>Auto-generated from subject name. Students use this code to enroll.</Text>

        {/* Schedule */}
        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Schedule</Text>

        {schedule.map((entry, idx) => (
          <View key={idx} style={[styles.schedCard, isDark && styles.schedCardDark]}>
            <View style={styles.schedCardLeft}>
              <View style={[styles.dayBadge, isDark && styles.dayBadgeDark]}>
                <Text style={[styles.dayBadgeText, isDark && styles.dayBadgeTextDark]}>{entry.day}</Text>
              </View>
              <Text style={[styles.schedTime, isDark && styles.textWhite]}>
                {entry.startTime} - {entry.endTime}
              </Text>
              {entry.room ? (
                <Text style={[styles.schedRoom, isDark && styles.textWhite]}>{entry.room}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => removeScheduleEntry(idx)} style={styles.removeBtn} accessibilityLabel="Remove schedule">
              <MaterialIcons name="close" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Add schedule entry */}
        <View style={[styles.schedAdder, isDark && styles.schedAdderDark]}>
          <View style={styles.schedAdderRow}>
            <TouchableOpacity
              style={[styles.daySelector, isDark && styles.daySelectorDark]}
              onPress={() => setShowDayPicker(!showDayPicker)}
            >
              <Text style={[styles.daySelectorText, isDark && styles.textWhite]}>{tempDay}</Text>
              <MaterialIcons name="unfold-more" size={16} color="#888" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.timeBox, isDark && styles.timeBoxDark]}
              onPress={() => { setShowStartTime(true) }}
            >
              <MaterialIcons name="access-time" size={14} color="#888" />
              <Text style={[styles.timeBoxText, isDark && styles.textWhite]}>{tempStart}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.timeBox, isDark && styles.timeBoxDark]}
              onPress={() => { setShowEndTime(true) }}
            >
              <MaterialIcons name="access-time" size={14} color="#888" />
              <Text style={[styles.timeBoxText, isDark && styles.textWhite]}>{tempEnd}</Text>
            </TouchableOpacity>

            <TextInput
              style={[styles.roomInput, isDark && styles.roomInputDark]}
              value={tempRoom}
              onChangeText={setTempRoom}
              placeholder="Room"
              placeholderTextColor="#888"
            />

            <TouchableOpacity style={[styles.addSchedBtn, isDark && styles.addSchedBtnDark]} onPress={addScheduleEntry} accessibilityLabel="Add schedule">
              <MaterialIcons name="add" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>

          {showDayPicker && (
            <View style={styles.dayOptions}>
              {DAYS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayOption, tempDay === d && styles.dayOptionActive, tempDay === d && isDark && styles.dayOptionActiveDark]}
                  onPress={() => { setTempDay(d); setShowDayPicker(false) }}
                >
                  <Text style={[styles.dayOptionText, tempDay === d && styles.dayOptionTextActive, tempDay === d && isDark && styles.dayOptionTextActiveDark]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {showStartTime && <TimePickerModal value={tempStart} onChange={setTempStart} onClose={() => setShowStartTime(false)} />}
        {showEndTime && <TimePickerModal value={tempEnd} onChange={setTempEnd} onClose={() => setShowEndTime(false)} />}

        {/* Create button */}
        <TouchableOpacity
          style={[styles.createBtn, isDark && styles.createBtnDark, (!name || !code || !room || schedule.length === 0) && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!name || !code || !room || schedule.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Create subject"
        >
          <MaterialIcons name="add" size={20} color="#FFFFFF" />
          <Text style={[styles.createBtnText, isDark && styles.createBtnTextDark]}>Create Subject</Text>
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
  headingDark: { color: '#F5A800' },
  textWhite: { color: '#FFFFFF' },
  textGolden: { color: '#F5A800' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },
  label: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#888', marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelDark: { color: 'rgba(255,255,255,0.5)' },
  input: { borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: fonts.body, color: '#333', backgroundColor: '#FFFFFF' },
  inputDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215', color: '#FFF' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  pickerDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  pickerText: { fontSize: 15, fontFamily: fonts.body, color: '#333', flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', paddingTop: 20, paddingBottom: 40 },
  sheetDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  sheetTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A', paddingHorizontal: 20, marginBottom: 12 },
  sheetTitleDark: { color: '#FFFFFF' },
  sheetOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sheetOptionSelected: { backgroundColor: 'rgba(123,17,19,0.04)' },
  sheetOptionSelectedDark: { backgroundColor: 'rgba(245,168,0,0.1)' },
  sheetOptionText: { fontSize: 15, fontFamily: fonts.body, color: '#333', flex: 1 },
  sheetOptionTextDark: { color: '#FFF' },
  sheetOptionTextActive: { fontFamily: fonts.bodySemiBold, color: '#7B1113' },
  sheetOptionTextActiveDark: { fontFamily: fonts.bodySemiBold, color: '#F5A800' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FAFAFA' },
  codeRowDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#0D0D10' },
  codeText: { fontSize: 18, fontFamily: fonts.mono, fontWeight: '700', color: '#7B1113', letterSpacing: 2 },
  codeHint: { fontSize: 11, fontFamily: fonts.body, color: '#999', marginTop: 4, lineHeight: 15 },
  hintDark: { color: 'rgba(255,255,255,0.4)' },
  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A', marginTop: 24, marginBottom: 12 },
  sectionTitleDark: { color: '#FFFFFF' },
  schedCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#DDD', backgroundColor: '#FFFFFF', padding: 12, marginBottom: 8 },
  schedCardDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  schedCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dayBadge: { backgroundColor: '#7B1113', paddingHorizontal: 10, paddingVertical: 4 },
  dayBadgeDark: { backgroundColor: '#F5A800' },
  dayBadgeText: { fontSize: 11, fontWeight: '700', fontFamily: fonts.bodySemiBold, color: '#FFFFFF' },
  dayBadgeTextDark: { color: '#4A0A0B' },
  schedTime: { fontSize: 13, fontFamily: fonts.body, color: '#555' },
  removeBtn: { padding: 4 },
  schedRoom: { fontSize: 11, fontFamily: fonts.body, color: '#999', marginLeft: 'auto', paddingLeft: 8 },
  schedAdder: { borderWidth: 1, borderColor: '#DDD', borderStyle: 'dashed', backgroundColor: '#FAFAFA', padding: 12, marginBottom: 8 },
  schedAdderDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#0D0D10' },
  schedAdderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  daySelector: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  daySelectorDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  daySelectorText: { fontSize: 13, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#FFFFFF', flex: 1 },
  timeBoxDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  timeBoxText: { fontSize: 12, fontFamily: fonts.mono, color: '#555' },
  roomInput: { borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, fontFamily: fonts.body, color: '#333', backgroundColor: '#FFFFFF', width: 80 },
  roomInputDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215', color: '#FFF' },
  addSchedBtn: { backgroundColor: '#7B1113', width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addSchedBtnDark: { backgroundColor: '#F5A800' },
  dayOptions: { flexDirection: 'row', gap: 4, marginTop: 8, flexWrap: 'wrap' },
  dayOption: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#FFFFFF' },
  dayOptionActive: { borderColor: '#7B1113', backgroundColor: '#7B1113' },
  dayOptionActiveDark: { borderColor: '#F5A800', backgroundColor: '#F5A800' },
  dayOptionText: { fontSize: 11, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#555' },
  dayOptionTextActive: { color: '#FFFFFF' },
  dayOptionTextActiveDark: { color: '#4A0A0B' },
  createBtn: { backgroundColor: '#7B1113', paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 32 },
  createBtnDark: { backgroundColor: '#F5A800' },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  createBtnTextDark: { color: '#4A0A0B' },
})

const tpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', paddingTop: 20, paddingBottom: 24 },
  sheetDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  title: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A', textAlign: 'center', marginBottom: 16 },
  titleDark: { color: '#FFFFFF' },
  columns: { flexDirection: 'row', maxHeight: 240 },
  column: { flex: 1, borderRightWidth: 1, borderRightColor: '#F0F0F0' },
  item: { paddingVertical: 10, alignItems: 'center' },
  itemActive: { backgroundColor: 'rgba(123,17,19,0.08)' },
  itemActiveDark: { backgroundColor: 'rgba(245,168,0,0.15)' },
  itemText: { fontSize: 15, fontFamily: fonts.body, color: '#333' },
  itemTextActive: { fontFamily: fonts.bodySemiBold, color: '#7B1113' },
  itemTextActiveDark: { fontFamily: fonts.bodySemiBold, color: '#F5A800' },
  okBtn: { backgroundColor: '#7B1113', marginHorizontal: 20, marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  okBtnDark: { backgroundColor: '#F5A800' },
  okBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  okBtnTextDark: { color: '#4A0A0B' },
})
