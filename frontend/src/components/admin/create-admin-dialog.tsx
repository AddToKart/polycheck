'use client'

import { useEffect, useState } from 'react'
import type { CreateAdminInput, Teacher, User } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { useNotifications } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ProvisioningMode = 'promote' | 'create'

interface CreateAdminDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (user: User) => void
}

export function CreateAdminDialog({ open, onOpenChange, onCreated }: CreateAdminDialogProps) {
  const { addNotification } = useNotifications()
  const [mode, setMode] = useState<ProvisioningMode>('promote')
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [teacherId, setTeacherId] = useState('')
  const [form, setForm] = useState({ fullName: '', email: '', password: '', department: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('promote')
    setTeacherId('')
    setForm({ fullName: '', email: '', password: '', department: '' })
    setError('')
  }, [open])

  useEffect(() => {
    if (!open || mode !== 'promote') return
    let active = true
    setTeachersLoading(true)
    api
      .getTeachers()
      .then((nextTeachers) => {
        if (active) setTeachers(nextTeachers)
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load teacher accounts')
      })
      .finally(() => {
        if (active) setTeachersLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, mode])

  const selectedTeacher = teachers.find((teacher) => teacher.id === teacherId) ?? null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    let input: CreateAdminInput
    if (mode === 'promote') {
      if (!teacherId) {
        setError('Select an existing teacher to promote.')
        return
      }
      input = { userId: teacherId }
    } else {
      const fullName = form.fullName.trim()
      const email = form.email.trim()
      const password = form.password
      if (fullName.length < 2) {
        setError('Full name must be at least 2 characters.')
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Enter a valid PUP email address.')
        return
      }
      if (password.length < 12) {
        setError('The temporary password must be at least 12 characters.')
        return
      }
      input = {
        fullName,
        email,
        password,
        ...(form.department.trim() ? { department: form.department.trim() } : {}),
      }
    }
    setSubmitting(true)
    try {
      const created = await api.createAdmin(input)
      onCreated(created)
      addNotification(
        'success',
        mode === 'promote' ? 'Teacher promoted' : 'Super admin created',
        `${created.fullName} now has institution administration access.`,
      )
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to provision the super admin account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Super Admin</DialogTitle>
          <DialogDescription>
            Provision an institution administrator by promoting an existing teacher or creating a fresh account.
            This action is audited.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4" role="group" aria-label="Super admin provisioning mode">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'promote' ? 'default' : 'outline'}
              aria-pressed={mode === 'promote'}
              onClick={() => {
                setError('')
                setMode('promote')
              }}
            >
              Promote a teacher
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'create' ? 'default' : 'outline'}
              aria-pressed={mode === 'create'}
              onClick={() => {
                setError('')
                setMode('create')
              }}
            >
              Create new account
            </Button>
          </div>
        </div>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {mode === 'promote' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="admin-teacher">Teacher account</Label>
                <select
                  id="admin-teacher"
                  className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={teacherId}
                  onChange={(event) => setTeacherId(event.target.value)}
                  disabled={teachersLoading}
                  required
                >
                  <option value="">{teachersLoading ? 'Loading teachers…' : 'Select a teacher'}</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.fullName}
                      {teacher.email ? ` — ${teacher.email}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-zinc-500">
                The selected teacher keeps their department and gains institution administration access.
              </p>
              {selectedTeacher ? (
                <p className="border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800/50">
                  {selectedTeacher.fullName} · {selectedTeacher.department ?? 'No department'}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="admin-name">Full name</Label>
                <Input
                  id="admin-name"
                  value={form.fullName}
                  onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                  minLength={2}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">PUP email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-department">Department</Label>
                <Input
                  id="admin-department"
                  value={form.department}
                  onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Temporary password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  minLength={12}
                  pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,128}"
                  title="Use at least 12 characters with uppercase, lowercase, number, and special character"
                  required
                />
              </div>
            </>
          )}
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || (mode === 'promote' && teachersLoading)}>
              {submitting ? 'Provisioning…' : mode === 'promote' ? 'Promote to Super Admin' : 'Create Super Admin'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
