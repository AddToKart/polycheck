import { useEffect, useState } from 'react'
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../../services/mock-api'
import { fonts } from '../../../theme/typography'
import { useTheme } from '../../../theme/ThemeContext'
import MapView from '../../../components/MapView'
import type { User, Subject } from '@polycheck/shared'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]
const GRACE_OPTIONS = [0, 5, 10, 15, 20, 25, 30]
const TOKEN_OPTIONS = [60, 120, 180, 240, 300, 420, 600]

function pad(n: number) { return n.toString().padStart(2, '0') }

function formatTime(h: number, m: number) {
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${pad(m)} ${period}`
}

function TimePickerModal({ value, onChange, onClose }: { value: string; onChange: (t: string) => void; onClose: () => void }) {
  const [h, setH] = useState(parseInt(value.split(':')[0], 10))
  const [m, setM] = useState(parseInt(value.split(':')[1], 10))

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.timeSheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.timeSheetTitle}>Select Time</Text>
          <View style={styles.timeColumns}>
            <ScrollView style={styles.timeColumn} showsVerticalScrollIndicator={false}>
              {HOURS.map((hour) => (
                <TouchableOpacity
                  key={hour}
                  style={[styles.timeItem, h === hour && styles.timeItemActive]}
                  onPress={() => setH(hour)}
                >
                  <Text style={[styles.timeItemText, h === hour && styles.timeItemTextActive]}>
                    {formatTime(hour, 0)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView style={styles.timeColumn} showsVerticalScrollIndicator={false}>
              {MINUTES.map((min) => (
                <TouchableOpacity
                  key={min}
                  style={[styles.timeItem, m === min && styles.timeItemActive]}
                  onPress={() => setM(min)}
                >
                  <Text style={[styles.timeItemText, m === min && styles.timeItemTextActive]}>
                    :{pad(min)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity
            style={styles.timeOkBtn}
            onPress={() => { onChange(`${pad(h)}:${pad(m)}`); onClose() }}
          >
            <Text style={styles.timeOkBtnText}>OK</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

export default function CreateSessionScreen() {
  const { isDark } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [gracePeriod, setGracePeriod] = useState(15)
  const [tokenWindow, setTokenWindow] = useState(180)
  const [latitude, setLatitude] = useState(14.5863)
  const [longitude, setLongitude] = useState(120.9777)
  const [radius, setRadius] = useState(40)
  const [showSubjectPicker, setShowSubjectPicker] = useState(false)
  const [showStartTime, setShowStartTime] = useState(false)
  const [showEndTime, setShowEndTime] = useState(false)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu) {
      setUser(cu)
      setSubjects(api.getSubjects(cu.id))
    }
  }, [])

  if (!user) return null

  const selectedSubject = subjects.find((s) => s.id === subjectId)

  const handleCreate = () => {
    if (!subjectId || !selectedSubject) return
    api.createSession({
      subjectId,
      subjectName: selectedSubject.name,
      date,
      startTime,
      endTime,
      gracePeriodMinutes: gracePeriod,
      tokenWindowSeconds: tokenWindow,
      geofence: { latitude, longitude, radiusMeters: radius },
      teacherId: user.id,
    })
    router.back()
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#F5A800' : '#7B1113'} />
        </TouchableOpacity>
        <Text style={[styles.heading, isDark && styles.headingDark]}>Create Session</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Subject */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Subject</Text>
        <TouchableOpacity
          style={[styles.picker, isDark && styles.pickerDark]}
          onPress={() => setShowSubjectPicker(!showSubjectPicker)}
        >
          <Text style={[styles.pickerText, isDark && styles.textWhite, !selectedSubject && styles.pickerPlaceholder]}>
            {selectedSubject ? `${selectedSubject.name} (${selectedSubject.code})` : 'Select a subject'}
          </Text>
          <MaterialIcons name={showSubjectPicker ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={20} color="#888" />
        </TouchableOpacity>

        <Modal visible={showSubjectPicker} transparent animationType="fade" onRequestClose={() => setShowSubjectPicker(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSubjectPicker(false)}>
            <View style={[styles.sheet, isDark && styles.sheetDark]} onStartShouldSetResponder={() => true}>
              <Text style={[styles.sheetTitle, isDark && styles.sheetTitleDark]}>Select Subject</Text>
              <ScrollView>
                {subjects.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.sheetOption, s.id === subjectId && styles.sheetOptionSelected]}
                    onPress={() => { setSubjectId(s.id); setShowSubjectPicker(false) }}
                  >
                    <Text style={[styles.sheetOptionText, isDark && styles.sheetOptionTextDark, s.id === subjectId && styles.sheetOptionTextActive]}>
                      {s.name} ({s.code})
                    </Text>
                    {s.id === subjectId && <MaterialIcons name="check" size={18} color="#7B1113" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Date */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Date</Text>
        <TouchableOpacity
          style={[styles.picker, isDark && styles.pickerDark]}
          onPress={() => {}}
        >
          <Text style={[styles.pickerText, isDark && styles.textWhite]}>{date}</Text>
          <MaterialIcons name="calendar-today" size={18} color="#888" />
        </TouchableOpacity>

        {/* Time row */}
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={[styles.label, isDark && styles.labelDark]}>Start Time</Text>
            <TouchableOpacity style={[styles.picker, isDark && styles.pickerDark]} onPress={() => setShowStartTime(true)}>
              <Text style={[styles.pickerText, isDark && styles.textWhite]}>{formatTime(parseInt(startTime.split(':')[0], 10), parseInt(startTime.split(':')[1], 10))}</Text>
              <MaterialIcons name="access-time" size={18} color="#888" />
            </TouchableOpacity>
          </View>
          <View style={styles.half}>
            <Text style={[styles.label, isDark && styles.labelDark]}>End Time</Text>
            <TouchableOpacity style={[styles.picker, isDark && styles.pickerDark]} onPress={() => setShowEndTime(true)}>
              <Text style={[styles.pickerText, isDark && styles.textWhite]}>{formatTime(parseInt(endTime.split(':')[0], 10), parseInt(endTime.split(':')[1], 10))}</Text>
              <MaterialIcons name="access-time" size={18} color="#888" />
            </TouchableOpacity>
          </View>
        </View>

        {showStartTime && <TimePickerModal value={startTime} onChange={setStartTime} onClose={() => setShowStartTime(false)} />}
        {showEndTime && <TimePickerModal value={endTime} onChange={setEndTime} onClose={() => setShowEndTime(false)} />}

        {/* Grace Period + Token Window as selector rows */}
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={[styles.label, isDark && styles.labelDark]}>Grace Period</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionRow}>
              {GRACE_OPTIONS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.optChip, gracePeriod === g && styles.optChipActive, isDark && styles.optChipDark, gracePeriod === g && isDark && styles.optChipActiveDark]}
                  onPress={() => setGracePeriod(g)}
                >
                  <Text style={[styles.optChipText, gracePeriod === g && styles.optChipTextActive]}>{g} min</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={styles.half}>
            <Text style={[styles.label, isDark && styles.labelDark]}>Token Window</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionRow}>
              {TOKEN_OPTIONS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.optChip, tokenWindow === t && styles.optChipActive, isDark && styles.optChipDark, tokenWindow === t && isDark && styles.optChipActiveDark]}
                  onPress={() => setTokenWindow(t)}
                >
                  <Text style={[styles.optChipText, tokenWindow === t && styles.optChipTextActive]}>{t < 120 ? `${t}s` : `${Math.floor(t / 60)}m`}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Geofence */}
        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Geofence</Text>
        <Text style={[styles.hint, isDark && styles.hintDark]}>Pan and zoom the map. Drag the pin or tap anywhere to set the attendance location.</Text>
        <MapView
          latitude={latitude}
          longitude={longitude}
          radius={radius}
          interactive
          onLocationChange={(lat, lng) => { setLatitude(lat); setLongitude(lng) }}
          onRadiusChange={setRadius}
        />

        {/* Create button */}
        <TouchableOpacity
          style={[styles.createBtn, !subjectId && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!subjectId}
          accessibilityRole="button"
          accessibilityLabel="Create session"
        >
          <MaterialIcons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.createBtnText}>Create Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#1A1A1A', borderBottomColor: '#222' },
  backBtn: { padding: 4, marginRight: 12 },
  heading: { flex: 1, fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A' },
  headingDark: { color: '#FFFFFF' },
  textWhite: { color: '#FFFFFF' },
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
  pickerDark: { borderColor: '#333', backgroundColor: '#1A1A1A' },
  pickerText: { fontSize: 15, fontFamily: fonts.body, color: '#333', flex: 1 },
  pickerPlaceholder: { color: '#AAA' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', paddingTop: 20, paddingBottom: 40, maxHeight: '70%' },
  sheetDark: { backgroundColor: '#1A1A1A' },
  sheetTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A', paddingHorizontal: 20, marginBottom: 12 },
  sheetTitleDark: { color: '#FFFFFF' },
  sheetOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sheetOptionSelected: { backgroundColor: 'rgba(123,17,19,0.04)' },
  sheetOptionText: { fontSize: 15, fontFamily: fonts.body, color: '#333', flex: 1 },
  sheetOptionTextDark: { color: '#FFF' },
  sheetOptionTextActive: { fontFamily: fonts.bodySemiBold, color: '#7B1113' },
  optionRow: { flexDirection: 'row', gap: 0, marginTop: 2 },
  optChip: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#FFFFFF', marginRight: 6 },
  optChipActive: { borderColor: '#7B1113', backgroundColor: '#7B1113' },
  optChipDark: { borderColor: '#444', backgroundColor: '#1A1A1A' },
  optChipActiveDark: { borderColor: '#F5A800', backgroundColor: '#F5A800' },
  optChipText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#666' },
  optChipTextActive: { color: '#FFFFFF' },
  createBtn: { backgroundColor: '#7B1113', paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 32 },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  timeSheet: { backgroundColor: '#FFFFFF', paddingTop: 20, paddingBottom: 24 },
  timeSheetTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A', textAlign: 'center', marginBottom: 16 },
  timeColumns: { flexDirection: 'row', maxHeight: 240 },
  timeColumn: { flex: 1, borderRightWidth: 1, borderRightColor: '#F0F0F0' },
  timeItem: { paddingVertical: 10, alignItems: 'center' },
  timeItemActive: { backgroundColor: 'rgba(123,17,19,0.08)' },
  timeItemText: { fontSize: 15, fontFamily: fonts.body, color: '#333' },
  timeItemTextActive: { fontFamily: fonts.bodySemiBold, color: '#7B1113' },
  timeOkBtn: { backgroundColor: '#7B1113', marginHorizontal: 20, marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  timeOkBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold },
})
