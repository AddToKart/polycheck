'use client'

import { useState } from 'react'
import { Flag, Mail, ShieldCheck, Smartphone, UserRound } from 'lucide-react'
import type { User } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChangePasswordForm } from './ChangePasswordForm'
import { ContactSettingsForm, DevicePanel } from './ProfileSecurity'
import { ReportIssueDialog } from '@/components/reports/ReportIssueDialog'
import { MyReportsPanel } from '@/components/reports/MyReportsPanel'

type ProfileTab = 'security' | 'contacts' | 'device' | 'reports'

const roleLabel = (role: User['role']) =>
  role === 'super_admin' ? 'Super Admin' : role === 'teacher' ? 'Teacher' : 'Student'

export function ProfilePage({
  user,
  onUpdated,
  onLogout,
}: {
  user: User
  onUpdated: (user: User) => void
  onLogout: () => void
}) {
  const [tab, setTab] = useState<ProfileTab>('security')
  const [reportOpen, setReportOpen] = useState(false)
  const [reloadSignal, setReloadSignal] = useState(0)
  const isStudent = user.role === 'student'
  const canReport = user.role === 'student' || user.role === 'teacher'

  const tabs: { id: ProfileTab; label: string; icon: typeof ShieldCheck }[] = [
    { id: 'security', label: 'Password & security', icon: ShieldCheck },
    { id: 'contacts', label: 'Contact information', icon: Mail },
    ...(isStudent ? [{ id: 'device' as const, label: 'Device & anti-cheat', icon: Smartphone }] : []),
    ...(canReport ? [{ id: 'reports' as const, label: 'My reports', icon: Flag }] : []),
  ]

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row dark:bg-pup-black">
      <Sidebar user={user} onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-6 sm:p-8">
          <div className="mb-8 flex items-center gap-3">
            <UserRound className="h-7 w-7 text-maroon dark:text-golden" aria-hidden="true" />
            <div className="flex-1">
              <h1 className="font-heading text-2xl font-bold text-maroon dark:text-white">My Profile</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Your institutional identity, credentials, contacts, and device security.
              </p>
            </div>
            {canReport ? (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setReportOpen(true)}
              >
                <Flag className="h-4 w-4" aria-hidden="true" />
                Report an issue
              </Button>
            ) : null}
          </div>

          <Card className="mb-6 overflow-hidden">
            <div className="h-1.5 bg-golden" />
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-maroon text-xl font-heading font-bold text-golden">
                  {user.fullName
                    .split(' ')
                    .map((part) => part.charAt(0))
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-heading text-xl font-bold text-foreground">{user.fullName}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {roleLabel(user.role)}
                    {user.department ? ` · ${user.department}` : ''}
                  </p>
                </div>
              </div>

              <dl className="mt-6 grid gap-x-6 gap-y-4 border-t border-zinc-200 pt-5 text-sm sm:grid-cols-2 dark:border-zinc-800">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">PUP ID / Student number</dt>
                  <dd className="mt-1 font-medium text-foreground">{user.studentId ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Role</dt>
                  <dd className="mt-1 font-medium text-foreground">{roleLabel(user.role)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Department</dt>
                  <dd className="mt-1 font-medium text-foreground">{user.department ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">PUP email</dt>
                  <dd className="mt-1 font-medium text-foreground">{user.email ?? '—'}</dd>
                </div>
                {isStudent ? (
                  <>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Program</dt>
                      <dd className="mt-1 font-medium text-foreground">{user.program ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Year level</dt>
                      <dd className="mt-1 font-medium text-foreground">{user.yearLevel ?? '—'}</dd>
                    </div>
                  </>
                ) : null}
              </dl>
              <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
                Institutional identity fields are read-only. Contact the registrar or an administrator to correct them.
              </p>
            </CardContent>
          </Card>

          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Profile sections">
            {tabs.map((item) => {
              const Icon = item.icon
              const selected = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(item.id)}
                  className={
                    selected
                      ? 'inline-flex items-center gap-2 rounded-full bg-maroon px-4 py-2 text-xs font-bold text-white'
                      : 'inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                  }
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.label}
                </button>
              )
            })}
          </div>

          <Card>
            <CardContent className="p-6">
              {tab === 'security' ? <ChangePasswordForm user={user} onUpdated={onUpdated} /> : null}
              {tab === 'contacts' ? <ContactSettingsForm user={user} onUpdated={onUpdated} /> : null}
              {tab === 'device' && isStudent ? (
                <DevicePanel user={user} onUpdated={onUpdated} onLoggedOut={onLogout} />
              ) : null}
              {tab === 'reports' && canReport ? <MyReportsPanel reloadSignal={reloadSignal} /> : null}
            </CardContent>
          </Card>

        {canReport ? (
          <ReportIssueDialog
            open={reportOpen}
            onOpenChange={(open) => {
              setReportOpen(open)
              if (!open) setReloadSignal((value) => value + 1)
            }}
          />
        ) : null}
      </div>
      </main>
    </div>
  )
}
