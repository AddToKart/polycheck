'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCog, GraduationCap, KeyRound, Plus } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { User, Teacher, Student } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useNotifications } from '@/lib/notifications'

type Tab = 'teachers' | 'students'

export default function UsersPage() {
  const router = useRouter()
  const { addNotification } = useNotifications()
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('teachers')
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [showCreateTeacher, setShowCreateTeacher] = useState(false)
  const [showCreateStudent, setShowCreateStudent] = useState(false)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [teacherForm, setTeacherForm] = useState({ fullName: '', email: '', password: '', department: '' })
  const [studentForm, setStudentForm] = useState({
    fullName: '',
    studentId: '',
    email: '',
    password: '',
    program: '',
    yearLevel: '1',
    department: '',
  })
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' })

  const fetchData = async () => {
    const [t, s] = await Promise.all([api.getTeachers(), api.getStudents()])
    setTeachers(t)
    setStudents(s)
  }

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'super_admin') {
      router.push('/faculty')
      return
    }
    setUser(cu)
  }, [router])

  useEffect(() => {
    void fetchData()
  }, [])

  if (!user) return null

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  const handleCreateTeacher = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api.createTeacher(teacherForm)
      await fetchData()
      setTeacherForm({ fullName: '', email: '', password: '', department: '' })
      setShowCreateTeacher(false)
      addNotification('success', 'Teacher account created', 'The teacher can sign in with the temporary password.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create teacher account')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateStudent = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api.createStudent({
        ...studentForm,
        email: studentForm.email.trim() || undefined,
        yearLevel: Number(studentForm.yearLevel),
      })
      await fetchData()
      setStudentForm({ fullName: '', studentId: '', email: '', password: '', program: '', yearLevel: '1', department: '' })
      setShowCreateStudent(false)
      addNotification('success', 'Student account created', 'The student can sign in with the temporary password.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create student account')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!resetTarget) return
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError('The password confirmation does not match')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.resetUserPassword(resetTarget.id, passwordForm.password)
      setPasswordForm({ password: '', confirmPassword: '' })
      setResetTarget(null)
      addNotification('success', 'Password reset', `Password reset for ${resetTarget.fullName}; existing sessions were revoked.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reset password')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSetStatus = async (target: User) => {
    setBusyUserId(target.id)
    setError('')
    try {
      await api.setUserStatus(target.id, !target.isActive)
      await fetchData()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update account')
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white">User Management</h1>
            <Button
              onClick={() => {
                setError('')
                if (activeTab === 'teachers') {
                  setTeacherForm((form) => ({ ...form, department: form.department || user.department || '' }))
                  setShowCreateTeacher(true)
                } else {
                  setStudentForm((form) => ({ ...form, department: form.department || user.department || '' }))
                  setShowCreateStudent(true)
                }
              }}
            >
              <Plus className="w-4 h-4" />
              Add {activeTab === 'teachers' ? 'Teacher' : 'Student'}
            </Button>
          </div>

          {error && <p role="alert" className="mb-4 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

          <div className="flex items-center gap-2 mb-6">
            <Button
              variant={activeTab === 'teachers' ? 'default' : 'outline'}
              onClick={() => setActiveTab('teachers')}
            >
              <UserCog className="w-4 h-4" />
              Teachers
            </Button>
            <Button
              variant={activeTab === 'students' ? 'default' : 'outline'}
              onClick={() => setActiveTab('students')}
            >
              <GraduationCap className="w-4 h-4" />
              Students
            </Button>
          </div>

          {activeTab === 'teachers' && (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Email</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Department</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Role</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                      <th className="text-right px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((t: Teacher) => (
                      <tr key={t.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-3 text-zinc-900 dark:text-zinc-100">{t.fullName}</td>
                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">{t.email}</td>
                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">{t.department ?? '—'}</td>
                        <td className="px-6 py-3">
                          <Badge variant="default">
                            <UserCog className="w-3 h-3 mr-1" />
                            Teacher
                          </Badge>
                        </td>
                        <td className="px-6 py-3">
                          <Badge variant={t.isActive ? 'active' : 'inactive'}>
                            {t.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setError(''); setPasswordForm({ password: '', confirmPassword: '' }); setResetTarget(t) }}>
                              <KeyRound className="w-3.5 h-3.5" /> Reset password
                            </Button>
                            <Button variant="outline" size="sm" disabled={busyUserId === t.id} onClick={() => void handleSetStatus(t)}>
                              {busyUserId === t.id ? 'Saving…' : t.isActive ? 'Disable' : 'Enable'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {activeTab === 'students' && (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Student ID</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Program</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Year Level</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Role</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                      <th className="text-right px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s: Student) => (
                      <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-3 text-zinc-900 dark:text-zinc-100">{s.fullName}</td>
                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400 font-mono">{s.studentId}</td>
                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">{s.program}</td>
                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">Year {s.yearLevel}</td>
                        <td className="px-6 py-3">
                          <Badge variant="default">
                            <GraduationCap className="w-3 h-3 mr-1" />
                            Student
                          </Badge>
                        </td>
                        <td className="px-6 py-3">
                          <Badge variant={s.isActive ? 'active' : 'inactive'}>
                            {s.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setError(''); setPasswordForm({ password: '', confirmPassword: '' }); setResetTarget(s) }}>
                              <KeyRound className="w-3.5 h-3.5" /> Reset password
                            </Button>
                            <Button variant="outline" size="sm" disabled={busyUserId === s.id} onClick={() => void handleSetStatus(s)}>
                              {busyUserId === s.id ? 'Saving…' : s.isActive ? 'Disable' : 'Enable'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={showCreateTeacher} onOpenChange={setShowCreateTeacher}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create teacher account</DialogTitle>
            <DialogDescription>The teacher can sign in immediately using this email and temporary password.</DialogDescription>
          </DialogHeader>
          <form className="mt-5 space-y-4" onSubmit={handleCreateTeacher}>
            <div className="space-y-2">
              <Label htmlFor="teacher-name">Full name</Label>
              <Input id="teacher-name" value={teacherForm.fullName} onChange={(e) => setTeacherForm((form) => ({ ...form, fullName: e.target.value }))} minLength={2} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher-email">PUP email</Label>
              <Input id="teacher-email" type="email" value={teacherForm.email} onChange={(e) => setTeacherForm((form) => ({ ...form, email: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher-department">Department</Label>
              <Input id="teacher-department" value={teacherForm.department} onChange={(e) => setTeacherForm((form) => ({ ...form, department: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher-password">Temporary password</Label>
              <Input id="teacher-password" type="password" value={teacherForm.password} onChange={(e) => setTeacherForm((form) => ({ ...form, password: e.target.value }))} minLength={12} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,128}" title="Use at least 12 characters with uppercase, lowercase, number, and special character" required />
            </div>
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateTeacher(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create Teacher'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateStudent} onOpenChange={setShowCreateStudent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create student account</DialogTitle>
            <DialogDescription>The student signs in using the student ID and temporary password.</DialogDescription>
          </DialogHeader>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleCreateStudent}>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="student-name">Full name</Label>
              <Input id="student-name" value={studentForm.fullName} onChange={(e) => setStudentForm((form) => ({ ...form, fullName: e.target.value }))} minLength={2} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-number">Student ID</Label>
              <Input id="student-number" value={studentForm.studentId} onChange={(e) => setStudentForm((form) => ({ ...form, studentId: e.target.value.toUpperCase() }))} pattern="[0-9]{4}-[0-9]{5}-[A-Z]{2}-[0-9]" placeholder="2024-00001-MN-0" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-email">PUP email (optional)</Label>
              <Input id="student-email" type="email" value={studentForm.email} onChange={(e) => setStudentForm((form) => ({ ...form, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-program">Program</Label>
              <Input id="student-program" value={studentForm.program} onChange={(e) => setStudentForm((form) => ({ ...form, program: e.target.value }))} placeholder="BS Computer Science" minLength={2} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-year">Year level</Label>
              <Input id="student-year" type="number" min={1} max={8} value={studentForm.yearLevel} onChange={(e) => setStudentForm((form) => ({ ...form, yearLevel: e.target.value }))} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="student-department">Department</Label>
              <Input id="student-department" value={studentForm.department} onChange={(e) => setStudentForm((form) => ({ ...form, department: e.target.value }))} minLength={2} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="student-password">Temporary password</Label>
              <Input id="student-password" type="password" value={studentForm.password} onChange={(e) => setStudentForm((form) => ({ ...form, password: e.target.value }))} minLength={12} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,128}" title="Use at least 12 characters with uppercase, lowercase, number, and special character" required />
            </div>
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">{error}</p>}
            <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateStudent(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create Student'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={resetTarget !== null} onOpenChange={(open) => { if (!open) setResetTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a temporary password for {resetTarget?.fullName}. Every existing session for this account will be revoked immediately.</DialogDescription>
          </DialogHeader>
          <form className="mt-5 space-y-4" onSubmit={handleResetPassword}>
            <div className="space-y-2">
              <Label htmlFor="reset-password">New temporary password</Label>
              <Input id="reset-password" type="password" value={passwordForm.password} onChange={(e) => setPasswordForm((form) => ({ ...form, password: e.target.value }))} minLength={12} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,128}" title="Use at least 12 characters with uppercase, lowercase, number, and special character" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-password-confirm">Confirm password</Label>
              <Input id="reset-password-confirm" type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((form) => ({ ...form, confirmPassword: e.target.value }))} minLength={12} required />
            </div>
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Resetting…' : 'Reset Password'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
