'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, RefreshCw, UserPlus, X } from 'lucide-react'
import type { RegistrationList, RegistrationRequestView, RegistrationStatus, User } from '@polycheck/shared'
import { api, requestUserLogout } from '@/lib/api-client'
import { isInstitutionAdmin } from '@/lib/admin-users'
import { describeMutationError, useRunMutation } from '@/lib/run-mutation'
import { ErrorDisplay, LoadingSpinner } from '@/lib/hooks'
import { useNotifications } from '@/lib/notifications'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const APPROVE_BATCH = 200
const ISSUE_TEXT = {
  account_exists: 'An account already uses this student number or email',
  duplicate_request: 'More than one request for this student number or email',
} as const

type RoleFilter = 'student' | 'teacher'

/**
 * Temporary sign-ups from the landing page. Nothing becomes an account until a
 * super admin approves it here.
 */
export default function RegistrationsPage() {
  const router = useRouter()
  const { addNotification } = useNotifications()
  const mutation = useRunMutation()
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<RegistrationStatus>('pending')
  const [role, setRole] = useState<RoleFilter>('student')
  const [list, setList] = useState<RegistrationList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [failures, setFailures] = useState<Array<{ id: string; fullName: string; reason: string }>>([])

  useEffect(() => {
    const current = api.getCurrentUser()
    if (!current || !isInstitutionAdmin(current)) {
      router.replace('/faculty')
      return
    }
    setUser(current)
  }, [router])

  const load = useCallback(async (which: RegistrationStatus) => {
    try {
      const next = await api.getRegistrations(which)
      setList(next)
      setError(null)
    } catch (failure) {
      setError(describeMutationError(failure, 'Unable to load the sign-up requests.'))
    }
  }, [])

  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    let active = true
    void api
      .getRegistrations(status)
      .then((next) => {
        if (!active) return
        setList(next)
        setError(null)
      })
      .catch((failure) => {
        if (active) setError(describeMutationError(failure, 'Unable to load the sign-up requests.'))
      })
    return () => {
      active = false
    }
  }, [userId, status])

  if (!user) return null

  const items = (list?.items ?? []).filter((item) => item.role === role)
  // Select-all skips anything that needs a closer look.
  const clean = items.filter((item) => item.issues.length === 0).map((item) => item.id)
  const chosen = items.filter((item) => selected.has(item.id)).map((item) => item.id)
  const busy = mutation.pendingAction !== null && mutation.isPending(mutation.pendingAction)

  const switchView = (nextStatus: RegistrationStatus, nextRole: RoleFilter) => {
    if (nextStatus !== status) setList(null)
    setStatus(nextStatus)
    setRole(nextRole)
    setSelected(new Set())
    setFailures([])
  }

  const toggleOpen = () =>
    mutation.run(
      'registration:open',
      async () => {
        await api.setSetting('registration_enabled', list?.open ? 'false' : 'true')
        await load(status)
      },
      { errorTitle: 'Could not change sign-up' },
    )

  const approve = (ids: string[]) =>
    mutation.run(
      'registration:approve',
      async () => {
        let approved = 0
        const failed: typeof failures = []
        for (let index = 0; index < ids.length; index += APPROVE_BATCH) {
          const result = await api.approveRegistrations(ids.slice(index, index + APPROVE_BATCH))
          approved += result.approved
          failed.push(...result.failed)
        }
        setFailures(failed)
        setSelected(new Set())
        addNotification(
          failed.length ? 'warning' : 'success',
          `${approved} account${approved === 1 ? '' : 's'} created`,
          failed.length ? `${failed.length} could not be approved. See the list.` : 'They can sign in now.',
        )
        await load(status)
      },
      { errorTitle: 'Could not approve' },
    )

  const approveOne = (item: RegistrationRequestView) => {
    if (
      item.role === 'teacher' &&
      !window.confirm(
        `Approve ${item.fullName} (${item.email}) as a teacher?\n\nA teacher account can see student names and student numbers. Approve only people you know.`,
      )
    ) {
      return
    }
    void approve([item.id])
  }

  const reject = (item: RegistrationRequestView) => {
    if (!window.confirm(`Reject the request from ${item.fullName}? Their details are deleted.`)) return
    void mutation.run(
      'registration:reject',
      async () => {
        await api.rejectRegistrations([item.id])
        await load(status)
      },
      { errorTitle: 'Could not reject' },
    )
  }

  const tabClass = (on: boolean) =>
    `min-h-11 border px-4 text-sm font-bold md:min-h-9 ${
      on
        ? 'border-maroon bg-maroon text-white'
        : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
    }`

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-brand-black">
      <Sidebar
        user={user}
        onLogout={() => {
          void requestUserLogout().then((outcome) => {
            if (outcome.loggedOut) router.push('/')
          })
        }}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
          <Link
            href="/faculty/users"
            className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-maroon dark:text-golden md:min-h-0"
          >
            <ArrowLeft className="w-4 h-4" /> User Management
          </Link>
          <h1 className="mb-1 flex items-center gap-2 text-3xl font-heading font-bold text-maroon dark:text-white">
            <UserPlus className="w-7 h-7 shrink-0" /> Sign-up requests
          </h1>
          <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
            Temporary sign-ups from the landing page. No account exists until you approve it here.
          </p>

          {list ? (
            <Card className="rounded-none border-zinc-300 dark:border-zinc-800 shadow-none mb-6">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm font-bold text-foreground">
                  {list.open ? 'Sign-up is open' : 'Sign-up is closed'}
                  <span className="block text-xs font-normal text-zinc-500">
                    {list.open
                      ? 'Anyone with the landing page can send a request. Close it when data gathering ends.'
                      : 'The landing page hides the sign-up button and new requests are refused.'}
                  </span>
                </p>
                <Button
                  variant={list.open ? 'outline' : 'default'}
                  className="min-h-11 md:min-h-9"
                  disabled={mutation.isPending('registration:open')}
                  onClick={toggleOpen}
                >
                  {list.open ? 'Close sign-up' : 'Open sign-up'}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" className={tabClass(status === 'pending')} onClick={() => switchView('pending', role)}>
              Waiting{list ? ` (${list.pendingCount})` : ''}
            </button>
            <button type="button" className={tabClass(status === 'approved')} onClick={() => switchView('approved', role)}>
              Approved
            </button>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button type="button" className={tabClass(role === 'student')} onClick={() => switchView(status, 'student')}>
              Students
            </button>
            <button type="button" className={tabClass(role === 'teacher')} onClick={() => switchView(status, 'teacher')}>
              Teachers
            </button>
            <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => void load(status)}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>

          {failures.length > 0 ? (
            <div role="alert" className="mb-4 border border-red-300 bg-red-50 p-3 text-sm dark:bg-red-950/30">
              <p className="font-bold">Not approved</p>
              <ul>
                {failures.map((failure) => (
                  <li key={failure.id}>
                    {failure.fullName}: {failure.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {error ? <ErrorDisplay message={error} onRetry={() => void load(status)} /> : null}
          {!list && !error ? <LoadingSpinner /> : null}

          {list && status === 'pending' && role === 'student' && items.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-0">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={clean.length > 0 && clean.every((id) => selected.has(id))}
                  onChange={(event) => setSelected(new Set(event.target.checked ? clean : []))}
                />
                Select all without warnings ({clean.length})
              </label>
              <Button
                className="min-h-11 md:min-h-9"
                disabled={chosen.length === 0 || busy}
                onClick={() => {
                  if (window.confirm(`Create ${chosen.length} student account${chosen.length === 1 ? '' : 's'}?`)) {
                    void approve(chosen)
                  }
                }}
              >
                <Check className="w-4 h-4" /> Approve selected ({chosen.length})
              </Button>
            </div>
          ) : null}

          {list && items.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              {status === 'pending' ? `No ${role} requests are waiting.` : `No ${role} sign-ups approved yet.`}
            </p>
          ) : null}

          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 border border-zinc-200 bg-white p-3 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {status === 'pending' && role === 'student' ? (
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0"
                      aria-label={`Select ${item.fullName}`}
                      checked={selected.has(item.id)}
                      onChange={(event) => {
                        const next = new Set(selected)
                        if (event.target.checked) next.add(item.id)
                        else next.delete(item.id)
                        setSelected(next)
                      }}
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-foreground">{item.fullName}</p>
                    {item.studentId ? (
                      <p className="text-xs text-zinc-600 dark:text-zinc-300">
                        {item.studentId} · {item.program} · Year {item.yearLevel}
                      </p>
                    ) : null}
                    <p className="break-all text-xs text-zinc-500">{item.email}</p>
                    <p className="text-[11px] text-zinc-400">Sent {new Date(item.createdAt).toLocaleString()}</p>
                    {item.issues.map((issue) => (
                      <Badge key={issue} className="mr-1 mt-1 rounded-none bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200">
                        {ISSUE_TEXT[issue]}
                      </Badge>
                    ))}
                  </div>
                </div>
                {status === 'pending' ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      className="min-h-11 flex-1 sm:flex-none md:min-h-9"
                      disabled={busy || item.issues.includes('account_exists')}
                      onClick={() => approveOne(item)}
                    >
                      <Check className="w-4 h-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11 flex-1 border-red-400 text-red-600 sm:flex-none md:min-h-9"
                      disabled={busy}
                      onClick={() => reject(item)}
                    >
                      <X className="w-4 h-4" /> Reject
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}
