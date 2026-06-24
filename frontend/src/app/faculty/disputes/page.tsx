'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gavel, CheckCircle, XCircle, ArrowLeft, AlertTriangle, MapPin, Timer, Copy, Fingerprint, Smartphone } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User, AttendanceRecord, DisputeReason } from '@polycheck/shared'
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
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
    setRecords(api.getDisputedRecords())
  }, [router])

  const handleResolve = (resolution: 'accept' | 'reject' | 'override', newStatus?: 'present' | 'late' | 'absent') => {
    if (!selectedRecord) return
    api.resolveDispute(selectedRecord.id, resolution, newStatus)
    setRecords(api.getDisputedRecords())
    setSelectedRecord(null)
    if (resolution === 'accept') {
      addNotification('success', 'Dispute Resolved', `${selectedRecord.studentName}'s record accepted as Present`)
    } else if (resolution === 'reject') {
      addNotification('info', 'Dispute Resolved', `${selectedRecord.studentName}'s record rejected as Absent`)
    } else if (resolution === 'override' && newStatus) {
      addNotification('info', 'Dispute Overridden', `${selectedRecord.studentName} set to ${newStatus}`)
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F5F5F5] dark:bg-[#0A0A0C]">
      <Sidebar user={user} onLogout={() => { api.logout(); router.push('/') }} />
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#0A0A0C] border-b border-zinc-300/80 dark:border-[#1C1C21]">
          <div>
            <h1 className="text-xl font-heading font-bold text-[#4A0A0B] dark:text-[#FFDF00]">Disputed Records</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">{records.length} record{records.length !== 1 ? 's' : ''} flagged</p>
          </div>
        </div>

        <div className="p-6 space-y-4 max-w-3xl mx-auto">
          {records.length === 0 ? (
            <Card className="dark:border-[rgba(245,168,0,0.15)] dark:bg-[#121215]">
              <CardContent className="p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-lg font-heading font-bold dark:text-white mb-2">No Disputed Records</h2>
                <p className="text-sm text-gray-400 dark:text-gray-500">All attendance records passed server validation.</p>
              </CardContent>
            </Card>
          ) : (
            records.map((record) => {
              const Icon = record.disputeReason ? DISPUTE_ICONS[record.disputeReason] : AlertTriangle
              return (
                <Card
                  key={record.id}
                  className="border-l-4 border-l-maroon dark:border-l-golden dark:border-y-[rgba(245,168,0,0.15)] dark:border-r-[rgba(245,168,0,0.15)] dark:bg-[#121215] cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedRecord(record)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Icon className="w-5 h-5 text-maroon dark:text-golden" />
                      <h3 className="text-sm font-bold dark:text-white">{record.studentName}</h3>
                    </div>
                    <div className="ml-8 space-y-1 text-xs">
                      <p><span className="text-gray-400 dark:text-gray-500">Reason:</span> <span className="text-maroon dark:text-golden font-bold">{record.disputeReason ? DISPUTE_LABELS[record.disputeReason] : 'Unknown'}</span></p>
                      <p><span className="text-gray-400 dark:text-gray-500">Session:</span> <span className="dark:text-gray-300">{record.sessionId} · {new Date(record.timestamp).toLocaleDateString()}</span></p>
                      {record.notes && <p><span className="text-gray-400 dark:text-gray-500">Notes:</span> <span className="dark:text-gray-400">{record.notes}</span></p>}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>

      {/* Review Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedRecord(null)}>
          <div className="bg-white dark:bg-[#121215] dark:border dark:border-[rgba(245,168,0,0.15)] p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <Gavel className="w-10 h-10 text-maroon dark:text-golden mx-auto mb-3" />
            <h3 className="text-lg font-heading font-bold text-center dark:text-white mb-1">Review Dispute</h3>
            <p className="text-sm font-semibold text-[#7B1113] dark:text-[#FFDF00] text-center mb-4">{selectedRecord.studentName}</p>

            <div className="bg-zinc-50 dark:bg-[#0A0A0C] border border-zinc-200 dark:border-zinc-800 p-4 mb-4 space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-zinc-500 dark:text-gray-500 shrink-0 w-16">Reason:</span>
                <span className="text-maroon dark:text-golden font-bold">{selectedRecord.disputeReason ? DISPUTE_LABELS[selectedRecord.disputeReason] : 'Unknown'}</span>
              </div>
              {selectedRecord.notes && (
                <div className="flex gap-2">
                  <span className="text-zinc-500 dark:text-gray-500 shrink-0 w-16">Notes:</span>
                  <span className="dark:text-gray-300">{selectedRecord.notes}</span>
                </div>
              )}
            </div>

            <p className="text-xs uppercase tracking-[0.5px] text-gray-400 dark:text-gray-500 mb-3">What would you like to do?</p>

            <Button className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 mb-2" onClick={() => handleResolve('accept')}>
              <CheckCircle className="w-4 h-4" /> Accept — Keep as Present
            </Button>

            <Button className="w-full bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 mb-4" onClick={() => handleResolve('reject')}>
              <XCircle className="w-4 h-4" /> Reject — Mark as Absent
            </Button>

            <p className="text-xs uppercase tracking-[0.5px] text-gray-400 dark:text-gray-500 mb-2">Or override to:</p>
            <div className="flex gap-2 mb-4">
              {(['present', 'late', 'absent'] as const).map((s) => (
                <Button key={s} variant="outline" className="flex-1" onClick={() => handleResolve('override', s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>

            <Button variant="ghost" className="w-full text-gray-400" onClick={() => setSelectedRecord(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
