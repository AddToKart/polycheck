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

type PermissionChoice = 'inherit' | 'allow' | 'deny'

function choiceFor(value: boolean | null | undefined): PermissionChoice {
  if (value === null || value === undefined) return 'inherit'
  return value ? 'allow' : 'deny'
}

function valueFor(choice: PermissionChoice): boolean | null {
  return choice === 'inherit' ? null : choice === 'allow'
}

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
  const [resetPermission, setResetPermission] = useState<PermissionChoice>('inherit')
  const [unbindPermission, setUnbindPermission] = useState<PermissionChoice>('inherit')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !target) return
    setValues(editableValuesForUser(target))
    setResetPermission(choiceFor(target.canResetStudentPasswords))
    setUnbindPermission(choiceFor(target.canEmergencyUnbindDevices))
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
    if (target.role === 'teacher') {
      const nextReset = valueFor(resetPermission)
      const nextUnbind = valueFor(unbindPermission)
      if (nextReset !== (target.canResetStudentPasswords ?? null)) input.canResetStudentPasswords = nextReset
      if (nextUnbind !== (target.canEmergencyUnbindDevices ?? null)) {
        input.canEmergencyUnbindDevices = nextUnbind
      }
    }
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
          {target.role === 'teacher' ? (
            <fieldset className="space-y-4 rounded-xl border border-zinc-200 p-4 sm:col-span-2 dark:border-zinc-800">
              <legend className="px-1 text-xs font-bold uppercase tracking-widest text-zinc-500">
                Delegated classroom capabilities
              </legend>
              <div className="space-y-2">
                <Label htmlFor="edit-user-reset-permission">Student password resets</Label>
                <select
                  id="edit-user-reset-permission"
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  value={resetPermission}
                  onChange={(event) => setResetPermission(event.target.value as PermissionChoice)}
                >
                  <option value="inherit">Follow institution default</option>
                  <option value="allow">Allowed</option>
                  <option value="deny">Disabled</option>
                </select>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Issue temporary passwords to students enrolled in this teacher&apos;s sections.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-unbind-permission">Emergency device release</Label>
                <select
                  id="edit-user-unbind-permission"
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  value={unbindPermission}
                  onChange={(event) => setUnbindPermission(event.target.value as PermissionChoice)}
                >
                  <option value="inherit">Follow institution default</option>
                  <option value="allow">Allowed</option>
                  <option value="deny">Disabled</option>
                </select>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Clear a student&apos;s bound device and cooldown from this teacher&apos;s roster.
                </p>
              </div>
              <p className="text-[11px] text-zinc-400">
                Institution switches act as a master gate: a per-teacher override can restrict but never enable a
                disabled institution capability.
              </p>
            </fieldset>
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
