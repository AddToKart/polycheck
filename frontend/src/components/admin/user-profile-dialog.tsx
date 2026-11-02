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
import { Check, Ban, ShieldCheck, Wrench, GraduationCap, ClipboardList } from 'lucide-react'

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
  /** Designations and email edits are super-admin-only (separation of duties). */
  isSuperAdmin?: boolean
}

interface DesignationValues {
  isItCoordinator: boolean
  isDepartmentHead: boolean
  isUserRegistrar: boolean
}

interface DesignationCapability {
  label: string
  allowed: boolean
}

const DESIGNATION_FIELDS: Array<{
  key: keyof DesignationValues
  label: string
  icon: typeof Wrench
  badge: string
  description: string
  capabilities: DesignationCapability[]
}> = [
  {
    key: 'isItCoordinator',
    label: 'IT Coordinator',
    icon: Wrench,
    badge: 'IT Operations Suite',
    description: 'Server telemetry, Redis socket health, bug reports triage, and 503 maintenance mode shield.',
    capabilities: [
      { label: 'Live Server Telemetry', allowed: true },
      { label: '503 Maintenance Shield', allowed: true },
      { label: 'System Issue Reports Triage', allowed: true },
      { label: 'Student Grade & Attendance Records', allowed: false },
    ],
  },
  {
    key: 'isDepartmentHead',
    label: 'Department Head',
    icon: GraduationCap,
    badge: 'Academic Department Oversight',
    description: 'Department-wide academic reports, campus excuse letter queue, and at-risk student monitoring.',
    capabilities: [
      { label: 'Department Attendance Analytics & Exports', allowed: true },
      { label: 'Campus Excuse Decisions', allowed: true },
      { label: 'At-Risk Student Monitoring', allowed: true },
      { label: 'Server Maintenance & System Settings', allowed: false },
    ],
  },
  {
    key: 'isUserRegistrar',
    label: 'Registrar',
    icon: ClipboardList,
    badge: 'Registrar Suite',
    description: 'Department-scoped account administration, student/faculty creation, temporary password resets, and CSV roster imports.',
    capabilities: [
      { label: 'Department Faculty & Student Accounts', allowed: true },
      { label: 'Delegated Password Resets', allowed: true },
      { label: 'Bulk CSV Roster Import', allowed: true },
      { label: 'Infrastructure & System Metrics', allowed: false },
    ],
  },
]

export function UserProfileDialog({
  open,
  onOpenChange,
  target,
  onSaved,
  isSuperAdmin = true,
}: UserProfileDialogProps) {
  const { addNotification } = useNotifications()
  const [values, setValues] = useState(emptyValues)
  const [resetPermission, setResetPermission] = useState<PermissionChoice>('inherit')
  const [unbindPermission, setUnbindPermission] = useState<PermissionChoice>('inherit')
  const [designations, setDesignations] = useState<DesignationValues>({
    isItCoordinator: false,
    isDepartmentHead: false,
    isUserRegistrar: false,
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !target) return
    setValues(editableValuesForUser(target))
    setResetPermission(choiceFor(target.canResetStudentPasswords))
    setUnbindPermission(choiceFor(target.canEmergencyUnbindDevices))
    setDesignations({
      isItCoordinator: target.isItCoordinator === true,
      isDepartmentHead: target.isDepartmentHead === true,
      isUserRegistrar: target.isUserRegistrar === true,
    })
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
    if (isSuperAdmin && target.role === 'teacher') {
      if (designations.isItCoordinator !== (target.isItCoordinator === true)) {
        input.isItCoordinator = designations.isItCoordinator
      }
      if (designations.isDepartmentHead !== (target.isDepartmentHead === true)) {
        input.isDepartmentHead = designations.isDepartmentHead
      }
      if (designations.isUserRegistrar !== (target.isUserRegistrar === true)) {
        input.isUserRegistrar = designations.isUserRegistrar
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
      <DialogContent className="max-h-[92vh] overflow-y-auto w-full sm:max-w-3xl rounded-none border border-zinc-300 dark:border-zinc-800 p-6 sm:p-8">
        <DialogHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-maroon dark:text-golden" />
            <DialogTitle className="font-heading text-xl font-bold">Edit Account Profile</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-zinc-500">
            Configure profile fields and institutional authorizations for <strong className="text-foreground">{target.fullName}</strong> ({roleLabel(target.role)}). Changes are logged to the tamper-evident audit trail.
          </DialogDescription>
        </DialogHeader>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          {/* Identity & Core Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.has('fullName') ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-user-name" className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Full name</Label>
                <Input
                  id="edit-user-name"
                  value={values.fullName}
                  onChange={(event) => setValues((current) => ({ ...current, fullName: event.target.value }))}
                  minLength={2}
                  required
                  className="rounded-none border-zinc-300 dark:border-zinc-700"
                />
              </div>
            ) : null}

            {fields.has('department') ? (
              <div className="space-y-2">
                <Label htmlFor="edit-user-department" className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Department</Label>
                <Input
                  id="edit-user-department"
                  value={values.department}
                  onChange={(event) => setValues((current) => ({ ...current, department: event.target.value }))}
                  required={target.role === 'student'}
                  placeholder="e.g. CCIS"
                  className="rounded-none border-zinc-300 dark:border-zinc-700"
                />
              </div>
            ) : null}

            {fields.has('email') && isSuperAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="edit-user-email" className="text-xs uppercase tracking-wider text-zinc-500 font-bold">PUP email</Label>
                <Input
                  id="edit-user-email"
                  type="email"
                  value={values.email}
                  onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
                  required
                  className="rounded-none border-zinc-300 dark:border-zinc-700"
                />
              </div>
            ) : null}

            {fields.has('program') ? (
              <div className="space-y-2">
                <Label htmlFor="edit-user-program" className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Program</Label>
                <Input
                  id="edit-user-program"
                  value={values.program}
                  onChange={(event) => setValues((current) => ({ ...current, program: event.target.value }))}
                  minLength={2}
                  required
                  className="rounded-none border-zinc-300 dark:border-zinc-700"
                />
              </div>
            ) : null}

            {fields.has('yearLevel') ? (
              <div className="space-y-2">
                <Label htmlFor="edit-user-year" className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Year level</Label>
                <Input
                  id="edit-user-year"
                  type="number"
                  min={1}
                  max={8}
                  value={values.yearLevel}
                  onChange={(event) => setValues((current) => ({ ...current, yearLevel: event.target.value }))}
                  required
                  className="rounded-none border-zinc-300 dark:border-zinc-700"
                />
              </div>
            ) : null}
          </div>

          {/* Administrative Designations Section (Dual-Hat Model) */}
          {isSuperAdmin && target.role === 'teacher' ? (
            <fieldset className="rounded-none border border-zinc-300 dark:border-zinc-800 p-5 bg-zinc-50/50 dark:bg-zinc-900/30">
              <legend className="px-2 text-xs font-bold uppercase tracking-widest text-maroon dark:text-golden">
                Campus Administrative Designations (Dual-Hat Faculty)
              </legend>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                Assign institutional roles while preserving one faculty identity. Each designation unlocks an audited operational suite bound by university <strong>Separation of Duties (SoD)</strong>.
              </p>

              <div className="space-y-3">
                {DESIGNATION_FIELDS.map((field) => {
                  const Icon = field.icon
                  const isChecked = designations[field.key]
                  return (
                    <label
                      key={field.key}
                      className={`block cursor-pointer border p-4 transition-all duration-200 rounded-none ${
                        isChecked
                          ? 'border-maroon bg-white dark:border-golden dark:bg-zinc-900 shadow-sm'
                          : 'border-zinc-200 bg-white/70 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0 accent-maroon dark:accent-golden cursor-pointer"
                          checked={isChecked}
                          onChange={(event) =>
                            setDesignations((current) => ({ ...current, [field.key]: event.target.checked }))
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-maroon dark:text-golden shrink-0" />
                              <span className="text-sm font-heading font-bold text-foreground">{field.label}</span>
                            </div>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                              {field.badge}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {field.description}
                          </p>

                          {/* Granular Capability Matrix */}
                          <div className="mt-3 pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                            <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2">
                              Enterprise Capability Matrix (Least Privilege Scoping):
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {field.capabilities.map((cap) => (
                                <span
                                  key={cap.label}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border ${
                                    cap.allowed
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                      : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-400 dark:border-zinc-700'
                                  }`}
                                >
                                  {cap.allowed ? (
                                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <Ban className="w-3 h-3 text-zinc-400" />
                                  )}
                                  {cap.label}
                                  {!cap.allowed && <span className="opacity-70 text-[9px]">(Restricted)</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>

              <p className="text-[11px] text-zinc-400 mt-3 italic">
                Note: Only Super Administrators can alter administrative designations. Changes are logged to the institutional audit log.
              </p>
            </fieldset>
          ) : null}

          {/* Delegated Classroom Capabilities */}
          {target.role === 'teacher' ? (
            <fieldset className="rounded-none border border-zinc-300 dark:border-zinc-800 p-5 bg-zinc-50/50 dark:bg-zinc-900/30">
              <legend className="px-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                Delegated Classroom Capabilities
              </legend>
              <div className="grid gap-4 sm:grid-cols-2 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-user-reset-permission" className="text-xs font-bold uppercase tracking-wider text-zinc-500">Student password resets</Label>
                  <select
                    id="edit-user-reset-permission"
                    className="flex h-10 w-full rounded-none border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    value={resetPermission}
                    onChange={(event) => setResetPermission(event.target.value as PermissionChoice)}
                  >
                    <option value="inherit">Follow institution default</option>
                    <option value="allow">Allowed</option>
                    <option value="deny">Disabled</option>
                  </select>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Issue temporary passwords to students enrolled in this teacher&apos;s sections.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-user-unbind-permission" className="text-xs font-bold uppercase tracking-wider text-zinc-500">Emergency device release</Label>
                  <select
                    id="edit-user-unbind-permission"
                    className="flex h-10 w-full rounded-none border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    value={unbindPermission}
                    onChange={(event) => setUnbindPermission(event.target.value as PermissionChoice)}
                  >
                    <option value="inherit">Follow institution default</option>
                    <option value="allow">Allowed</option>
                    <option value="deny">Disabled</option>
                  </select>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Clear a student&apos;s bound device and cooldown from this teacher&apos;s roster.
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 mt-3 italic">
                Institution switches act as a master gate: a per-teacher override can restrict but never enable a disabled institution capability.
              </p>
            </fieldset>
          ) : null}

          {error ? (
            <div role="alert" className="p-3 border border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 text-xs font-medium">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button type="button" variant="outline" className="rounded-none uppercase tracking-wider text-xs font-bold" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="rounded-none bg-maroon text-white hover:bg-maroon-dark uppercase tracking-wider text-xs font-bold">
              {submitting ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
