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

type Tab = 'teachers' | 'students'

export default function UsersPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('teachers')

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'super_admin') {
      router.push('/faculty')
      return
    }
    setUser(cu)
  }, [router])

  if (!user) return null

  const teachers = api.getTeachers()
  const students = api.getStudents()

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white">User Management</h1>
            <Button>
              <Plus className="w-4 h-4" />
              Add User
            </Button>
          </div>

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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
