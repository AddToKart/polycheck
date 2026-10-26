'use client'

import { useEffect, useState } from 'react'
import type { User } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import {
  buildUserUpdateInput,
  editableFieldsForRole,
  editableValuesForUser,
  hasUserChanges,
  roleLabel,
  validateUserUpdate,
  type EditableUserField,
} from '@/lib/admin-users'
import { useNotifications } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const emptyValues: Record<EditableUserField, string> = {
  fullName: '',
  department: '',
  email: '',
  program: '',
  yearLevel: '',
}

interface UserProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: User | null
  onSaved: (user: User) => void
}

export function UserProfileDialog({ open, onOpenChange, target, onSaved }: UserProfileDialogProps) {
  const { addNotification } = useNotifications()
  const [values, setValues] = useState(emptyValues)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !target) return
    setValues(editableValuesForUser(target))
    setError('')
  }, [open, target])

  if (!target) return null

  const fields = new Set(editableFieldsForRole(target.role))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const validationError = validateUserUpdate(target, values)
    if (validationError) {
      setError(validationError)
      return
    }
    const input = buildUserUpdateInput(target, values)
    if (!hasUserChanges(input)) {
      addNotification('info', 'No changes', 'Update at least one profile field before saving.')
      return
    }
    setSubmitting(true)
    try {
      const updated = await api.updateUser(target.id, input)
      onSaved(updated)
      addNotification('success', 'Profile updated', `${updated.fullName}’s account details were saved.`)
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update this profile')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update the whitelisted profile fields for {target.fullName} ({roleLabel(target.role)}). Changes are audited.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          {fields.has('fullName') ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-user-name">Full name</Label>
              <Input
                id="edit-user-name"
                value={values.fullName}
                onChange={(event) => setValues((current) => ({ ...current, fullName: event.target.value }))}
                minLength={2}
                required
              />
            </div>
          ) : null}
          {fields.has('department') ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-user-department">Department</Label>
              <Input
                id="edit-user-department"
                value={values.department}
                onChange={(event) => setValues((current) => ({ ...current, department: event.target.value }))}
                required={target.role === 'student'}
              />
            </div>
          ) : null}
          {fields.has('email') ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-user-email">PUP email</Label>
              <Input
                id="edit-user-email"
                type="email"
                value={values.email}
                onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </div>
          ) : null}
          {fields.has('program') ? (
            <div className="space-y-2">
              <Label htmlFor="edit-user-program">Program</Label>
              <Input
                id="edit-user-program"
                value={values.program}
                onChange={(event) => setValues((current) => ({ ...current, program: event.target.value }))}
                minLength={2}
                required
              />
            </div>
          ) : null}
          {fields.has('yearLevel') ? (
            <div className="space-y-2">
              <Label htmlFor="edit-user-year">Year level</Label>
              <Input
                id="edit-user-year"
                type="number"
                min={1}
                max={8}
                value={values.yearLevel}
                onChange={(event) => setValues((current) => ({ ...current, yearLevel: event.target.value }))}
                required
              />
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
