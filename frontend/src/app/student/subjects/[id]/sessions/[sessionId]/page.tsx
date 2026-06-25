'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Trash2, Upload, Clock, MapPin, Timer, Circle } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User, Student, Session, Section, SectionRole, ProofOfClass } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [showUpload, setShowUpload] = useState(false)
  const [photoDescription, setPhotoDescription] = useState('')
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'student') { router.push('/'); return }
    const student = cu as Student
    setUser(student)
    const roles = api.getStudentRoles(student.id)
    setIsQac(roles.some(r => r.sectionId === sectionId && r.role === 'qac'))
  }, [router, sectionId])

  useEffect(() => {
    if (!sessionId || !sectionId) return
    setSession(api.getSession(sessionId) ?? null)
    setSection(api.getSection(sectionId) ?? null)
    setProofs(api.getProofsOfClass(sessionId))
  }, [sessionId, sectionId])

  const handleUploadProof = () => {
    if (!user || !session) return
    const poc = api.uploadProofOfClass({
      sectionId: session.sectionId,
      sessionId: session.id,
      photoData: uploadedPhoto ?? `proof-${Date.now()}`,
      description: photoDescription || undefined,
      uploadedBy: user.id,
      uploadedByStudentName: user.fullName,
    })
    setProofs(api.getProofsOfClass(sessionId))
    setShowUpload(false)
    setPhotoDescription('')
    setUploadedPhoto(null)
  }

  const handleDeleteProof = (proofId: string) => {
    api.deleteProofOfClass(proofId)
    setProofs(api.getProofsOfClass(sessionId))
  }

  const handleLogout = () => { api.logout(); router.push('/') }

  if (!session || !section) return null

  const subj = api.getSubject(section.subjectId)

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

          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">{subj?.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
            {new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {' · '}{session.startTime} - {session.endTime}
            {session.room ? ` · ${session.room}` : ''}
          </p>

          {/* Session Info */}
          <Card className="rounded-none border-zinc-300 dark:border-zinc-800 shadow-none mb-6">
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Status</p>
                  <Badge className={session.isActive ? 'bg-green-500 text-white rounded-none' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-none'}>
                    {session.isActive ? 'Active' : 'Completed'}
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
              {isQac && (
                <div className="mb-4">
                  <Button variant="outline" size="sm" onClick={() => setShowUpload(!showUpload)}>
                    <Upload className="w-3.5 h-3.5 mr-1" /> Upload Proof Photo
                  </Button>
                  {showUpload && (
                    <div className="mt-3 p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                      <div className="mb-3">
                        <div className="w-full aspect-video bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-600 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" onClick={() => {
                          setUploadedPhoto(`proof-${Date.now()}`)
                        }}>
                          {uploadedPhoto ? (
                            <div className="text-center">
                              <Camera className="w-8 h-8 text-green-500 mx-auto mb-1" />
                              <p className="text-xs text-green-600 font-medium">Photo captured</p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <Camera className="w-8 h-8 text-zinc-400 mx-auto mb-1" />
                              <p className="text-xs text-zinc-500">Tap to capture / upload photo</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <Input
                        placeholder="Add a description (optional)"
                        value={photoDescription}
                        onChange={(e) => setPhotoDescription(e.target.value)}
                        className="mb-3 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUploadProof} disabled={!uploadedPhoto}>
                          <Upload className="w-3.5 h-3.5 mr-1" /> Submit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShowUpload(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {proofs.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-4">No proof photos uploaded for this session yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {proofs.map((poc) => (
                    <div key={poc.id} className="border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-900">
                      <div className="w-full aspect-video bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mb-2">
                        <Camera className="w-8 h-8 text-zinc-400" />
                      </div>
                      <p className="text-xs font-medium text-foreground truncate">{poc.uploadedByStudentName}</p>
                      <p className="text-[10px] text-zinc-500">{new Date(poc.uploadedAt).toLocaleString()}</p>
                      {poc.description && <p className="text-[10px] text-zinc-400 mt-1 italic">"{poc.description}"</p>}
                      {isQac && user?.id === poc.uploadedBy && (
                        <button className="mt-2 text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1" onClick={() => handleDeleteProof(poc.id)}>
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
