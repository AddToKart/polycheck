'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileUp,
  GraduationCap,
  Info,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldPlus,
  UserCog,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import type { AdminUserPage, User } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { BulkImportDialog } from '@/components/import/BulkImportDialog'
import { CreateAdminDialog } from '@/components/admin/create-admin-dialog'
import { UserProfileDialog } from '@/components/admin/user-profile-dialog'
import { UserRoleDialog } from '@/components/admin/user-role-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useNotifications } from '@/lib/notifications'
import { LoadingSpinner } from '@/lib/hooks'
import {
  assignableRoleFor,
  buildUserFilters,
  canManageUser,
  emptyUserPage,
  isDepartmentScopedAdmin,
  isInstitutionAdmin,
  MAX_USER_PAGE_SIZE,
  roleLabel,
  roleTabLabel,
  USER_PAGE_SIZE,
  userPageCount,
  userPageNumber,
  userRangeLabel,
  type UserRoleTab,
  type UserStatusFilter,
} from '@/lib/admin-users'

const FILTER_DEBOUNCE_MS = 300

export default function UsersPage() {
  const router = useRouter()
  const { addNotification } = useNotifications()
  const [user, setUser] = useState<User | null>(null)
  const [tab, setTab] = useState<UserRoleTab>('teacher')
  const [searchInput, setSearchInput] = useState('')
  const [departmentInput, setDepartmentInput] = useState('')
  const [filters, setFilters] = useState({ q: '', department: '' })
  const [status, setStatus] = useState<UserStatusFilter>('')
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState<AdminUserPage>(emptyUserPage)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const [inactiveStudents, setInactiveStudents] = useState(0)
  const [activatingAll, setActivatingAll] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showCreateTeacher, setShowCreateTeacher] = useState(false)
  const [showCreateStudent, setShowCreateStudent] = useState(false)
  const [showCreateAdmin, setShowCreateAdmin] = useState(false)
  const [showImportStudents, setShowImportStudents] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [roleTarget, setRoleTarget] = useState<User | null>(null)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
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
  const firstFilterRender = useRef(true)

  const institutionAdmin = user
    ? isInstitutionAdmin({ role: user.role, scope: (user as User & { scope?: string | null }).scope })
    : false
  const departmentScoped = user
    ? isDepartmentScopedAdmin({ role: user.role, scope: (user as User & { scope?: string | null }).scope })
    : false
  const effectiveDepartment = departmentScoped ? (user?.department ?? '') : filters.department

  useEffect(() => {
    const syncUser = () => {
      const current = api.getCurrentUser()
      if (!current || current.role !== 'super_admin') {
        router.replace('/faculty')
        return
      }
      // SessionGuard revalidates in the background; keep scope-derived UI
      // (Add Super Admin, department hint, role tabs) in sync with it.
      setUser(current)
    }
    syncUser()
    window.addEventListener('polycheck-auth-changed', syncUser)
    return () => window.removeEventListener('polycheck-auth-changed', syncUser)
  }, [router])

  // Debounce text filters so each keystroke does not hit GET /users.
  useEffect(() => {
    if (firstFilterRender.current) {
      firstFilterRender.current = false
      return
    }
    const timer = window.setTimeout(() => {
      setFilters((current) =>
        current.q === searchInput && current.department === departmentInput
          ? current
          : { q: searchInput, department: departmentInput },
      )
      setOffset(0)
    }, FILTER_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput, departmentInput])

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError('')
    api
      .getUsers(
        buildUserFilters(tab, { q: filters.q, department: effectiveDepartment, status }, offset),
        { signal: controller.signal },
      )
      .then((nextPage) => {
        if (active) setPage(nextPage)
      })
      .catch((cause) => {
        if (!active || controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Unable to load user accounts')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [effectiveDepartment, filters.department, filters.q, offset, refreshToken, status, tab, user])

  useEffect(() => {
    if (!user) return
    let active = true
    api
      .getUsers({ role: 'student', status: 'inactive', limit: 1, offset: 0 })
      .then((result) => {
        if (active) setInactiveStudents(result.total)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [refreshToken, user])

  if (!user) return null

  const refresh = () => setRefreshToken((value) => value + 1)

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  const selectTab = (nextTab: UserRoleTab) => {
    setTab(nextTab)
    setOffset(0)
    setError('')
  }

  const handleCreateTeacher = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api.createTeacher(teacherForm)
      setTeacherForm({ fullName: '', email: '', password: '', department: '' })
      setShowCreateTeacher(false)
      setOffset(0)
      refresh()
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
      setStudentForm({ fullName: '', studentId: '', email: '', password: '', program: '', yearLevel: '1', department: '' })
      setShowCreateStudent(false)
      setOffset(0)
      refresh()
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
      addNotification(
        'success',
        'Password reset',
        `Password reset for ${resetTarget.fullName}; existing sessions were revoked.`,
      )
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
      refresh()
      addNotification(
        'success',
        target.isActive ? 'Account disabled' : 'Account enabled',
        `${target.fullName} ${target.isActive ? 'can no longer sign in' : 'can sign in again'}.`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update account')
    } finally {
      setBusyUserId(null)
    }
  }

  const fetchInactiveStudents = async () => {
    const collected: User[] = []
    let nextOffset = 0
    for (;;) {
      const result = await api.getUsers({
        role: 'student',
        status: 'inactive',
        limit: MAX_USER_PAGE_SIZE,
        offset: nextOffset,
      })
      collected.push(...result.data)
      if (!result.hasMore || result.data.length === 0) break
      nextOffset += result.limit
    }
    return collected
  }

  const handleActivateAllInactive = async () => {
    if (inactiveStudents === 0) return
    if (!window.confirm(`Activate ${inactiveStudents} provisioned/inactive student account(s)?`)) return
    setActivatingAll(true)
    setError('')
    let activated = 0
    try {
      const targets = await fetchInactiveStudents()
      for (const student of targets) {
        await api.setUserStatus(student.id, true)
        activated += 1
      }
      addNotification('success', 'Accounts activated', `${activated} student account(s) can now sign in.`)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `${cause.message} (${activated} activated before the failure)`
          : 'Unable to activate all accounts',
      )
    } finally {
      setActivatingAll(false)
      refresh()
    }
  }

  const openCreateDialog = () => {
    setError('')
    if (tab === 'teacher') {
      setTeacherForm((form) => ({ ...form, department: form.department || user.department || '' }))
      setShowCreateTeacher(true)
    } else if (tab === 'student') {
      setStudentForm((form) => ({ ...form, department: form.department || user.department || '' }))
      setShowCreateStudent(true)
    }
  }

  const tabs: UserRoleTab[] = institutionAdmin ? ['teacher', 'student', 'super_admin'] : ['teacher', 'student']

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          <div className="flex flex-col gap-4 mb-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Account administration
              </p>
              <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white">User Management</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {tab === 'student' ? (
                <Button variant="outline" onClick={() => setShowImportStudents(true)}>
                  <FileUp className="w-4 h-4" />
                  Import Students
                </Button>
              ) : null}
              {institutionAdmin ? (
                <Button variant="outline" onClick={() => setShowCreateAdmin(true)}>
                  <ShieldPlus className="w-4 h-4" />
                  Add Super Admin
                </Button>
              ) : null}
              {tab !== 'super_admin' ? (
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4" />
                  Add {tab === 'teacher' ? 'Teacher' : 'Student'}
                </Button>
              ) : null}
            </div>
          </div>

          {departmentScoped ? (
            <div className="mb-4 flex items-start gap-3 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <span className="font-bold">Department scope</span> — this console only lists and manages
                accounts in {user.department ?? 'your department'}. Institution-wide actions are hidden.
              </p>
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mb-4 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 mb-6" role="group" aria-label="Filter accounts by role">
            {tabs.map((entry) => (
              <Button
                key={entry}
                variant={tab === entry ? 'default' : 'outline'}
                aria-pressed={tab === entry}
                onClick={() => selectTab(entry)}
              >
                {entry === 'teacher' ? <UserCog className="w-4 h-4" /> : entry === 'student' ? <GraduationCap className="w-4 h-4" /> : <ShieldPlus className="w-4 h-4" />}
                {roleTabLabel(entry)}
              </Button>
            ))}
          </div>

          <Card className="mb-4">
            <CardContent className="grid gap-4 p-5 md:grid-cols-4">
              <div className="md:col-span-2">
                <Label htmlFor="user-search">Search accounts</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 mt-1 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    id="user-search"
                    className="mt-2 pl-9"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Name, email, or student ID"
                  />
                </div>
              </div>
              <div>
                {departmentScoped ? (
                  <>
                    <p className="text-sm font-medium leading-none">Department</p>
                    <div className="mt-2 flex h-10 items-center border border-dashed border-zinc-300 px-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                      {user.department ?? 'Department scoped'}
                    </div>
                  </>
                ) : (
                  <>
                    <Label htmlFor="user-department">Filter by department</Label>
                    <Input
                      id="user-department"
                      className="mt-2"
                      value={departmentInput}
                      onChange={(event) => setDepartmentInput(event.target.value)}
                      placeholder="e.g. CCIS"
                    />
                  </>
                )}
              </div>
              <div>
                <Label htmlFor="user-status">Filter by status</Label>
                <select
                  id="user-status"
                  className="mt-2 h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as UserStatusFilter)
                    setOffset(0)
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive (provisioned)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              {loading ? 'Loading accounts…' : userRangeLabel(page)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {tab === 'student' && inactiveStudents > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activatingAll}
                  onClick={() => void handleActivateAllInactive()}
                >
                  {activatingAll ? 'Activating…' : `Activate all inactive (${inactiveStudents})`}
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading && page.data.length === 0 ? (
                <div className="flex min-h-64 items-center justify-center">
                  <LoadingSpinner size="lg" />
                </div>
              ) : page.data.length === 0 ? (
                <div className="p-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No accounts match these filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-800/50">
                        <th className="px-5 py-3 font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                        {tab === 'student' ? (
                          <>
                            <th className="px-5 py-3 font-medium text-zinc-500 dark:text-zinc-400">Student ID</th>
                            <th className="px-5 py-3 font-medium text-zinc-500 dark:text-zinc-400">Program</th>
                            <th className="px-5 py-3 font-medium text-zinc-500 dark:text-zinc-400">Year</th>
                          </>
                        ) : (
                          <th className="px-5 py-3 font-medium text-zinc-500 dark:text-zinc-400">Email</th>
                        )}
                        <th className="px-5 py-3 font-medium text-zinc-500 dark:text-zinc-400">Department</th>
                        <th className="px-5 py-3 font-medium text-zinc-500 dark:text-zinc-400">Role</th>
                        <th className="px-5 py-3 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                        <th className="px-5 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.data.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-zinc-100 align-top hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                        >
                          <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">{row.fullName}</td>
                          {tab === 'student' ? (
                            <>
                              <td className="px-5 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">{row.studentId ?? '—'}</td>
                              <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{row.program ?? '—'}</td>
                              <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{row.yearLevel ? `Year ${row.yearLevel}` : '—'}</td>
                            </>
                          ) : (
                            <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{row.email ?? '—'}</td>
                          )}
                          <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{row.department ?? '—'}</td>
                          <td className="px-5 py-3">
                            <Badge variant="default">{roleLabel(row.role)}</Badge>
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant={row.isActive ? 'active' : 'inactive'}>
                              {row.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right">
                            {canManageUser(row) ? (
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setEditTarget(row)}>
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </Button>
                                {assignableRoleFor(row) ? (
                                  <Button variant="outline" size="sm" onClick={() => setRoleTarget(row)}>
                                    Change role
                                  </Button>
                                ) : null}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setError('')
                                    setPasswordForm({ password: '', confirmPassword: '' })
                                    setResetTarget(row)
                                  }}
                                >
                                  <KeyRound className="h-3.5 w-3.5" /> Reset password
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busyUserId === row.id}
                                  onClick={() => void handleSetStatus(row)}
                                >
                                  {busyUserId === row.id ? 'Saving…' : row.isActive ? 'Disable' : 'Enable'}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                Managed by operations
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-col gap-3 border-t border-zinc-200 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400">{userRangeLabel(page)}</span>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0 || loading}
                    onClick={() => setOffset(Math.max(0, offset - USER_PAGE_SIZE))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Page {userPageNumber(page)} of {userPageCount(page) || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!page.hasMore || loading}
                    onClick={() => setOffset(offset + USER_PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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

      <UserProfileDialog
        open={editTarget !== null}
        onOpenChange={(open) => { if (!open) setEditTarget(null) }}
        target={editTarget}
        onSaved={() => {
          setEditTarget(null)
          refresh()
        }}
      />

      <UserRoleDialog
        open={roleTarget !== null}
        onOpenChange={(open) => { if (!open) setRoleTarget(null) }}
        target={roleTarget}
        actorDepartment={user.department}
        onChanged={() => {
          setRoleTarget(null)
          refresh()
        }}
      />

      <CreateAdminDialog
        open={showCreateAdmin}
        onOpenChange={setShowCreateAdmin}
        onCreated={() => {
          setShowCreateAdmin(false)
          setSearchInput('')
          setDepartmentInput('')
          setFilters({ q: '', department: '' })
          setStatus('')
          setTab('super_admin')
          setOffset(0)
          refresh()
        }}
      />

      <BulkImportDialog
        open={showImportStudents}
        onOpenChange={setShowImportStudents}
        mode="students"
        onCompleted={refresh}
      />
    </div>
  )
}
