'use client'

import Link from 'next/link'
import { useState } from 'react'
import { MailCheck, MailWarning } from 'lucide-react'
import { useBranding } from '@/components/branding/BrandingProvider'
import ThemeToggle from '@/components/ThemeToggle'
import { api } from '@/lib/api-client'
import { STUDENT_NUMBER_PATTERN, describeResetFailure, normalizeStudentNumber } from '@/lib/password-reset'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Outcome = 'idle' | 'email' | 'unavailable'

function Shell({ children }: { children: React.ReactNode }) {
  const branding = useBranding()
  return (
    <main className="min-h-dvh bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="bg-maroon px-4 py-4 text-white">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <span className="font-heading text-xl font-bold">Polycheck</span>
          <span className="text-xs uppercase tracking-widest text-golden">Password help</span>
          <ThemeToggle className="ml-auto rounded-none p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-golden" />
        </div>
      </header>
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="border border-zinc-300 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {branding.name}
          {branding.campus ? ` · ${branding.campus}` : ''} · Polycheck never asks for your password by email.
        </p>
      </div>
    </main>
  )
}

export default function ForgotPasswordPage() {
  const [studentId, setStudentId] = useState('')
  const [pending, setPending] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>('idle')
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError('')
    const normalized = normalizeStudentNumber(studentId)
    if (!STUDENT_NUMBER_PATTERN.test(normalized)) {
      setError('Enter your student number exactly as shown on your ID, for example 2024-00001-MN-0.')
      return
    }
    setPending(true)
    try {
      const result = await api.passwordResetRequest(normalized)
      setOutcome(result.delivery)
    } catch (cause) {
      setError(describeResetFailure(cause).kind === 'rate_limited'
        ? 'Too many requests from this connection. Please wait a few minutes and try again.'
        : 'We could not reach Polycheck. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  if (outcome === 'email') {
    return (
      <Shell>
        <div role="status" className="space-y-4">
          <div className="flex items-center gap-2 text-maroon dark:text-golden">
            <MailCheck className="h-6 w-6" aria-hidden />
            <h1 className="font-heading text-xl font-bold">Check your email</h1>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            We sent a password reset link to the email address on your profile. It can take a few minutes, so look in
            your spam or promotions folder too. The link works once and expires in about an hour.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            After you choose a new password, sign in again on the website and in the app.
          </p>
          <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setOutcome('idle')}>
            Use a different student number
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

  if (outcome === 'unavailable') {
    return (
      <Shell>
        <div role="status" className="space-y-4">
          <div className="flex items-center gap-2 text-maroon dark:text-golden">
            <MailWarning className="h-6 w-6" aria-hidden />
            <h1 className="font-heading text-xl font-bold">No email on file</h1>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            We could not find an email address added to this student account, so we could not send a reset link.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Ask your instructor to reset your password. They can give you a temporary password in Polycheck, and you
            will choose your own right after you sign in.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Once you are back in, add your email under <strong>Profile</strong> so you can reset your password yourself
            next time.
          </p>
          <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setOutcome('idle')}>
            Check a different student number
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

  return (
    <Shell>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <h1 className="font-heading text-xl font-bold text-maroon dark:text-white">Forgot your password?</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Enter your student number. If you added an email to your profile, we will send a link there to choose a new
            password.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="forgot-student">Student number</Label>
          <Input
            id="forgot-student"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            autoComplete="username"
            autoCapitalize="characters"
            placeholder="2024-00001-MN-0"
            required
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="min-h-11 w-full" disabled={pending || !studentId.trim()}>
          {pending ? 'Checking…' : 'Send reset link'}
        </Button>
        <p className="text-center text-sm">
          <Link href="/login/student" className="font-medium text-maroon underline dark:text-golden">
            Back to login
          </Link>
        </p>
      </form>
    </Shell>
  )
}
