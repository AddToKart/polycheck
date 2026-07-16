import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/api-client'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import type { User, AttendanceRecord, DisputeReason, Section, Session, Subject } from '@polycheck/shared'

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
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [disputes, setDisputes] = useState<AttendanceRecord[]>([])
  const [sections, setSections] = useState<Record<string, Section>>({})
  const [sessions, setSessions] = useState<Record<string, Session>>({})
  
  // Filtering & Tab States
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  
  // Expand/collapse states (collapsed by default now)
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({})
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.replace('/')
      return
    }
    setUser(cu)
    void Promise.all([
      api.getSubjects(), api.getDisputedRecords(undefined, { status: 'all' }), api.getSections(), api.getSessions(),
    ]).then(([nextSubjects, nextDisputes, sectionList, sessionList]) => {
      setSubjects(nextSubjects)
      setDisputes(nextDisputes)
      setSections(Object.fromEntries(sectionList.map((section) => [section.id, section])))
      setSessions(Object.fromEntries(sessionList.map((session) => [session.id, session])))
    })
  }, [])

  if (!user) return null

  // Fetch disputes count dynamically
  const pendingCount = disputes.filter((record) => record.status === 'disputed').length
  const resolvedCount = disputes.filter((record) => record.disputeResolved).length

  // Query records with search and status filters
  const allFilteredRecords = disputes.filter((record) => {
    if (activeTab === 'pending' && record.status !== 'disputed') return false
    if (activeTab === 'resolved' && !record.disputeResolved) return false
    return !searchQuery || record.studentName.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // Apply client-side subject filter
  const records = selectedSubjectId === 'all'
    ? allFilteredRecords
    : allFilteredRecords.filter((record) => {
        const section = sections[record.sectionId]
        return section?.subjectId === selectedSubjectId
      })

  const handleResolve = async (resolution: 'accept' | 'reject' | 'override', newStatus?: 'present' | 'late' | 'absent') => {
    if (!selectedRecord) return
    try {
      const updated = await api.resolveDispute(selectedRecord.id, resolution, newStatus)
      setDisputes((previous) => previous.map((record) => record.id === updated.id ? updated : record))
      setSelectedRecord(null)
    } catch (error) {
      Alert.alert('Unable to resolve dispute', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const confirmReject = () => {
    Alert.alert('Reject Dispute', 'This will mark the student as Absent and clear the dispute flag.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => handleResolve('reject') },
    ])
  }

  const toggleSubject = (subjId: string) => {
    setExpandedSubjects((prev) => ({ ...prev, [subjId]: !prev[subjId] }))
  }

  const toggleSection = (secId: string) => {
    setExpandedSections((prev) => ({ ...prev, [secId]: !prev[secId] }))
  }

  // Helper to group records by Subject -> Section -> Session
  const getGroupedDisputes = () => {
    const groups: Record<
      string,
      {
        subjectId: string;
        subjectName: string;
        subjectCode: string;
        sections: Record<
          string,
          {
            sectionId: string;
            sectionName: string;
            sessions: Record<
              string,
              {
                sessionId: string;
                sessionDate: string;
                sessionTime: string;
                records: AttendanceRecord[];
              }
            >;
          }
        >;
      }
    > = {}

    records.forEach((record) => {
      const section = sections[record.sectionId]
      const subject = section ? subjects.find((item) => item.id === section.subjectId) : undefined
      const session = sessions[record.sessionId]

      const subjectId = subject ? subject.id : 'unknown'
      const subjectName = subject ? subject.name : 'Unknown Subject'
      const subjectCode = subject ? subject.code : 'UNKNOWN'

      const sectionId = section ? section.id : 'unknown'
      const sectionName = section ? `Section ${section.section}` : 'Unknown Section'

      const sessionId = session ? session.id : 'unknown'
      const sessionDate = new Date(record.timestamp).toLocaleDateString()
      const sessionTime = session ? `${session.startTime} - ${session.endTime}` : ''

      if (!groups[subjectId]) {
        groups[subjectId] = {
          subjectId,
          subjectName,
          subjectCode,
          sections: {},
        }
      }

      if (!groups[subjectId].sections[sectionId]) {
        groups[subjectId].sections[sectionId] = {
          sectionId,
          sectionName,
          sessions: {},
        }
      }

      if (!groups[subjectId].sections[sectionId].sessions[sessionId]) {
        groups[subjectId].sections[sectionId].sessions[sessionId] = {
          sessionId,
          sessionDate,
          sessionTime,
          records: [],
        }
      }

      groups[subjectId].sections[sectionId].sessions[sessionId].records.push(record)
    })

    return Object.values(groups).map((subjectGroup) => ({
      ...subjectGroup,
      sections: Object.values(subjectGroup.sections).map((sectionGroup) => ({
        ...sectionGroup,
        sessions: Object.values(sectionGroup.sessions),
      })),
    }))
  }

  const groupedDisputes = getGroupedDisputes()

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      {/* Page Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.heading, isDark && styles.textGolden]}>Disputed Records</Text>
        <Text style={[styles.subtitle, isDark && styles.textWhite50]}>
          {pendingCount} pending, {resolvedCount} resolved
        </Text>
      </View>

      {/* Control Filters Area */}
      <View style={[styles.filtersContainer, isDark && styles.filtersContainerDark]}>
        {/* Search Bar */}
        <View style={[styles.searchBar, isDark && styles.searchBarDark]}>
          <MaterialIcons name="search" size={20} color={isDark ? 'rgba(255, 255, 255, 0.4)' : '#888'} />
          <TextInput
            style={[styles.searchInput, isDark && styles.textWhite]}
            placeholder="Search student or ID..."
            placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.4)' : '#888'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={18} color={isDark ? '#FFF' : '#888'} />
            </TouchableOpacity>
          )}
        </View>

        {/* Subject Chips Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          <TouchableOpacity
            style={[
              styles.chip,
              selectedSubjectId === 'all' && styles.chipActive,
              selectedSubjectId === 'all' && isDark && styles.chipActiveDark,
              isDark && styles.chipDark,
            ]}
            onPress={() => setSelectedSubjectId('all')}
          >
            <Text
              style={[
                styles.chipText,
                selectedSubjectId === 'all' && styles.chipTextActive,
                selectedSubjectId === 'all' && isDark && styles.chipTextActiveDark,
                isDark && styles.textWhite70,
              ]}
            >
              All Subjects
            </Text>
          </TouchableOpacity>
          {subjects.map((subj) => (
            <TouchableOpacity
              key={subj.id}
              style={[
                styles.chip,
                selectedSubjectId === subj.id && styles.chipActive,
                selectedSubjectId === subj.id && isDark && styles.chipActiveDark,
                isDark && styles.chipDark,
              ]}
              onPress={() => setSelectedSubjectId(subj.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedSubjectId === subj.id && styles.chipTextActive,
                  selectedSubjectId === subj.id && isDark && styles.chipTextActiveDark,
                  isDark && styles.textWhite70,
                ]}
              >
                {subj.code}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Pending vs Resolved Tabs */}
        <View style={[styles.tabsRow, isDark && styles.tabsRowDark]}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'pending' && styles.tabButtonActive,
              activeTab === 'pending' && isDark && styles.tabButtonActiveDark,
            ]}
            onPress={() => setActiveTab('pending')}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'pending' && styles.tabButtonTextActive,
                activeTab === 'pending' && isDark && styles.textGolden,
                isDark && activeTab !== 'pending' && styles.textWhite50,
              ]}
            >
              Pending ({pendingCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'resolved' && styles.tabButtonActive,
              activeTab === 'resolved' && isDark && styles.tabButtonActiveDark,
            ]}
            onPress={() => setActiveTab('resolved')}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'resolved' && styles.tabButtonTextActive,
                activeTab === 'resolved' && isDark && styles.textGolden,
                isDark && activeTab !== 'resolved' && styles.textWhite50,
              ]}
            >
              Resolved History ({resolvedCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main List */}
      <ScrollView contentContainerStyle={styles.content}>
        {records.length === 0 ? (
          <View style={[styles.emptyCard, isDark && styles.cardDark]}>
            <MaterialIcons name="verified" size={48} color={isDark ? 'rgba(245, 168, 0, 0.3)' : '#CCC'} />
            <Text style={[styles.emptyText, isDark && styles.textWhite50]}>
              No {activeTab} records found
            </Text>
            <Text style={[styles.emptyHint, isDark && styles.textWhite50]}>
              Try adjusting your search query or subject filters.
            </Text>
          </View>
        ) : (
          groupedDisputes.map((subj) => {
            const subjectDisputesCount = subj.sections.reduce(
              (acc, sec) => acc + sec.sessions.reduce((acc2, sess) => acc2 + sess.records.length, 0),
              0
            )

            const isSubjExpanded = !!expandedSubjects[subj.subjectId]

            return (
              <View key={subj.subjectId} style={[styles.subjectCard, isDark && styles.subjectCardDark]}>
                {/* Subject Header */}
                <TouchableOpacity
                  style={[styles.subjectHeader, isDark && styles.subjectHeaderDark]}
                  onPress={() => toggleSubject(subj.subjectId)}
                  activeOpacity={0.8}
                >
                  <View style={styles.subjectHeaderLeft}>
                    <MaterialIcons name="menu-book" size={20} color={isDark ? '#FFDF00' : '#7B1113'} />
                    <Text style={[styles.subjectHeaderText, isDark && styles.textWhite]} numberOfLines={1}>
                      {subj.subjectName} ({subj.subjectCode})
                    </Text>
                  </View>
                  <View style={styles.subjectHeaderRight}>
                    <View style={[styles.badge, isDark && styles.badgeDark]}>
                      <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>{subjectDisputesCount}</Text>
                    </View>
                    <MaterialIcons
                      name={isSubjExpanded ? 'expand-less' : 'expand-more'}
                      size={22}
                      color={isDark ? '#FFDF00' : '#7B1113'}
                    />
                  </View>
                </TouchableOpacity>

                {/* Sections List */}
                {isSubjExpanded && (
                  <View style={styles.subjectBody}>
                    {subj.sections.map((sec) => {
                      const sectionDisputesCount = sec.sessions.reduce(
                        (acc, sess) => acc + sess.records.length,
                        0
                      )
                      const isSecExpanded = !!expandedSections[sec.sectionId]

                      return (
                        <View key={sec.sectionId} style={[styles.sectionBlock, isDark && styles.sectionBlockDark]}>
                          {/* Section Header */}
                          <TouchableOpacity
                            style={styles.sectionHeader}
                            onPress={() => toggleSection(sec.sectionId)}
                            activeOpacity={0.8}
                          >
                            <View style={styles.sectionHeaderLeft}>
                              <MaterialIcons name="layers" size={16} color={isDark ? '#FFDF00' : '#7B1113'} />
                              <Text style={[styles.sectionHeaderText, isDark && styles.textWhite]}>
                                {sec.sectionName}
                              </Text>
                            </View>
                            <View style={styles.sectionHeaderRight}>
                              <Text style={styles.sectionCount}>
                                {sectionDisputesCount} records
                              </Text>
                              <MaterialIcons
                                name={isSecExpanded ? 'expand-less' : 'expand-more'}
                                size={18}
                                color={isDark ? '#FFDF00' : '#7B1113'}
                              />
                            </View>
                          </TouchableOpacity>

                          {/* Sessions List */}
                          {isSecExpanded && (
                            <View style={[styles.sessionContainer, isDark && styles.sessionContainerDark]}>
                              {sec.sessions.map((sess) => (
                                <View key={sess.sessionId} style={styles.sessionBlock}>
                                  {/* Session Label */}
                                  <View style={styles.sessionHeaderRow}>
                                    <MaterialIcons name="event" size={14} color={isDark ? '#FFDF00' : '#7B1113'} />
                                    <Text style={[styles.sessionHeaderText, isDark && styles.textWhite70]}>
                                      {sess.sessionDate} {sess.sessionTime ? `· ${sess.sessionTime}` : ''}
                                    </Text>
                                  </View>

                                  {/* Student Record Cards */}
                                  <View style={styles.recordsList}>
                                    {sess.records.map((record) => (
                                      <TouchableOpacity
                                        key={record.id}
                                        style={[styles.recordCard, isDark && styles.cardDark]}
                                        onPress={() => setSelectedRecord(record)}
                                        activeOpacity={0.7}
                                      >
                                        <View style={styles.recordHeader}>
                                          <MaterialIcons
                                            name={record.disputeReason ? DISPUTE_ICONS[record.disputeReason] : 'warning'}
                                            size={18}
                                            color="#FFDF00"
                                          />
                                          <Text style={[styles.recordName, isDark && styles.textWhite]}>
                                            {record.studentName}
                                          </Text>
                                        </View>
                                        <View style={styles.recordDetails}>
                                          <View style={styles.recordDetailRow}>
                                            <Text style={[styles.detailLabel, isDark && styles.textWhite50]}>
                                              Reason
                                            </Text>
                                            <Text style={[styles.detailValue, { color: '#FFDF00', fontFamily: fonts.bodySemiBold }]}>
                                              {record.disputeReason ? DISPUTE_LABELS[record.disputeReason] : 'Unknown'}
                                            </Text>
                                          </View>
                                          {record.notes && (
                                            <View style={styles.recordDetailRow}>
                                              <Text style={[styles.detailLabel, isDark && styles.textWhite50]}>
                                                Notes
                                              </Text>
                                              <Text style={[styles.detailValue, isDark && styles.textWhite70]}>
                                                {record.notes}
                                              </Text>
                                            </View>
                                          )}
                                        </View>
                                        <View style={styles.recordFooter}>
                                          <Text style={[styles.tapHint, isDark && styles.textWhite50]}>
                                            {activeTab === 'pending' ? 'Tap to review' : 'View resolved details'}
                                          </Text>
                                          <MaterialIcons
                                            name="chevron-right"
                                            size={16}
                                            color={isDark ? 'rgba(255,255,255,0.3)' : '#CCC'}
                                          />
                                        </View>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )
                    })}
                  </View>
                )}
              </View>
            )
          })
        )}
      </ScrollView>

      {/* Review / Detail Modal */}
      <Modal visible={!!selectedRecord} transparent animationType="fade" onRequestClose={() => setSelectedRecord(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSelectedRecord(null)}>
          {selectedRecord && (
            <View style={[styles.reviewSheet, isDark && styles.reviewSheetDark]} onStartShouldSetResponder={() => true}>
              <MaterialIcons name="gavel" size={32} color="#FFDF00" />
              <Text style={[styles.reviewTitle, isDark && styles.textWhite]}>
                {selectedRecord.disputeResolved ? 'Dispute Archive' : 'Review Dispute'}
              </Text>
              <Text style={[styles.reviewStudentName, isDark && styles.textGolden]}>{selectedRecord.studentName}</Text>

              <View style={[styles.reviewCard, isDark && styles.reviewCardDark]}>
                {/* Resolution Status (if resolved) */}
                {selectedRecord.disputeResolved && (
                  <View style={styles.resolvedStatusRow}>
                    <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                    <Text style={styles.resolvedStatusText}>
                      Resolved as {selectedRecord.status.toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={styles.reviewRow}>
                  <Text style={[styles.reviewLabel, isDark && styles.textWhite50]}>Reason</Text>
                  <View style={styles.reviewReasonRow}>
                    <MaterialIcons
                      name={selectedRecord.disputeReason ? DISPUTE_ICONS[selectedRecord.disputeReason] : 'warning'}
                      size={16}
                      color="#FFDF00"
                    />
                    <Text style={[styles.reviewReasonText, { color: '#FFDF00' }]}>
                      {selectedRecord.disputeReason ? DISPUTE_LABELS[selectedRecord.disputeReason] : 'Unknown'}
                    </Text>
                  </View>
                </View>
                {(() => {
                  const rSec = sections[selectedRecord.sectionId]
                  const rSubj = rSec ? subjects.find((subject) => subject.id === rSec.subjectId) : undefined
                  const rSess = sessions[selectedRecord.sessionId]
                  return (
                    <>
                      <View style={styles.reviewRow}>
                        <Text style={[styles.reviewLabel, isDark && styles.textWhite50]}>Subject</Text>
                        <Text style={[styles.reviewValue, isDark && styles.textWhite70]}>
                          {rSubj ? rSubj.name : 'Unknown'}
                        </Text>
                      </View>
                      <View style={styles.reviewRow}>
                        <Text style={[styles.reviewLabel, isDark && styles.textWhite50]}>Section</Text>
                        <Text style={[styles.reviewValue, isDark && styles.textWhite70]}>
                          Section {rSec ? rSec.section : 'Unknown'}
                        </Text>
                      </View>
                      <View style={styles.reviewRow}>
                        <Text style={[styles.reviewLabel, isDark && styles.textWhite50]}>Session</Text>
                        <Text style={[styles.reviewValue, isDark && styles.textWhite70]}>
                          {new Date(selectedRecord.timestamp).toLocaleDateString()} {rSess ? `· ${rSess.startTime} - ${rSess.endTime}` : ''}
                        </Text>
                      </View>
                    </>
                  )
                })()}
                {selectedRecord.notes && (
                  <View style={styles.reviewRow}>
                    <Text style={[styles.reviewLabel, isDark && styles.textWhite50]}>Notes</Text>
                    <Text style={[styles.reviewValue, isDark && styles.textWhite70]}>{selectedRecord.notes}</Text>
                  </View>
                )}
              </View>

              {!selectedRecord.disputeResolved ? (
                <>
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
                          <Text style={[styles.overrideText, isDark && styles.overrideTextDark]}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.resolvedBanner}>
                  <Text style={[styles.resolvedBannerText, isDark && styles.textWhite70]}>
                    This dispute has been resolved and logged in history.
                  </Text>
                </View>
              )}

              <TouchableOpacity style={[styles.cancelReviewBtn, isDark && styles.cancelReviewBtnDark]} onPress={() => setSelectedRecord(null)}>
                <Text style={[styles.cancelReviewText, isDark && styles.cancelReviewTextDark]}>
                  {selectedRecord.disputeResolved ? 'Close' : 'Cancel'}
                </Text>
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  heading: { fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B' },
  subtitle: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  textWhite: { color: '#FFFFFF' },
  textWhite70: { color: 'rgba(255,255,255,0.7)' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#FFDF00' },
  content: { padding: 20, paddingBottom: 100 },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 40, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#EEE' },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  emptyText: { fontSize: 16, fontFamily: fonts.bodyBold, color: '#AAA' },
  emptyHint: { fontSize: 12, fontFamily: fonts.body, color: '#BBB', textAlign: 'center' },

  // Filters Controls Styling (sharp edges)
  filtersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    gap: 12,
  },
  filtersContainerDark: {
    backgroundColor: '#0A0A0C',
    borderBottomColor: '#1C1C21',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 0,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  searchBarDark: {
    borderColor: 'rgba(245, 168, 0, 0.3)',
    backgroundColor: '#121215',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#000',
    padding: 0,
  },
  chipsScroll: {
    paddingVertical: 4,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 0,
    backgroundColor: '#F9FAFB',
  },
  chipDark: {
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#121215',
  },
  chipActive: {
    backgroundColor: '#7B1113',
    borderColor: '#7B1113',
  },
  chipActiveDark: {
    backgroundColor: '#FFDF00',
    borderColor: '#FFDF00',
  },
  chipText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: '#6B7280',
  },
  chipTextActive: {
    color: '#FFF',
  },
  chipTextActiveDark: {
    color: '#4A0A0B',
  },

  // Segmented Tabs Styling
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    marginTop: 4,
  },
  tabsRowDark: {
    borderBottomColor: '#1C1C21',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#7B1113',
  },
  tabButtonActiveDark: {
    borderBottomColor: '#FFDF00',
  },
  tabButtonText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: '#888',
  },
  tabButtonTextActive: {
    color: '#7B1113',
  },
  
  // Subject Card layout with sharp edges
  subjectCard: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  subjectCardDark: {
    backgroundColor: '#121215',
    borderColor: 'rgba(245, 168, 0, 0.15)',
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  subjectHeaderDark: {
    backgroundColor: '#1C1C21',
    borderBottomColor: '#2C2C35',
  },
  subjectHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  subjectHeaderText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: '#4A0A0B',
    flex: 1,
  },
  subjectHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#7B1113',
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDark: {
    backgroundColor: '#FFDF00',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: fonts.bodyBold,
  },
  badgeTextDark: {
    color: '#4A0A0B',
  },
  subjectBody: {
    padding: 12,
  },

  // Section level
  sectionBlock: {
    marginBottom: 12,
    paddingBottom: 4,
  },
  sectionBlockDark: {},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: '#374151',
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCount: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: '#6B7280',
  },

  // Session level
  sessionContainer: {
    paddingLeft: 12,
    marginTop: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  sessionContainerDark: {
    borderLeftColor: 'rgba(245, 168, 0, 0.15)',
  },
  sessionBlock: {
    marginBottom: 12,
    marginTop: 4,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sessionHeaderText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: '#6B7280',
  },

  // Records list
  recordsList: {
    gap: 8,
    marginTop: 4,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  recordHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  recordName: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: '#333', flex: 1 },
  recordDetails: { gap: 4, marginLeft: 26 },
  recordDetailRow: { flexDirection: 'row', gap: 8 },
  detailLabel: { fontSize: 11, fontFamily: fonts.body, color: '#888', width: 50 },
  detailValue: { fontSize: 11, fontFamily: fonts.body, color: '#333', flex: 1 },
  recordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  tapHint: { fontSize: 9, fontFamily: fonts.body, color: '#AAA', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Modal styling
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
  reviewReasonText: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: '#FFDF00' },
  reviewValue: { fontSize: 12, fontFamily: fonts.body, color: '#333', flex: 1 },
  reviewActionsLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
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
  
  // Resolved Archive modal style
  resolvedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 4,
  },
  resolvedStatusText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: '#4CAF50',
  },
  resolvedBanner: {
    width: '100%',
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    alignItems: 'center',
  },
  resolvedBannerText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#6B7280',
    textAlign: 'center',
  },
})
