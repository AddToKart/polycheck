'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/mock-api'
import type { User, Session, AttendanceRecord, AttendanceStatus } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/StatusBadge'
import MapView from '@/components/MapView'
import {
  Activity,
  MapPin,
  QrCode,
  ClipboardList,
} from 'lucide-react'

const statusFilters: (AttendanceStatus | 'all')[] = ['all', 'present', 'late', 'absent']

export default function SessionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [filter, setFilter] = useState<AttendanceStatus | 'all'>('all')
  const [countdown, setCountdown] = useState('')

  const sessionId = params.id as string

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
    const s = api.getSession(sessionId)
    if (!s) {
      router.push('/faculty/sessions')
      return
    }
    setSession(s)
    setRecords(api.getAttendanceRecords(sessionId))
  }, [router, sessionId])

  useEffect(() => {
    if (!session || !session.isActive || !session.qrTokenExpiresAt) return
    const tick = () => {
      const diff = new Date(session.qrTokenExpiresAt!).getTime() - Date.now()
      if (diff <= 0) {
        setCountdown('Expired')
        return
      }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session])

  if (!user || !session) return null

  const filteredRecords = filter === 'all' ? records : records.filter((r) => r.status === filter)

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white mb-1">
              {session.subjectName}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              {new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {' '}&middot;{' '}
              {session.startTime} - {session.endTime}
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-maroon dark:text-golden" />
                    Session Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Status</p>
                      <Badge variant={session.isActive ? 'active' : 'inactive'}>
                        {session.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Grace Period</p>
                      <p className="text-zinc-900 dark:text-zinc-100">{session.gracePeriodMinutes} min</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Token Window</p>
                      <p className="text-zinc-900 dark:text-zinc-100">{session.tokenWindowSeconds}s</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-maroon dark:text-golden" />
                    Geofence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MapView
                    latitude={session.geofence.latitude}
                    longitude={session.geofence.longitude}
                    radius={session.geofence.radiusMeters}
                  />
                  <div className="grid grid-cols-3 gap-4 text-sm mt-4">
                    <div>
                      <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Latitude</p>
                      <p className="font-mono text-zinc-900 dark:text-zinc-100">{session.geofence.latitude}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Longitude</p>
                      <p className="font-mono text-zinc-900 dark:text-zinc-100">{session.geofence.longitude}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Radius</p>
                      <p className="font-mono text-zinc-900 dark:text-zinc-100">{session.geofence.radiusMeters}m</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-maroon dark:text-golden" />
                  QR Code
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <div className="w-48 h-48 bg-zinc-100 dark:bg-zinc-800 rounded-none flex items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-700 mb-3">
                  <div className="text-center">
                    <QrCode className="w-12 h-12 mx-auto text-zinc-400 mb-2" />
                    <p className="text-xs font-mono text-zinc-400 break-all px-2">TOKEN:{session.id}</p>
                  </div>
                </div>
                {session.isActive && countdown && (
                  <p className="text-sm">
                    <span className="text-zinc-400">Expires in: </span>
                    <span className={`font-mono font-bold ${countdown === 'Expired' ? 'text-red-500' : 'text-maroon dark:text-white'}`}>
                      {countdown}
                    </span>
                  </p>
                )}
                {!session.isActive && (
                  <p className="text-xs text-zinc-400">Activate session to generate QR</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-maroon dark:text-golden" />
                Attendance
              </CardTitle>
              <div className="flex items-center gap-1">
                {statusFilters.map((f) => (
                  <Button
                    key={f}
                    variant={filter === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Student</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">ID</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Time</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-3 text-zinc-900 dark:text-zinc-100">{r.studentName}</td>
                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400 font-mono">{r.studentId}</td>
                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">
                          {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                    {filteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-zinc-400 dark:text-zinc-500">
                          No attendance records for this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
