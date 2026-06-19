import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/mock-api'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import type { User, AttendanceRecord, DisputeReason } from '@polycheck/shared'

const DISPUTE_LABELS: Record<DisputeReason, string> = {
  outside_geofence: 'Outside Geofence',
  expired_token: 'Expired Token',
  duplicate_submission: 'Duplicate Submission',
  invalid_signature: 'Invalid Signature',
  device_mismatch: 'Device Mismatch',
  suspicious_coordinates: 'Suspicious GPS',
}

const DISPUTE_ICONS: Record<DisputeReason, keyof typeof MaterialIcons.glyphMap> = {
  outside_geofence: 'location-off',
  expired_token: 'timer-off',
  duplicate_submission: 'content-copy',
  invalid_signature: 'fingerprint',
  device_mismatch: 'devices',
  suspicious_coordinates: 'gps-fixed',
}

export default function DisputesScreen() {
  const { isDark } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.replace('/')
      return
    }
    setUser(cu)
    setRecords(api.getDisputedRecords())
  }, [])

  if (!user) return null

  const handleResolve = (resolution: 'accept' | 'reject' | 'override', newStatus?: 'present' | 'late' | 'absent') => {
    if (!selectedRecord) return
    api.resolveDispute(selectedRecord.id, resolution, newStatus)
    setRecords(api.getDisputedRecords())
    setSelectedRecord(null)
  }

  const confirmReject = () => {
    Alert.alert('Reject Dispute', 'This will mark the student as Absent and clear the dispute flag.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => handleResolve('reject') },
    ])
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.heading, isDark && styles.textGolden]}>Disputed Records</Text>
        <Text style={[styles.subtitle, isDark && styles.textWhite50]}>{records.length} record{records.length !== 1 ? 's' : ''} flagged</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {records.length === 0 ? (
          <View style={[styles.emptyCard, isDark && styles.cardDark]}>
            <MaterialIcons name="verified" size={48} color={isDark ? 'rgba(245, 168, 0, 0.3)' : '#CCC'} />
            <Text style={[styles.emptyText, isDark && styles.textWhite50]}>No disputed records</Text>
            <Text style={[styles.emptyHint, isDark && styles.textWhite50]}>All attendance records passed server validation.</Text>
          </View>
        ) : (
          records.map((record) => (
            <TouchableOpacity
              key={record.id}
              style={[styles.recordCard, isDark && styles.cardDark]}
              onPress={() => setSelectedRecord(record)}
              activeOpacity={0.7}
            >
              <View style={styles.recordHeader}>
                <MaterialIcons
                  name={record.disputeReason ? DISPUTE_ICONS[record.disputeReason] : 'warning'}
                  size={20}
                  color="#F5A800"
                />
                <Text style={[styles.recordName, isDark && styles.textWhite]}>{record.studentName}</Text>
              </View>
              <View style={styles.recordDetails}>
                <View style={styles.recordDetailRow}>
                  <Text style={[styles.detailLabel, isDark && styles.textWhite50]}>Reason</Text>
                  <Text style={[styles.detailValue, { color: '#F5A800' }]}>
                    {record.disputeReason ? DISPUTE_LABELS[record.disputeReason] : 'Unknown'}
                  </Text>
                </View>
                <View style={styles.recordDetailRow}>
                  <Text style={[styles.detailLabel, isDark && styles.textWhite50]}>Session</Text>
                  <Text style={[styles.detailValue, isDark && styles.textWhite]}>
                    {record.sessionId} · {new Date(record.timestamp).toLocaleDateString()}
                  </Text>
                </View>
                {record.notes && (
                  <View style={styles.recordDetailRow}>
                    <Text style={[styles.detailLabel, isDark && styles.textWhite50]}>Notes</Text>
                    <Text style={[styles.detailValue, isDark && styles.textWhite70]}>{record.notes}</Text>
                  </View>
                )}
              </View>
              <View style={styles.recordFooter}>
                <Text style={[styles.tapHint, isDark && styles.textWhite50]}>Tap to review</Text>
                <MaterialIcons name="chevron-right" size={18} color={isDark ? 'rgba(255,255,255,0.3)' : '#CCC'} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={!!selectedRecord} transparent animationType="fade" onRequestClose={() => setSelectedRecord(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSelectedRecord(null)}>
          {selectedRecord && (
            <View style={[styles.reviewSheet, isDark && styles.reviewSheetDark]} onStartShouldSetResponder={() => true}>
              <MaterialIcons name="gavel" size={32} color="#F5A800" />
              <Text style={[styles.reviewTitle, isDark && styles.textWhite]}>Review Dispute</Text>
              <Text style={[styles.reviewStudentName, isDark && styles.textGolden]}>{selectedRecord.studentName}</Text>

              <View style={[styles.reviewCard, isDark && styles.reviewCardDark]}>
                <View style={styles.reviewRow}>
                  <Text style={[styles.reviewLabel, isDark && styles.textWhite50]}>Reason</Text>
                  <View style={styles.reviewReasonRow}>
                    <MaterialIcons
                      name={selectedRecord.disputeReason ? DISPUTE_ICONS[selectedRecord.disputeReason] : 'warning'}
                      size={16}
                      color="#F5A800"
                    />
                    <Text style={[styles.reviewReasonText, { color: '#F5A800' }]}>
                      {selectedRecord.disputeReason ? DISPUTE_LABELS[selectedRecord.disputeReason] : 'Unknown'}
                    </Text>
                  </View>
                </View>
                {selectedRecord.notes && (
                  <View style={styles.reviewRow}>
                    <Text style={[styles.reviewLabel, isDark && styles.textWhite50]}>Notes</Text>
                    <Text style={[styles.reviewValue, isDark && styles.textWhite70]}>{selectedRecord.notes}</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.reviewActionsLabel, isDark && styles.textWhite50]}>What would you like to do?</Text>

              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]} onPress={() => handleResolve('accept')}>
                <MaterialIcons name="check-circle" size={18} color="#FFF" />
                <Text style={styles.actionText}>Accept — Keep as Present</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EF4444' }]} onPress={confirmReject}>
                <MaterialIcons name="cancel" size={18} color="#FFF" />
                <Text style={styles.actionText}>Reject — Mark as Absent</Text>
              </TouchableOpacity>

              <View style={styles.overrideRow}>
                <Text style={[styles.overrideLabel, isDark && styles.textWhite50]}>Or override to:</Text>
                <View style={styles.overrideBtns}>
                  {(['present', 'late', 'absent'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.overrideBtn, isDark && styles.overrideBtnDark]}
                      onPress={() => handleResolve('override', s)}
                    >
                      <Text style={[styles.overrideText, isDark && styles.overrideTextDark]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={[styles.cancelReviewBtn, isDark && styles.cancelReviewBtnDark]} onPress={() => setSelectedRecord(null)}>
                <Text style={[styles.cancelReviewText, isDark && styles.cancelReviewTextDark]}>Cancel</Text>
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
  header: { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  heading: { fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B' },
  subtitle: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  textWhite: { color: '#FFFFFF' },
  textWhite70: { color: 'rgba(255,255,255,0.7)' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#F5A800' },
  content: { padding: 20, paddingBottom: 100 },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 40, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#EEE' },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  emptyText: { fontSize: 16, fontFamily: fonts.bodyBold, color: '#AAA' },
  emptyHint: { fontSize: 12, fontFamily: fonts.body, color: '#BBB', textAlign: 'center' },
  recordCard: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#EEE' },
  recordHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  recordName: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: '#333', flex: 1 },
  recordDetails: { gap: 4, marginLeft: 28 },
  recordDetailRow: { flexDirection: 'row', gap: 8 },
  detailLabel: { fontSize: 11, fontFamily: fonts.body, color: '#888', width: 60 },
  detailValue: { fontSize: 11, fontFamily: fonts.body, color: '#333', flex: 1 },
  recordFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  tapHint: { fontSize: 10, fontFamily: fonts.body, color: '#AAA', textTransform: 'uppercase', letterSpacing: 0.5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  reviewSheet: { backgroundColor: '#FFFFFF', padding: 24, paddingBottom: 40, alignItems: 'center' },
  reviewSheetDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  reviewTitle: { fontSize: 20, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A', marginTop: 8 },
  reviewStudentName: { fontSize: 14, fontFamily: fonts.bodyMedium, color: '#7B1113', marginBottom: 16 },
  reviewCard: { width: '100%', backgroundColor: '#F9F9F9', padding: 12, marginBottom: 16, gap: 8 },
  reviewCardDark: { backgroundColor: '#0A0A0C' },
  reviewRow: { flexDirection: 'row', gap: 8 },
  reviewLabel: { fontSize: 11, fontFamily: fonts.body, color: '#888', width: 50 },
  reviewReasonRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  reviewReasonText: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: '#F5A800' },
  reviewValue: { fontSize: 12, fontFamily: fonts.body, color: '#333', flex: 1 },
  reviewActionsLabel: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, alignSelf: 'flex-start' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, width: '100%', marginBottom: 8 },
  actionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  overrideRow: { width: '100%', marginTop: 4, marginBottom: 16 },
  overrideLabel: { fontSize: 11, fontFamily: fonts.bodyMedium, color: '#888', marginBottom: 8 },
  overrideBtns: { flexDirection: 'row', gap: 8 },
  overrideBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#DDD' },
  overrideBtnDark: { borderColor: 'rgba(245, 168, 0, 0.3)' },
  overrideText: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: '#333' },
  overrideTextDark: { color: '#FFF' },
  cancelReviewBtn: { paddingVertical: 8 },
  cancelReviewBtnDark: {},
  cancelReviewText: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  cancelReviewTextDark: { color: 'rgba(255,255,255,0.5)' },
})
