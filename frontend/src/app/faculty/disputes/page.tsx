'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Gavel, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  MapPin, 
  Timer, 
  Copy, 
  Fingerprint, 
  Smartphone,
  BookOpen,
  Layers,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User, AttendanceRecord, DisputeReason, Subject, Section, Session } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNotifications } from '@/lib/notifications'

const DISPUTE_LABELS: Record<DisputeReason, string> = {
  outside_geofence: 'Outside Geofence',
  expired_token: 'Expired Token',
  duplicate_submission: 'Duplicate Submission',
  invalid_signature: 'Invalid Signature',
  device_mismatch: 'Device Mismatch',
  suspicious_coordinates: 'Suspicious GPS',
}

const DISPUTE_ICONS: Record<DisputeReason, React.ElementType> = {
  outside_geofence: MapPin,
  expired_token: Timer,
  duplicate_submission: Copy,
  invalid_signature: Fingerprint,
  device_mismatch: Smartphone,
  suspicious_coordinates: AlertTriangle,
}

export default function DisputesPage() {
  const router = useRouter()
  const { addNotification } = useNotifications()
  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [allSections, setAllSections] = useState<Section[]>([])
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [allDisputes, setAllDisputes] = useState<AttendanceRecord[]>([])
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  
  // Filtering & Tab States
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')

  // Expand/collapse states (collapsed by default)
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({})
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
    const fetchData = async () => {
      const [subjectsData, sectionsData, sessionsData, disputesData] = await Promise.all([
        api.getSubjects(),
        api.getSections(),
        api.getSessions(),
        api.getDisputedRecords(),
      ])
      setSubjects(subjectsData)
      setAllSections(sectionsData)
      setAllSessions(sessionsData)
      setAllDisputes(disputesData)
    }
    fetchData()
  }, [router])

  const handleResolve = async (resolution: 'accept' | 'reject' | 'override', newStatus?: 'present' | 'late' | 'absent') => {
    if (!selectedRecord) return
    await api.resolveDispute(selectedRecord.id, resolution, newStatus)
    setAllDisputes(prev => prev.map(r =>
      r.id === selectedRecord.id
        ? { ...r, disputeResolved: true, status: newStatus || (resolution === 'accept' ? 'present' : 'absent') }
        : r
    ))
    setSelectedRecord(null)

    if (resolution === 'accept') {
      addNotification('success', 'Dispute Resolved', `${selectedRecord.studentName}'s record accepted as Present`)
    } else if (resolution === 'reject') {
      addNotification('info', 'Dispute Resolved', `${selectedRecord.studentName}'s record rejected as Absent`)
    } else if (resolution === 'override' && newStatus) {
      addNotification('info', 'Dispute Overridden', `${selectedRecord.studentName} set to ${newStatus}`)
    }
  }

  const confirmReject = () => {
    if (!selectedRecord) return
    if (confirm(`Are you sure you want to reject ${selectedRecord.studentName}'s dispute? This will set their status to Absent.`)) {
      handleResolve('reject')
    }
  }

  const toggleSubject = (subjId: string) => {
    setExpandedSubjects((prev) => ({ ...prev, [subjId]: !prev[subjId] }))
  }

  const toggleSection = (secId: string) => {
    setExpandedSections((prev) => ({ ...prev, [secId]: !prev[secId] }))
  }

  // Lookup maps
  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>()
    for (const s of subjects) map.set(s.id, s)
    return map
  }, [subjects])

  const sectionMap = useMemo(() => {
    const map = new Map<string, Section>()
    for (const s of allSections) map.set(s.id, s)
    return map
  }, [allSections])

  const sessionMap = useMemo(() => {
    const map = new Map<string, Session>()
    for (const s of allSessions) map.set(s.id, s)
    return map
  }, [allSessions])

  // Derived state
  const pendingCount = allDisputes.filter(r => !r.disputeResolved).length
  const resolvedCount = allDisputes.filter(r => r.disputeResolved).length

  const filteredByTabAndSearch = useMemo(() =>
    allDisputes.filter(r => {
      if (activeTab === 'pending' && r.disputeResolved) return false
      if (activeTab === 'resolved' && !r.disputeResolved) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!r.studentName.toLowerCase().includes(q) && !(r.studentId?.toLowerCase() || '').includes(q)) return false
      }
      return true
    }),
    [allDisputes, activeTab, searchQuery]
  )

  const records = useMemo(() =>
    selectedSubjectId === 'all'
      ? filteredByTabAndSearch
      : filteredByTabAndSearch.filter(r => {
          const sec = sectionMap.get(r.sectionId)
          return sec && sec.subjectId === selectedSubjectId
        }),
    [filteredByTabAndSearch, selectedSubjectId, sectionMap]
  )

  const groupedDisputes = useMemo(() => {
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
      const section = sectionMap.get(record.sectionId)
      const subject = section ? subjectMap.get(section.subjectId) : undefined
      const session = sessionMap.get(record.sessionId)

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
  }, [records, sectionMap, subjectMap, sessionMap])

  if (!user) return null

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F5F5F5] dark:bg-[#0A0A0C]">
      <Sidebar user={user} onLogout={() => { api.logout(); router.push('/') }} />
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#0A0A0C] border-b border-zinc-300/80 dark:border-[#1C1C21]">
          <div>
            <h1 className="text-xl font-heading font-bold text-[#4A0A0B] dark:text-[#FFDF00]">Disputed Records</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {pendingCount} pending, {resolvedCount} resolved
            </p>
          </div>
        </div>

        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {/* Segmented Tabs Control */}
          <div className="flex border-b border-zinc-300 dark:border-zinc-800">
            <button
              onClick={() => { setActiveTab('pending'); setExpandedSubjects({}); setExpandedSections({}); }}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 rounded-none focus:outline-none ${
                activeTab === 'pending'
                  ? 'border-maroon dark:border-golden text-maroon dark:text-golden'
                  : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-600'
              }`}
            >
              Pending Disputes ({pendingCount})
            </button>
            <button
              onClick={() => { setActiveTab('resolved'); setExpandedSubjects({}); setExpandedSections({}); }}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 rounded-none focus:outline-none ${
                activeTab === 'resolved'
                  ? 'border-maroon dark:border-golden text-maroon dark:text-golden'
                  : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-600'
              }`}
            >
              Resolved History ({resolvedCount})
            </button>
          </div>

          {/* Search & Subject Filters Row */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative flex items-center bg-white dark:bg-[#121215] border border-zinc-300 dark:border-zinc-800">
              <input
                type="text"
                placeholder="Search student or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-transparent text-sm focus:outline-none dark:text-white"
              />
              <Search className="w-4 h-4 text-zinc-400 absolute left-3" />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="absolute right-3 text-zinc-400 hover:text-zinc-600 text-xs font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            <select
              value={selectedSubjectId}
              onChange={(e) => { setSelectedSubjectId(e.target.value); setExpandedSubjects({}); setExpandedSections({}); }}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-800 rounded-none bg-white dark:bg-[#121215] text-sm focus:outline-none dark:text-zinc-300 cursor-pointer min-w-[200px]"
            >
              <option value="all">All Subjects</option>
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.name} ({subj.code})
                </option>
              ))}
            </select>
          </div>

          {/* Grouped Disputes Cards */}
          <div className="space-y-4">
            {records.length === 0 ? (
              <Card className="rounded-none dark:border-[rgba(245,168,0,0.15)] dark:bg-[#121215]">
                <CardContent className="p-12 text-center">
                  <CheckCircle className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
                  <h2 className="text-lg font-heading font-bold dark:text-white mb-2">No {activeTab} disputes found</h2>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Try adjusting your filters or search keywords.
                  </p>
                </CardContent>
              </Card>
            ) : (
              groupedDisputes.map((subj) => {
                const subjectDisputesCount = subj.sections.reduce(
                  (acc, sec) => acc + sec.sessions.reduce((acc2, sess) => acc2 + sess.records.length, 0),
                  0
                )

                const isSubjExpanded = !!expandedSubjects[subj.subjectId]

                return (
                  <Card 
                    key={subj.subjectId} 
                    className="rounded-none border border-zinc-200 dark:border-[rgba(245,168,0,0.15)] dark:bg-[#121215] overflow-hidden"
                  >
                    {/* Subject Header (Collapsible) */}
                    <div 
                      className="flex items-center justify-between px-5 py-4 bg-zinc-50 dark:bg-[#1C1C21] border-b border-zinc-200 dark:border-[#2C2C35] cursor-pointer select-none"
                      onClick={() => toggleSubject(subj.subjectId)}
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-[#7B1113] dark:text-[#FFDF00]" />
                        <h2 className="text-sm font-bold text-[#4A0A0B] dark:text-[#FFDF00] uppercase tracking-wide">
                          {subj.subjectName} ({subj.subjectCode})
                        </h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-[#7B1113] hover:bg-[#7B1113] dark:bg-[#FFDF00] dark:text-[#4A0A0B] rounded-none px-2.5 py-0.5 text-xs font-bold">
                          {subjectDisputesCount}
                        </Badge>
                        {isSubjExpanded ? (
                          <ChevronUp className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                        )}
                      </div>
                    </div>

                    {/* Sections List */}
                    {isSubjExpanded && (
                      <div className="p-5 space-y-6">
                        {subj.sections.map((sec) => {
                          const sectionDisputesCount = sec.sessions.reduce(
                            (acc, sess) => acc + sess.records.length,
                            0
                          )
                          const isSecExpanded = !!expandedSections[sec.sectionId]

                          return (
                            <div key={sec.sectionId} className="border-b border-dashed border-zinc-200 dark:border-zinc-800 last:border-b-0 pb-4 last:pb-0">
                              {/* Section Header */}
                              <div 
                                className="flex items-center justify-between py-2 cursor-pointer select-none"
                                onClick={() => toggleSection(sec.sectionId)}
                              >
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-zinc-400 dark:text-[#FFDF00]" />
                                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    {sec.sectionName}
                                  </h3>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                                    {sectionDisputesCount} records
                                  </span>
                                  {isSecExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                                  )}
                                </div>
                              </div>

                              {/* Sessions List */}
                              {isSecExpanded && (
                                <div className="pl-6 mt-3 ml-2 border-l border-zinc-200 dark:border-zinc-800 space-y-4">
                                  {sec.sessions.map((sess) => (
                                    <div key={sess.sessionId} className="space-y-3">
                                      {/* Session Label */}
                                      <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>
                                          Session: {sess.sessionDate} {sess.sessionTime ? `· ${sess.sessionTime}` : ''}
                                        </span>
                                      </div>

                                      {/* Dispute Record Cards */}
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {sess.records.map((record) => {
                                          const Icon = record.disputeReason ? DISPUTE_ICONS[record.disputeReason] : AlertTriangle
                                          return (
                                            <Card
                                              key={record.id}
                                              className="rounded-none border border-zinc-200 dark:border-[rgba(245,168,0,0.15)] dark:bg-[#0A0A0C] hover:bg-zinc-50/50 dark:hover:bg-[#121215] cursor-pointer transition-colors"
                                              onClick={() => setSelectedRecord(record)}
                                            >
                                              <CardContent className="p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                  <div className="flex items-center gap-2">
                                                    <Icon className="w-4 h-4 text-maroon dark:text-golden" />
                                                    <h4 className="text-xs font-bold dark:text-white">{record.studentName}</h4>
                                                  </div>
                                                  <span className="text-[10px] text-maroon dark:text-golden font-bold uppercase tracking-wider">
                                                    {record.disputeReason ? DISPUTE_LABELS[record.disputeReason] : 'Unknown'}
                                                  </span>
                                                </div>
                                                {record.notes && (
                                                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                                                    {record.notes}
                                                  </div>
                                                )}
                                                <div className="mt-3 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/80 pt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                                                  <span>{activeTab === 'pending' ? 'TAP TO REVIEW' : 'VIEW DETAILS'}</span>
                                                  <span>&rarr;</span>
                                                </div>
                                              </CardContent>
                                            </Card>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedRecord(null)}>
          <div className="bg-white dark:bg-[#121215] dark:border dark:border-[rgba(245,168,0,0.15)] p-8 max-w-md w-full mx-4 rounded-none" onClick={(e) => e.stopPropagation()}>
            <Gavel className="w-10 h-10 text-maroon dark:text-golden mx-auto mb-3" />
            <h3 className="text-lg font-heading font-bold text-center dark:text-white mb-1">
              {selectedRecord.disputeResolved ? 'Dispute Archive' : 'Review Dispute'}
            </h3>
            <p className="text-sm font-semibold text-[#7B1113] dark:text-[#FFDF00] text-center mb-4">{selectedRecord.studentName}</p>

            {(() => {
              const rSec = sectionMap.get(selectedRecord.sectionId)
              const rSubj = rSec ? subjectMap.get(rSec.subjectId) : undefined
              const rSess = sessionMap.get(selectedRecord.sessionId)
              return (
                <div className="bg-zinc-50 dark:bg-[#0A0A0C] border border-zinc-200 dark:border-zinc-800 p-4 mb-4 space-y-2 text-sm rounded-none">
                  {selectedRecord.disputeResolved && (
                    <div className="flex gap-2 pb-2 mb-2 border-b border-zinc-200 dark:border-[#2C2C35] items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      <span className="text-xs font-bold text-green-600 dark:text-[#FFDF00]">
                        RESOLVED AS {selectedRecord.status.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-zinc-500 dark:text-gray-500 shrink-0 w-16">Reason:</span>
                    <span className="text-maroon dark:text-golden font-bold">{selectedRecord.disputeReason ? DISPUTE_LABELS[selectedRecord.disputeReason] : 'Unknown'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-zinc-500 dark:text-gray-500 shrink-0 w-16">Subject:</span>
                    <span className="dark:text-gray-300">{rSubj ? rSubj.name : 'Unknown'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-zinc-500 dark:text-gray-500 shrink-0 w-16">Section:</span>
                    <span className="dark:text-gray-300">Section {rSec ? rSec.section : 'Unknown'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-zinc-500 dark:text-gray-500 shrink-0 w-16">Session:</span>
                    <span className="dark:text-gray-300">{new Date(selectedRecord.timestamp).toLocaleDateString()} {rSess ? `· ${rSess.startTime} - ${rSess.endTime}` : ''}</span>
                  </div>
                  {selectedRecord.notes && (
                    <div className="flex gap-2">
                      <span className="text-zinc-500 dark:text-gray-500 shrink-0 w-16">Notes:</span>
                      <span className="dark:text-gray-300">{selectedRecord.notes}</span>
                    </div>
                  )}
                </div>
              )
            })()}

            {!selectedRecord.disputeResolved ? (
              <>
                <p className="text-xs uppercase tracking-[0.5px] text-gray-400 dark:text-gray-500 mb-3">What would you like to do?</p>

                <Button className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 mb-2 rounded-none" onClick={() => handleResolve('accept')}>
                  <CheckCircle className="w-4 h-4" /> Accept — Keep as Present
                </Button>

                <Button className="w-full bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 mb-4 rounded-none" onClick={confirmReject}>
                  <XCircle className="w-4 h-4" /> Reject — Mark as Absent
                </Button>

                <p className="text-xs uppercase tracking-[0.5px] text-gray-400 dark:text-gray-500 mb-2">Or override to:</p>
                <div className="flex gap-2 mb-4">
                  {(['present', 'late', 'absent'] as const).map((s) => (
                    <Button key={s} variant="outline" className="flex-1 rounded-none" onClick={() => handleResolve('override', s)}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-3 bg-zinc-100 dark:bg-[#0A0A0C] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 mb-4 rounded-none">
                This dispute has been resolved and logged in history.
              </div>
            )}

            <Button variant="ghost" className="w-full text-gray-400 rounded-none" onClick={() => setSelectedRecord(null)}>
              {selectedRecord.disputeResolved ? 'Close' : 'Cancel'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
