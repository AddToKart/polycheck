'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { useBranding } from '@/components/branding/BrandingProvider'
import ThemeToggle from '@/components/ThemeToggle'
import { api } from '@/lib/api-client'
import {
  RESET_PROBLEM_COPY,
  describeResetFailure,
  isPasswordAcceptable,
  passwordChecks,
  readResetToken,
} from '@/lib/password-reset'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Phase =
  | { name: 'checking' }
  | { name: 'no_token' }
  | { name: 'invalid' }
  | { name: 'ready' }
  | { name: 'done'; already: boolean }
  | { name: 'check_failed'; message: string }

function Shell({ children }: { children: React.ReactNode }) {
  const branding = useBranding()
  return (
    <main className="min-h-dvh bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="bg-maroon px-4 py-4 text-white">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <span className="font-heading text-xl font-bold">PolyCheck</span>
          <span className="text-xs uppercase tracking-widest text-golden">Reset password</span>
          <ThemeToggle className="ml-auto rounded-none p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-golden" />
        </div>
      </header>
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="border border-zinc-300 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {branding.name}
          {branding.campus ? ` · ${branding.campus}` : ''} · If something looks wrong, do not enter a password and
          contact your instructor.
        </p>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  const [phase, setPhase] = useState<Phase>({ name: 'checking' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Held in memory only (it came from the URL fragment); never stored or logged.
  const tokenRef = useRef<string | null>(null)

  const check = useCallback(async () => {
    const token = readResetToken(window.location.hash)
    tokenRef.current = token
    if (!token) {
      setPhase({ name: 'no_token' })
      return
    }
    setPhase({ name: 'checking' })
    try {
      const result = await api.passwordResetValidate(token)
      setPhase(result.valid ? { name: 'ready' } : { name: 'invalid' })
    } catch (cause) {
      const failure = describeResetFailure(cause)
      setPhase(
        failure.kind === 'invalid_link'
          ? { name: 'invalid' }
          : { name: 'check_failed', message: 'message' in failure ? failure.message : 'Please try again.' },
      )
    }
  }, [])

  useEffect(() => {
    void check()
    // A new link opened or pasted into an already-open tab only changes the fragment.
    const onHashChange = () => void check()
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [check])

  const checks = passwordChecks(password)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting || !tokenRef.current) return
    setError('')
    if (!isPasswordAcceptable(password)) {
      setError(RESET_PROBLEM_COPY.password)
      return
    }
    if (password !== confirm) {
      setError(RESET_PROBLEM_COPY.mismatch)
      return
    }
    setSubmitting(true)
    try {
      const result = await api.passwordResetComplete({ token: tokenRef.current, password })
      // The password is not needed any more: drop it from memory/state immediately.
      setPassword('')
      setConfirm('')
      setPhase({ name: 'done', already: result.alreadyReset === true })
    } catch (cause) {
      const failure = describeResetFailure(cause)
      if (failure.kind === 'invalid_link') setPhase({ name: 'invalid' })
      else setError(failure.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (phase.name === 'checking') {
    return (
      <Shell>
        <div role="status" className="flex items-center gap-3 py-6 text-sm text-zinc-600 dark:text-zinc-300">
          <Loader2 className="h-5 w-5 animate-spin text-maroon dark:text-golden" aria-hidden />
          Checking your reset link…
        </div>
      </Shell>
    )
  }

  if (phase.name === 'check_failed') {
    return (
      <Shell>
        <div className="space-y-4">
          <p role="alert" className="text-sm text-zinc-700 dark:text-zinc-200">
            {phase.message}
          </p>
          <Button className="min-h-11 w-full" onClick={() => void check()}>
            Try again
          </Button>
        </div>
      </Shell>
    )
  }

  if (phase.name === 'no_token' || phase.name === 'invalid') {
    return (
      <Shell>
        <div className="space-y-4">
          <div>
            <h1 className="font-heading text-xl font-bold text-maroon dark:text-white">
              {phase.name === 'invalid' ? 'This link is no longer valid' : 'Reset your password'}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {phase.name === 'invalid'
                ? 'Reset links work once and expire after about an hour. Request a new one.'
                : 'Open the reset link from your email to continue, or request a new one.'}
            </p>
          </div>
          <Button asChild className="min-h-11 w-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
          <p className="text-center text-sm">
            <Link href="/login/student" className="font-medium text-maroon underline dark:text-golden">
              Back to login
            </Link>
          </p>
        </div>
      </Shell>
    )
  }

  if (phase.name === 'done') {
    return (
      <Shell>
        <div role="status" className="space-y-4">
          <div className="flex items-center gap-2 text-maroon dark:text-golden">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
            <h1 className="font-heading text-xl font-bold">
              {phase.already ? 'Password already reset' : 'Password updated'}
            </h1>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {phase.already
              ? 'This link was already used. Sign in with the password you chose.'
              : 'Your password was changed and every device was signed out. Sign in again on the website or in the PolyCheck app with your student number and the new password.'}
          </p>
          <Button asChild className="min-h-11 w-full">
            <Link href="/login/student">Go to login</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <h1 className="font-heading text-xl font-bold text-maroon dark:text-white">Choose a new password</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            You will use it every time you sign in, on the website and in the app.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
          <ul className="space-y-1 pt-1" aria-label="Password requirements">
            {checks.map((item) => (
              <li
                key={item.id}
                className={`flex items-center gap-2 text-xs ${
                  item.met ? 'text-green-700 dark:text-green-400' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {item.met ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Circle className="h-3.5 w-3.5" aria-hidden />
                )}
                <span>
                  {item.label}
                  <span className="sr-only">{item.met ? ' (done)' : ' (not yet)'}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reset-confirm">Confirm password</Label>
          <Input
            id="reset-confirm"
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-maroon"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />
          Show password
        </label>

        {error ? (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
          {submitting ? 'Saving…' : 'Reset password'}
        </Button>
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          Slow connection? It is safe to tap again if nothing seems to happen.
        </p>
      </form>
    </Shell>
  )
}
