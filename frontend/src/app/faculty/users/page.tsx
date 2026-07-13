'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCog, GraduationCap, Plus } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User, Teacher, Student } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Tab = 'teachers' | 'students'

export default function UsersPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('teachers')
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [showCreateTeacher, setShowCreateTeacher] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [teacherForm, setTeacherForm] = useState({ fullName: '', email: '', password: '', department: '' })

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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create teacher account')
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
            <Button onClick={() => { setError(''); setShowCreateTeacher(true) }}>
              <Plus className="w-4 h-4" />
              Add Teacher
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
                          <Button variant="outline" size="sm" disabled={busyUserId === t.id} onClick={() => void handleSetStatus(t)}>
                            {busyUserId === t.id ? 'Saving…' : t.isActive ? 'Disable' : 'Enable'}
                          </Button>
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
                          <Button variant="outline" size="sm" disabled={busyUserId === s.id} onClick={() => void handleSetStatus(s)}>
                            {busyUserId === s.id ? 'Saving…' : s.isActive ? 'Disable' : 'Enable'}
                          </Button>
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
              <Input id="teacher-password" type="password" value={teacherForm.password} onChange={(e) => setTeacherForm((form) => ({ ...form, password: e.target.value }))} minLength={8} required />
            </div>
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateTeacher(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create Teacher'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
