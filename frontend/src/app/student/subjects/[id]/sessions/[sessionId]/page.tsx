'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Camera } from 'lucide-react'
import { api, requestUserLogout } from '@/lib/api-client'
import { describeMutationError } from '@/lib/run-mutation'
import { ProofPhotoGrid } from '@/components/proofs/ProofPhotoGrid'
import { ProofUploader } from '@/components/proofs/ProofUploader'
import { isProofWindowOpen } from '@polycheck/shared'
import { ErrorDisplay } from '@/lib/hooks'
import { SESSION_STATUS_LABELS, deriveSessionStatus } from '@/lib/session-status'
import type { Student, Session, Section, ProofOfClass } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function StudentSessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sectionId = params.id as string
  const sessionId = params.sessionId as string
  const [user, setUser] = useState<Student | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [section, setSection] = useState<Section | null>(null)
  const [proofs, setProofs] = useState<ProofOfClass[]>([])
  const [isQac, setIsQac] = useState(false)
  const [subject, setSubject] = useState<{ name: string; code: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    const fn = async () => {
      const cu = api.getCurrentUser()
      if (!cu || cu.role !== 'student') { router.push('/'); return }
      const student = cu as Student
      setUser(student)
      try {
        const roles = await api.getStudentRoles(student.id)
        if (active) setIsQac(roles.some(r => r.sectionId === sectionId && r.role === 'qac'))
      } catch (error) {
        if (active) {
          setLoadError(describeMutationError(error, 'Unable to load your session role.'))
        }
      }
    }
    void fn()
    return () => {
      active = false
    }
  }, [router, sectionId, reloadKey])

  useEffect(() => {
    if (!sessionId || !sectionId) return
    let active = true
    const fn = async () => {
      try {
        const sess = await api.getSession(sessionId)
        const sec = await api.getSection(sectionId)
        const subj = sec ? await api.getSubject(sec.subjectId) : null
        const p = await api.getProofsOfClass(sessionId)
        if (!active) return
        setSession(sess ?? null)
        setSection(sec ?? null)
        if (subj) setSubject({ name: subj.name, code: subj.code })
        setProofs(p)
      } catch (error) {
        if (active) {
          setLoadError(describeMutationError(error, 'Unable to load this session.'))
        }
      }
    }
    void fn()
    return () => {
      active = false
    }
  }, [sessionId, sectionId, reloadKey])

  const handleLogout = () => {
    void requestUserLogout().then((outcome) => {
      if (outcome.loggedOut) router.push('/')
    })
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <ErrorDisplay message={loadError} onRetry={() => setReloadKey((key) => key + 1)} />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!session || !section) return null

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <Sidebar user={{ ...user, email: user?.email || '' } as any} onLogout={handleLogout} backHref={`/student/subjects/${sectionId}`} backLabel="Back to Subject" />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" className="text-maroon dark:text-golden text-sm" onClick={() => router.push(`/student/subjects/${sectionId}`)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>

          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">{subject?.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
            {new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {' · '}{session.startTime} - {session.endTime}
            {session.room ? ` · ${session.room}` : ''}
          </p>

          {/* Session Info */}
          <Card className="rounded-none border-zinc-300 dark:border-zinc-800 shadow-none mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:flex md:flex-wrap md:gap-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Status</p>
                  <Badge className={session.isActive ? 'bg-green-500 text-white rounded-none' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-none'}>
                    {SESSION_STATUS_LABELS[deriveSessionStatus(session)]}
                  </Badge>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">QR Validity</p>
                  <p className="text-sm font-bold text-foreground">{session.qrValidityMinutes} min</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Grace Period</p>
                  <p className="text-sm font-bold text-foreground">{session.gracePeriodMinutes} min</p>
                </div>
                {session.room && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Room</p>
                    <p className="text-sm font-bold text-foreground">{session.room}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Proof of Class */}
          <Card className="rounded-none border-zinc-300 dark:border-zinc-800 shadow-none mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                <Camera className="w-4 h-4 text-maroon dark:text-golden" /> Proof of Class
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isQac && user ? (
                <div className="mb-4">
                  {isProofWindowOpen(session) ? (
                    <ProofUploader
                      sectionId={session.sectionId}
                      sessionId={session.id}
                      alreadyUploaded={proofs.filter((proof) => proof.uploadedBy === user.id).length}
                      uploader={user}
                      onUploaded={async () => setProofs(await api.getProofsOfClass(sessionId))}
                    />
                  ) : (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Photos can be added while this class is ongoing, until 15 minutes after it ends.
                    </p>
                  )}
                </div>
              ) : null}

              {proofs.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-4">No proof photos uploaded for this session yet.</p>
              ) : (
                <ProofPhotoGrid proofs={proofs} />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
