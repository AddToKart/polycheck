import { useEffect, useState } from 'react'
import { Modal, View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
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

  if (!user) return null

  const filteredSections = selectedSubjectId
    ? sections.filter(s => s.subjectId === selectedSubjectId)
    : []

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId)
  const selectedSection = sections.find((s) => s.id === sectionId)
  const selectedParentSubject = selectedSection ? subjects.find((s) => s.id === selectedSection.subjectId) : undefined

  const handleCreate = () => {
    if (!sectionId || !selectedSection) return
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
          <MaterialIcons name="keyboard-arrow-down" size={20} color={isDark ? '#F5A800' : '#888'} />
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
                    {subj.id === selectedSubjectId && <MaterialIcons name="check" size={18} color={isDark ? '#F5A800' : '#7B1113'} />}
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
          <MaterialIcons name="keyboard-arrow-down" size={20} color={isDark ? (selectedSubject ? '#F5A800' : 'rgba(245,168,0,0.3)') : (selectedSubject ? '#888' : '#CCC')} />
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
                      {s.id === sectionId && <MaterialIcons name="check" size={18} color={isDark ? '#F5A800' : '#7B1113'} />}
                    </TouchableOpacity>
                  )
                })}
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
          <MaterialIcons name="calendar-today" size={18} color={isDark ? '#F5A800' : '#888'} />
        </TouchableOpacity>

        {/* Time row */}
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={[styles.label, isDark && styles.labelDark]}>Start Time</Text>
            <TouchableOpacity style={[styles.picker, isDark && styles.pickerDark]} onPress={() => setShowStartTime(true)}>
              <Text style={[styles.pickerText, isDark && styles.textWhite]}>{formatTime(parseInt(startTime.split(':')[0], 10), parseInt(startTime.split(':')[1], 10))}</Text>
              <MaterialIcons name="access-time" size={18} color={isDark ? '#F5A800' : '#888'} />
            </TouchableOpacity>
          </View>
          <View style={styles.half}>
            <Text style={[styles.label, isDark && styles.labelDark]}>End Time</Text>
            <TouchableOpacity style={[styles.picker, isDark && styles.pickerDark]} onPress={() => setShowEndTime(true)}>
              <Text style={[styles.pickerText, isDark && styles.textWhite]}>{formatTime(parseInt(endTime.split(':')[0], 10), parseInt(endTime.split(':')[1], 10))}</Text>
              <MaterialIcons name="access-time" size={18} color={isDark ? '#F5A800' : '#888'} />
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
          style={[styles.createBtn, isDark && styles.createBtnDark, !sectionId && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!sectionId}
          accessibilityRole="button"
          accessibilityLabel="Create session"
        >
          <MaterialIcons name="add" size={20} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
          <Text style={[styles.createBtnText, isDark && styles.createBtnTextDark]}>Create Session</Text>
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
  sheetOptionTextActiveDark: { fontFamily: fonts.bodySemiBold, color: '#F5A800' },
  optionRow: { flexDirection: 'row', gap: 0, marginTop: 2 },
  optChip: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#FFFFFF', marginRight: 6 },
  optChipActive: { borderColor: '#7B1113', backgroundColor: '#7B1113' },
  optChipDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  optChipActiveDark: { borderColor: '#F5A800', backgroundColor: '#F5A800' },
  optChipText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#666' },
  optChipTextDark: { color: 'rgba(255,255,255,0.7)' },
  optChipTextActive: { color: '#FFFFFF' },
  createBtn: { backgroundColor: '#7B1113', paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 32 },
  createBtnDark: { backgroundColor: '#F5A800' },
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
  timeItemTextActiveDark: { fontFamily: fonts.bodySemiBold, color: '#F5A800' },
  timeOkBtn: { backgroundColor: '#7B1113', marginHorizontal: 20, marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  timeOkBtnDark: { backgroundColor: '#F5A800' },
  timeOkBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  timeOkBtnTextDark: { color: '#4A0A0B' },
})
