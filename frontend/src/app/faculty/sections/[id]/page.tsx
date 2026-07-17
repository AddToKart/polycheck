'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Search, Key, RefreshCw, Ban, UserPlus, ChevronDown, ChevronUp, Crown, Camera, Shield, Clock, XCircle, CheckCircle } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { User, Section, Student, SectionRole, SessionPermission } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/lib/hooks'

const PAGE_SIZE = 10

export default function SectionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [user, setUser] = useState<User | null>(null)
  const [section, setSection] = useState<Section | null>(null)
  const [students, setStudents] = useState<(Student & { attendance: { present: number; late: number; absent: number } })[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [isEnrollOpen, setIsEnrollOpen] = useState(false)
  const [enrollSearch, setEnrollSearch] = useState('')
  const [enrollSuccess, setEnrollSuccess] = useState('')

  const [sectionRoles, setSectionRoles] = useState<SectionRole[]>([])
  const [sessionPermissions, setSessionPermissions] = useState<SessionPermission[]>([])
  const [presidentSelectOpen, setPresidentSelectOpen] = useState(false)
  const [qacSelectOpen, setQacSelectOpen] = useState(false)
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [subjectName, setSubjectName] = useState('')
  const [subjectCode, setSubjectCode] = useState('')

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
    if (cu.role === 'teacher') api.getStudents().then(setAllStudents)
  }, [router])

  useEffect(() => {
    const init = async () => {
      const cu = api.getCurrentUser()
      if (!id) return
      const sec = await api.getSection(id)
      if (!sec) { router.push('/faculty/subjects'); return }
      if (cu && cu.role === 'teacher' && sec.teacherId !== cu.id) {
        router.push('/faculty')
        return
      }
      setSection(sec)
      setStudents(await api.getSectionStudents(id))
      if (cu?.role === 'teacher') {
        setSectionRoles(await api.getSectionRoles(id))
        setSessionPermissions(await api.getActiveSessionPermissions(id))
      }
      const subj = await api.getSubject(sec.subjectId)
      setSubjectName(subj?.name ?? '')
      setSubjectCode(subj?.code ?? '')
      setLoading(false)
    }
    init()
  }, [id, router])

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter((s) =>
      s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q)
    )
  }, [students, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => { setPage(0) }, [search])

  const enrolledIds = useMemo(() => new Set(students.map((s) => s.id)), [students])
  const enrollCandidates = useMemo(() => {
    if (!enrollSearch.trim()) return []
    const q = enrollSearch.toLowerCase()
    return allStudents.filter(
      (s) => !enrolledIds.has(s.id) && (s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q))
    )
  }, [allStudents, enrollSearch, enrolledIds])

  const handleEnrollStudent = async (targetStudentId: string, targetStudentName: string) => {
    const result = await api.enrollStudent({ sectionId: id!, studentId: targetStudentId, studentName: targetStudentName })
    if (result) {
      setEnrollSuccess(targetStudentName)
      setStudents(await api.getSectionStudents(id!))
      const sec = await api.getSection(id!)
      if (sec) setSection({ ...sec })
      setTimeout(() => setEnrollSuccess(''), 3000)
    }
  }

  const handleResetCode = async () => {
    if (!id) return
    const code = await api.resetEnrollmentCode(id)
    const sec = await api.getSection(id)
    if (sec) setSection({ ...sec })
    alert(`New enrollment code: ${code}`)
  }

  const handleDisableCode = async () => {
    if (!id) return
    if (window.confirm('Students will no longer be able to enroll using this code. Continue?')) {
      await api.disableEnrollmentCode(id)
      const sec = await api.getSection(id)
      if (sec) setSection({ ...sec })
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-pup-black">
      <LoadingSpinner size="lg" />
    </div>
  )
  if (!user || !section) return null

  const totalPresent = students.reduce((sum, s) => sum + s.attendance.present, 0)
  const totalLate = students.reduce((sum, s) => sum + s.attendance.late, 0)
  const totalAbsent = students.reduce((sum, s) => sum + s.attendance.absent, 0)

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} backHref={`/faculty/subjects/${section.subjectId}`} backLabel="Back to Subject" />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href={`/faculty/subjects/${section.subjectId}`} className="text-maroon dark:text-golden hover:underline text-sm flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Subject
            </Link>
            <div>
              <h1 className="text-2xl font-heading font-bold text-maroon-dark dark:text-white">{subjectName}</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{subjectCode} &middot; Section {section.section}</p>
            </div>
          </div>

          {/* Section Info */}
          <Card className="mb-6 border-t-4 border-t-maroon dark:border-t-golden">
            <CardContent className="pt-6">
              <div className="grid sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Room</p>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{section.room}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Semester</p>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{section.semester}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Enrolled</p>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{section.studentCount} students</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Schedule</p>
                  <div className="flex flex-wrap gap-1">
                    {section.schedule.map((sd, i) => (
                      <span key={i} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-maroon dark:text-golden px-2 py-0.5 border border-zinc-300/80 dark:border-zinc-700">
                        {sd.day} {sd.startTime}-{sd.endTime}{sd.room ? ` (${sd.room})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {user.role === 'teacher' && <>
          {/* Enrollment Code */}
          <Card className="mb-6 border-t-4 border-t-maroon dark:border-t-golden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100 text-base">
                <Key className="w-4 h-4 text-maroon dark:text-golden" />
                Enrollment Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              {section.enrollmentCode ? (
                <div className="flex items-center gap-4 mb-3 flex-wrap">
                  <span className="text-2xl font-mono font-bold text-maroon dark:text-golden tracking-wider">{section.enrollmentCode}</span>
                  {(() => {
                    if (!section.enrollmentCodeExpiry) return null
                    const expiry = new Date(section.enrollmentCodeExpiry)
                    const now = new Date()
                    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    if (daysLeft < 0) {
                      return <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800">Expired</span>
                    } else if (daysLeft <= 3) {
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                            Expires in {daysLeft}d
                          </span>
                        </div>
                      )
                    } else {
                      return <span className="text-xs text-zinc-500 dark:text-zinc-400">Expires: {expiry.toLocaleDateString()}</span>
                    }
                  })()}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic mb-3">Enrollment code is disabled</p>
              )}
              <div className="flex gap-2">
                <Button variant="default" size="sm" onClick={handleResetCode}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reset
                </Button>
                <Button variant="outline" size="sm" className="text-red-500 border-red-500 hover:bg-red-50 dark:hover:bg-red-950" onClick={handleDisableCode}>
                  <Ban className="w-3.5 h-3.5 mr-1.5" /> Disable
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Enroll Student */}
          <Card className="mb-6 border-t-4 border-t-maroon dark:border-t-golden">
            <CardHeader className="cursor-pointer" onClick={() => setIsEnrollOpen(!isEnrollOpen)}>
              <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100 text-base">
                <UserPlus className="w-4 h-4 text-maroon dark:text-golden" />
                Enroll Student
                <span className="ml-auto">
                  {isEnrollOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </CardTitle>
            </CardHeader>
            {isEnrollOpen && (
              <CardContent>
                {enrollSuccess && (
                  <div className="border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-3 mb-4 text-xs text-green-700 dark:text-green-300 font-medium">
                    Enrolled {enrollSuccess} successfully!
                  </div>
                )}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    className="pl-9"
                    value={enrollSearch}
                    onChange={(e) => setEnrollSearch(e.target.value)}
                    placeholder="Search students by name or ID..."
                  />
                </div>
                {enrollCandidates.length === 0 ? (
                  enrollSearch.trim() ? (
                    <p className="text-sm text-zinc-400 text-center py-4">No matching students found.</p>
                  ) : (
                    <p className="text-sm text-zinc-400 text-center py-4">Type a name or ID to search for students.</p>
                  )
                ) : (
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {enrollCandidates.slice(0, 10).map((s) => {
                      const isAlreadyEnrolled = enrolledIds.has(s.id)
                      return (
                        <div key={s.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 bg-maroon dark:bg-golden flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-white dark:text-maroon-dark">
                                {s.fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{s.fullName}</p>
                              <p className="text-xs text-zinc-500">{s.studentId} &middot; {s.program}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isAlreadyEnrolled ? 'outline' : 'default'}
                            disabled={isAlreadyEnrolled}
                            className="shrink-0 ml-2"
                            onClick={() => handleEnrollStudent(s.id, s.fullName)}
                          >
                            {isAlreadyEnrolled ? 'Enrolled' : 'Enroll'}
                          </Button>
                        </div>
                      )
                    })}
                    {enrollCandidates.length > 10 && (
                      <p className="text-xs text-zinc-400 text-center py-2">
                        {enrollCandidates.length - 10} more student{enrollCandidates.length - 10 !== 1 ? 's' : ''} found. Refine your search.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Section Roles */}
          <Card className="mb-6 border-t-4 border-t-maroon dark:border-t-golden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100 text-base">
                <Shield className="w-4 h-4 text-maroon dark:text-golden" />
                Section Roles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* President */}
              <div className="mb-5 pb-5 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-4 h-4 text-maroon dark:text-golden" />
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">President</span>
                </div>
                {(() => {
                  const pres = sectionRoles.find((r) => r.role === 'president')
                  if (pres) {
                    const perm = sessionPermissions.find((p) => p.studentId === pres.studentId)
                    const isExpired = perm ? Date.now() >= new Date(perm.expiresAt).getTime() : true
                    return (
                      <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 p-3 border border-zinc-200 dark:border-zinc-800 mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-maroon dark:bg-golden flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white dark:text-maroon-dark">
                              {pres.studentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{pres.studentName}</p>
                            <p className="text-[10px] text-maroon dark:text-golden font-medium">
                              {perm && !isExpired ? (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Active until {new Date(perm.expiresAt).toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-zinc-400">No active permission</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {perm && !isExpired ? (
                            <Button variant="outline" size="sm" className="text-red-500 border-red-500 text-xs" onClick={async () => {
                              await api.revokeSessionPermission(id, pres.studentId)
                              setSessionPermissions(await api.getActiveSessionPermissions(id))
                            }}>
                              <XCircle className="w-3 h-3 mr-1" /> Revoke
                            </Button>
                          ) : (
                            <Button variant="default" size="sm" className="text-xs" onClick={async () => {
                              await api.grantSessionPermission(id, pres.studentId)
                              setSessionPermissions(await api.getActiveSessionPermissions(id))
                            }}>
                              <CheckCircle className="w-3 h-3 mr-1" /> Grant 24hr
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="text-xs text-red-400 border-red-300" onClick={async () => {
                            await api.removeSectionRole(id, pres.studentId, 'president')
                            setSectionRoles(await api.getSectionRoles(id))
                          }}>Remove</Button>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div>
                      <p className="text-sm text-zinc-400 mb-2">No president assigned</p>
                      <div className="relative">
                        <Button variant="outline" size="sm" onClick={() => setPresidentSelectOpen(!presidentSelectOpen)}>
                          <Crown className="w-3 h-3 mr-1" /> Assign President
                        </Button>
                        {presidentSelectOpen && (
                          <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg z-10 max-h-48 overflow-y-auto">
                            {students.filter(s => !sectionRoles.find(r => r.studentId === s.id && r.role === 'president')).map((s) => (
                              <button key={s.id} className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm flex items-center gap-2" onClick={async () => {
                                await api.assignSectionRole(id, s.id, 'president')
                                setSectionRoles(await api.getSectionRoles(id))
                                setPresidentSelectOpen(false)
                              }}>
                                <span className="text-[10px] font-bold text-zinc-500">{s.studentId}</span>
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">{s.fullName}</span>
                              </button>
                            ))}
                            {students.filter(s => !sectionRoles.find(r => r.studentId === s.id && r.role === 'president')).length === 0 && (
                              <p className="px-3 py-2 text-xs text-zinc-400">All students are already assigned</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* QAC */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Camera className="w-4 h-4 text-maroon dark:text-golden" />
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Quality Assurance Coordinator</span>
                  <span className="text-[10px] text-zinc-400">(multiple allowed)</span>
                </div>
                {(() => {
                  const qacs = sectionRoles.filter((r) => r.role === 'qac')
                  return (
                    <>
                      {qacs.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {qacs.map((qac) => (
                            <div key={qac.id} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 border border-zinc-200 dark:border-zinc-800">
                              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{qac.studentName}</span>
                              <button className="text-red-400 hover:text-red-600" onClick={async () => {
                                await api.removeSectionRole(id, qac.studentId, 'qac')
                                setSectionRoles(await api.getSectionRoles(id))
                              }}>
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-400 mb-2">No QAC assigned</p>
                      )}
                      <div className="relative">
                        <Button variant="outline" size="sm" onClick={() => setQacSelectOpen(!qacSelectOpen)}>
                          <Camera className="w-3 h-3 mr-1" /> Assign QAC
                        </Button>
                        {qacSelectOpen && (
                          <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg z-10 max-h-48 overflow-y-auto">
                            {students.filter(s => !sectionRoles.find(r => r.studentId === s.id && r.role === 'qac')).map((s) => (
                              <button key={s.id} className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm flex items-center gap-2" onClick={async () => {
                                await api.assignSectionRole(id, s.id, 'qac')
                                setSectionRoles(await api.getSectionRoles(id))
                                setQacSelectOpen(false)
                              }}>
                                <span className="text-[10px] font-bold text-zinc-500">{s.studentId}</span>
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">{s.fullName}</span>
                              </button>
                            ))}
                            {students.filter(s => !sectionRoles.find(r => r.studentId === s.id && r.role === 'qac')).length === 0 && (
                              <p className="px-3 py-2 text-xs text-zinc-400">All students are already assigned</p>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>
            </CardContent>
          </Card>
          </>}

          {/* Attendance Overview */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="border-t-4 border-t-golden">
              <CardContent className="py-6 text-center">
                <p className="text-3xl font-bold text-golden">{totalPresent}</p>
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Present</p>
              </CardContent>
            </Card>
            <Card className="border-t-4 border-t-maroon">
              <CardContent className="py-6 text-center">
                <p className="text-3xl font-bold text-maroon">{totalLate}</p>
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Late</p>
              </CardContent>
            </Card>
            <Card className="border-t-4 border-t-maroon-dark">
              <CardContent className="py-6 text-center">
                <p className="text-3xl font-bold text-maroon-dark">{totalAbsent}</p>
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Absent</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students..."
            />
          </div>

          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            {filtered.length} student{filtered.length !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ''}
          </p>

          {/* Student List */}
          {paged.length === 0 ? (
            <p className="text-center py-12 text-zinc-400 dark:text-zinc-600">No students found.</p>
          ) : (
            <div className="space-y-2">
              {paged.map((student) => {
                const total = student.attendance.present + student.attendance.late + student.attendance.absent
                const rate = total > 0 ? Math.round((student.attendance.present / total) * 100) : 0
                return (
                  <Link
                    key={student.id}
                    href={`/faculty/students/${student.id}?sectionId=${id}`}
                    className="block bg-white dark:bg-zinc-900 border border-zinc-300/80 dark:border-zinc-800 hover:border-maroon/30 dark:hover:border-golden/30 transition-colors shadow-[0_2px_8px_rgba(123,17,19,0.02)] hover:shadow-md"
                  >
                    <div className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 bg-maroon dark:bg-golden flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-white dark:text-maroon-dark">
                          {student.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{student.fullName}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{student.studentId}</p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">{student.program}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex gap-1">
                          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-600 border-amber-200 dark:border-amber-800">
                            P {student.attendance.present}
                          </Badge>
                          <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-red-700 border-red-200 dark:border-red-800">
                            L {student.attendance.late}
                          </Badge>
                          <Badge variant="outline" className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 border-zinc-200 dark:border-zinc-700">
                            A {student.attendance.absent}
                          </Badge>
                        </div>
                        {total > 0 && (
                          <div className="w-24">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                <div className="h-full bg-golden rounded-full" style={{ width: `${rate}%` }} />
                              </div>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 w-8 text-right">{rate}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
              >
                Prev
              </Button>
              {Array.from({ length: pageCount }, (_, i) => (
                <Button
                  key={i}
                  variant={page === i ? 'default' : 'outline'}
                  size="sm"
                  className="min-w-[36px]"
                  onClick={() => setPage(i)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
                disabled={page === pageCount - 1}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
