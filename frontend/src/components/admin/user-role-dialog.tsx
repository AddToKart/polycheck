'use client'

import { useEffect, useState } from 'react'
import type { AssignableRole, User } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import {
  assignableRoleFor,
  roleChangeCopy,
  roleChangeRequiresDepartment,
} from '@/lib/admin-users'
import { useNotifications } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface UserRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: User | null
  actorDepartment?: string
  onChanged: (user: User) => void
}

export function UserRoleDialog({
  open,
  onOpenChange,
  target,
  actorDepartment,
  onChanged,
}: UserRoleDialogProps) {
  const { addNotification } = useNotifications()
  const [department, setDepartment] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !target) return
    setDepartment(target.department ?? actorDepartment ?? '')
    setError('')
  }, [actorDepartment, open, target])

  if (!target) return null
  const nextRole: AssignableRole | null = assignableRoleFor(target)
  if (!nextRole) return null
  const copy = roleChangeCopy(target, nextRole)
  const needsDepartment = nextRole === 'teacher'

  const handleConfirm = async () => {
    setError('')
    setSubmitting(true)
    try {
      if (needsDepartment) {
        const nextDepartment = department.trim()
        if (!nextDepartment) {
          setError('Department is required before a student can become a teacher.')
          setSubmitting(false)
          return
        }
        if (roleChangeRequiresDepartment(target, nextRole) || nextDepartment !== (target.department ?? '')) {
          await api.updateUser(target.id, { department: nextDepartment })
        }
      }
      const updated = await api.changeUserRole(target.id, nextRole)
      onChanged(updated)
      addNotification(
        'success',
        'Role updated',
        `${updated.fullName} is now a ${nextRole === 'teacher' ? 'teacher' : 'student'}.`,
      )
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to change this account’s role')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.consequence}</DialogDescription>
        </DialogHeader>
        <div className="mt-5 space-y-4">
          <div className="border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="font-bold text-foreground">{target.fullName}</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-zinc-500">
              {target.role.replace('_', ' ')} → {nextRole}
            </p>
          </div>
          {needsDepartment ? (
            <div className="space-y-2">
              <Label htmlFor="role-change-department">Department</Label>
              <Input
                id="role-change-department"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                required
              />
              <p className="text-xs text-zinc-500">
                Student → teacher requires a department on the target account.
              </p>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void handleConfirm()}>
              {submitting ? 'Changing…' : copy.confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
