import { useState, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { api } from '../../services/mock-api'
import { useTheme } from '../../theme/ThemeContext'
import type { AttendanceStatus, AttendanceRecord } from '@polycheck/shared'

type FilterTab = 'all' | AttendanceStatus

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'present', label: 'Present' },
  { key: 'late', label: 'Late' },
  { key: 'absent', label: 'Absent' },
  { key: 'disputed', label: 'Disputed' },
]

const sectionsMap = new Map(api.getSections().map((s) => [s.id, s]))

export default function HistoryScreen() {
  const { isDark, toggle } = useTheme()
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  const user = api.getCurrentUser()
  const student = user && 'studentId' in user
    ? (user as typeof user & { studentId: string })
    : null

  const allRecords = useMemo(
    () => (student ? api.getMyAttendance(student.id) : []),
    [student],
  )

  const filteredRecords = useMemo(
    () => activeFilter === 'all' ? allRecords : allRecords.filter((r) => r.status === activeFilter),
    [allRecords, activeFilter],
  )

  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [disputeModalVisible, setDisputeModalVisible] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeDescription, setDisputeDescription] = useState('')

  const handleOpenDetail = (record: AttendanceRecord) => {
    setSelectedRecord(record)
    setDetailModalVisible(true)
  }

  const handleOpenDispute = () => {
    setDetailModalVisible(false)
    setDisputeReason('')
    setDisputeDescription('')
    setTimeout(() => setDisputeModalVisible(true), 300)
  }

  const handleSubmitDispute = () => {
    if (!selectedRecord || !disputeReason) {
      Alert.alert('Error', 'Please select a reason.')
      return
    }
    const result = api.submitDispute({
      recordId: selectedRecord.id,
      reason: disputeReason,
      description: disputeDescription,
    })
    if (result) {
      Alert.alert('Submitted', 'Your dispute has been recorded.')
    } else {
      Alert.alert('Error', 'Failed to submit dispute.')
    }
    setDisputeModalVisible(false)
    setSelectedRecord(null)
  }

  const handleLogout = () => {
    api.logout()
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.headerTitle, isDark && styles.textGolden]}>Audit Log</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggle} style={styles.iconBtn} accessibilityLabel="Toggle theme">
            <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} accessibilityLabel="Sign out">
            <MaterialIcons name="logout" size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Summary */}
      <View style={[styles.statsRow, isDark && styles.statsRowDark]}>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, styles.statPresent]}>{allRecords.filter((r) => r.status === 'present').length}</Text>
          <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Present</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, styles.statLate]}>{allRecords.filter((r) => r.status === 'late').length}</Text>
          <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Late</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, styles.statAbsent]}>{allRecords.filter((r) => r.status === 'absent').length}</Text>
          <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Absent</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, styles.statDisputed]}>{allRecords.filter((r) => r.status === 'disputed').length}</Text>
          <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Disputed</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterBar, isDark && styles.filterBarDark]}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveFilter(tab.key)}
            style={[
              styles.filterTab,
              isDark ? styles.filterTabInactiveDark : styles.filterTabInactive,
              activeFilter === tab.key && (isDark ? styles.filterTabActiveDark : styles.filterTabActive),
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${tab.label}`}
          >
            <Text style={[
              styles.filterText,
              isDark ? styles.filterTextInactiveDark : styles.filterTextInactive,
              activeFilter === tab.key && (isDark ? styles.filterTextActiveDark : styles.filterTextActive),
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
        {filteredRecords.length === 0 ? (
          <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
            <MaterialIcons name="search-off" size={48} color={isDark ? '#555' : '#CCC'} />
            <Text style={[styles.emptyText, isDark && styles.textWhite50]}>No records found</Text>
          </View>
        ) : (
          filteredRecords.map((record) => {
            const section = sectionsMap.get(record.sectionId)
            const subject = section ? api.getSubject(section.subjectId) : undefined
            const statusIcon = record.status === 'present' ? 'check-circle' : record.status === 'late' ? 'warning' : record.status === 'absent' ? 'cancel' : record.status === 'disputed' ? 'gavel' : 'help'
            const iconColor = record.status === 'present' ? '#FFDF00' : record.status === 'late' ? (isDark ? '#FFDF00' : '#7B1113') : record.status === 'disputed' ? '#FFDF00' : (isDark ? '#EF4444' : '#4A0A0B')
            return (
              <TouchableOpacity key={record.id} onPress={() => handleOpenDetail(record)} activeOpacity={0.7}>
                <View style={[styles.recordRow, isDark && styles.recordRowDark]}>
                  <View style={styles.recordIcon}>
                    <MaterialIcons name={statusIcon as any} size={24} color={iconColor} />
                  </View>
                  <View style={styles.recordInfo}>
                    <Text style={[styles.recordSubject, isDark && styles.textWhite]}>
                      {subject?.name ?? record.sectionId}
                    </Text>
                    <View style={styles.recordMeta}>
                      <Text style={[styles.recordDate, isDark && styles.textWhite50]}>
                        {new Date(record.timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                      <Text style={[styles.recordTime, isDark && styles.textWhite50]}>
                        {new Date(record.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.badgeCol, isDark && styles.badgeColDark]}>
                    <StatusBadge status={record.status} />
                  </View>
                </View>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
      {/* Detail Modal */}
      <Modal visible={detailModalVisible} transparent animationType="fade" onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDark && { backgroundColor: '#121215' }]}>
            <Text style={[styles.modalTitle, isDark && styles.textGolden]}>Record Details</Text>
            {selectedRecord && (
              <>
                <Text style={[styles.modalLabel, isDark && styles.textWhite50]}>Subject</Text>
                <Text style={[styles.modalValue, isDark && styles.textWhite]}>
                  {(() => { const sec = sectionsMap.get(selectedRecord.sectionId); const subj = sec ? api.getSubject(sec.subjectId) : undefined; return subj?.name ?? selectedRecord.sectionId })()}
                </Text>

                <Text style={[styles.modalLabel, isDark && styles.textWhite50]}>Date</Text>
                <Text style={[styles.modalValue, isDark && styles.textWhite]}>
                  {new Date(selectedRecord.timestamp).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>

                <Text style={[styles.modalLabel, isDark && styles.textWhite50]}>Time</Text>
                <Text style={[styles.modalValue, isDark && styles.textWhite]}>
                  {new Date(selectedRecord.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                </Text>

                <Text style={[styles.modalLabel, isDark && styles.textWhite50]}>Status</Text>
                <View style={{ alignSelf: 'flex-start', marginBottom: 16 }}>
                  <StatusBadge status={selectedRecord.status} />
                </View>

                {selectedRecord.status === 'disputed' && selectedRecord.notes && (
                  <>
                    <Text style={[styles.modalLabel, isDark && styles.textWhite50]}>Dispute Reason</Text>
                    <Text style={[styles.modalValue, isDark && styles.textWhite]}>{selectedRecord.notes}</Text>
                  </>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={() => setDetailModalVisible(false)}
                    style={[styles.modalBtn, styles.modalBtnSecondary]}
                  >
                    <Text style={styles.modalBtnSecondaryText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleOpenDispute}
                    disabled={selectedRecord.status === 'disputed'}
                    style={[styles.modalBtn, selectedRecord.status === 'disputed' ? styles.modalBtnDisabled : styles.modalBtnPrimary]}
                  >
                    <Text style={selectedRecord.status === 'disputed' ? styles.modalBtnDisabledText : styles.modalBtnPrimaryText}>
                      {selectedRecord.status === 'disputed' ? 'Already Disputed' : 'Dispute'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Dispute Form Modal */}
      <Modal visible={disputeModalVisible} transparent animationType="fade" onRequestClose={() => setDisputeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDark && { backgroundColor: '#121215' }]}>
            <Text style={[styles.modalTitle, isDark && styles.textGolden]}>Submit Dispute</Text>

            <Text style={[styles.modalLabel, isDark && styles.textWhite50]}>Reason</Text>
            {['outside_geofence', 'expired_token', 'duplicate_submission', 'invalid_signature', 'device_mismatch'].map((reason) => (
              <TouchableOpacity
                key={reason}
                onPress={() => setDisputeReason(reason)}
                style={[
                  styles.reasonOption,
                  isDark && styles.reasonOptionDark,
                  disputeReason === reason && (isDark ? styles.reasonOptionSelectedDark : styles.reasonOptionSelected),
                ]}
              >
                <Text style={[
                  styles.reasonOptionText,
                  isDark && styles.textWhite,
                  disputeReason === reason && { fontWeight: '700' },
                ]}>
                  {reason === 'outside_geofence' ? 'Wrong location' :
                   reason === 'expired_token' ? 'Wrong time' :
                   reason === 'duplicate_submission' ? 'I was present' :
                   reason === 'invalid_signature' ? 'Technical issue' : 'Other'}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.modalLabel, isDark && styles.textWhite50, { marginTop: 12 }]}>Description</Text>
            <TextInput
              value={disputeDescription}
              onChangeText={setDisputeDescription}
              placeholder="Describe the issue..."
              placeholderTextColor={isDark ? '#555' : '#BBB'}
              multiline
              style={[styles.modalTextInput, isDark && styles.modalTextInputDark, { height: 80 }]}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => { setDisputeModalVisible(false); setSelectedRecord(null) }}
                style={[styles.modalBtn, styles.modalBtnSecondary]}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitDispute}
                disabled={!disputeReason}
                style={[styles.modalBtn, disputeReason ? styles.modalBtnPrimary : styles.modalBtnDisabled]}
              >
                <Text style={disputeReason ? styles.modalBtnPrimaryText : styles.modalBtnDisabledText}>
                  Submit Dispute
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { isDark } = useTheme()
  const configs: Record<string, { bg: string; text: string; border?: string }> = {
    present: { bg: '#FFDF00', text: '#4A0A0B' },
    late: { bg: isDark ? 'rgba(245, 168, 0, 0.15)' : '#7B1113', text: isDark ? '#FFDF00' : '#FFFFFF', border: isDark ? '#FFDF00' : undefined },
    absent: { bg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#4A0A0B', text: isDark ? '#EF4444' : '#FFDF00', border: isDark ? '#EF4444' : undefined },
    pending: { bg: 'transparent', text: isDark ? '#FFDF00' : '#7B1113', border: isDark ? '#FFDF00' : '#7B1113' },
    disputed: { bg: '#4A0A0B', text: '#FFDF00', border: '#FFDF00' },
  }
  const c = configs[status] || configs.pending
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.bg }, c.border && { borderWidth: 2, borderColor: c.border }]}>
      <Text style={[badgeStyles.text, { color: c.text }]}>{status}</Text>
    </View>
  )
}

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 4 },
  text: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0C' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#FFFFFF', borderBottomWidth: 2, borderBottomColor: '#D4D4D8',
  },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  headerTitle: { fontSize: 24, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#7B1113' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8 },

  filterBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 16,
    backgroundColor: '#FAFAFA', borderBottomWidth: 2, borderBottomColor: '#D4D4D8',
  },
  filterBarDark: { backgroundColor: '#0D0D10', borderBottomColor: '#1C1C21' },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 2 },
  filterTabInactive: { backgroundColor: '#FFFFFF', borderColor: '#D4D4D8' },
  filterTabInactiveDark: { backgroundColor: '#121215', borderColor: 'rgba(245, 168, 0, 0.2)' },
  filterTabActive: { backgroundColor: '#7B1113', borderColor: '#7B1113' },
  filterTabActiveDark: { backgroundColor: '#FFDF00', borderColor: '#FFDF00' },
  filterText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
  filterTextInactive: { color: '#71717A' },
  filterTextInactiveDark: { color: '#A1A1AA' },
  filterTextActive: { color: '#FFFFFF' },
  filterTextActiveDark: { color: '#4A0A0B' },

  scroll: { flex: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 80, borderBottomWidth: 2, borderBottomColor: '#D4D4D8' },
  emptyStateDark: { borderBottomColor: '#1C1C21' },
  emptyText: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '700', color: '#A1A1AA', marginTop: 16 },

  recordRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    backgroundColor: '#FFFFFF', borderBottomWidth: 2, borderBottomColor: '#D4D4D8',
  },
  recordRowDark: { backgroundColor: '#121215', borderBottomColor: '#1C1C21' },
  recordIcon: { marginRight: 16 },
  recordInfo: { flex: 1, paddingRight: 16 },
  recordSubject: { fontSize: 14, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#000000', marginBottom: 4 },
  recordMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordDate: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#71717A' },
  recordTime: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#A1A1AA' },
  badgeCol: { borderLeftWidth: 2, borderLeftColor: '#E4E4E7', borderStyle: 'dashed', paddingLeft: 16, paddingVertical: 8 },
  badgeColDark: { borderLeftColor: '#1C1C21' },

  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#FFDF00' },

  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 16, paddingVertical: 16,
    backgroundColor: '#FFFFFF', borderBottomWidth: 2, borderBottomColor: '#D4D4D8',
  },
  statsRowDark: { backgroundColor: '#0D0D10', borderBottomColor: '#1C1C21' },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '700', fontFamily: 'Lora_400Regular' },
  statLabel: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#71717A', marginTop: 2 },
  statPresent: { color: '#FFDF00' },
  statLate: { color: '#7B1113' },
  statAbsent: { color: '#4A0A0B' },
  statDisputed: { color: '#4A0A0B' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 24 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#7B1113', marginBottom: 16 },
  modalLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#71717A', marginBottom: 4, marginTop: 8 },
  modalValue: { fontSize: 15, fontWeight: '600', color: '#000000', marginBottom: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderWidth: 2 },
  modalBtnPrimary: { backgroundColor: '#7B1113', borderColor: '#7B1113' },
  modalBtnSecondary: { backgroundColor: 'transparent', borderColor: '#D4D4D8' },
  modalBtnDisabled: { backgroundColor: '#CCC', borderColor: '#CCC' },
  modalBtnPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  modalBtnSecondaryText: { color: '#71717A', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  modalBtnDisabledText: { color: '#888', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  reasonOption: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#D4D4D8', marginBottom: 6 },
  reasonOptionDark: { borderColor: 'rgba(245, 168, 0, 0.2)' },
  reasonOptionSelected: { backgroundColor: '#7B1113', borderColor: '#7B1113' },
  reasonOptionSelectedDark: { backgroundColor: '#FFDF00', borderColor: '#FFDF00' },
  reasonOptionText: { fontSize: 14, color: '#333' },
  modalTextInput: { borderWidth: 1, borderColor: '#D4D4D8', borderRadius: 0, padding: 12, fontSize: 14, color: '#000', textAlignVertical: 'top', marginTop: 4 },
  modalTextInputDark: { borderColor: 'rgba(245, 168, 0, 0.2)', color: '#FFF', backgroundColor: '#121215' },
})