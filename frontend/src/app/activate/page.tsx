'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Circle, Loader2, MailCheck } from 'lucide-react'
import { api } from '@/lib/api-client'
import {
  ACTIVATION_PROBLEM_COPY,
  STUDENT_NUMBER_PATTERN,
  activationFormProblem,
  describeActivationFailure,
  normalizeStudentNumber,
  passwordChecks,
  readActivationToken,
} from '@/lib/activation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Phase =
  | { name: 'checking' }
  | { name: 'no_token' }
  | { name: 'invalid' }
  | { name: 'ready'; expiresAt: string }
  | { name: 'activated'; already: boolean }
  | { name: 'check_failed'; message: string }

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="bg-maroon px-4 py-4 text-white">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <span className="font-heading text-xl font-bold">Polycheck</span>
          <span className="text-xs uppercase tracking-widest text-golden">Account activation</span>
        </div>
      </header>
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="border border-zinc-300 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          PUP Santa Maria · If something looks wrong, do not enter your details and contact the registrar.
        </p>
      </div>
    </main>
  )
}

/** Asks for a fresh link. The answer is always the same, so it never reveals which accounts exist. */
function RequestLinkForm({ heading }: { heading: string }) {
  const [studentId, setStudentId] = useState('')
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError('')
    if (!STUDENT_NUMBER_PATTERN.test(normalizeStudentNumber(studentId))) {
      setError(ACTIVATION_PROBLEM_COPY.student_number)
      return
    }
    setPending(true)
    try {
      await api.activationRequestLink({ studentId: normalizeStudentNumber(studentId), email: email.trim() })
      setSent(true)
    } catch (cause) {
      setError(describeActivationFailure(cause).kind === 'rate_limited'
        ? 'Too many requests from this connection. Please wait a few minutes and try again.'
        : 'We could not reach Polycheck. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  if (sent) {
    return (
      <div role="status" className="space-y-2">
        <div className="flex items-center gap-2 font-semibold text-maroon dark:text-golden">
          <MailCheck className="h-5 w-5" aria-hidden /> Check your email
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          If those details match an account waiting for activation, we sent a new link to the email address on file. It
          can take a few minutes. Look in your spam or promotions folder too. You can ask again after a few minutes.
        </p>
        <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setSent(false)}>
          Use different details
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h2 className="font-heading text-lg font-bold text-maroon dark:text-white">{heading}</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Enter your student number and the email address your school has on file. We will send a new link there.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="request-student">Student number</Label>
        <Input
          id="request-student"
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
          autoComplete="username"
          autoCapitalize="characters"
          inputMode="text"
          placeholder="2024-00001-MN-0"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="request-email">Email on file</Label>
        <Input
          id="request-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11 w-full" disabled={pending || !studentId.trim() || !email.trim()}>
        {pending ? 'Sending…' : 'Send me a new link'}
      </Button>
    </form>
  )
}

export default function ActivatePage() {
  const [phase, setPhase] = useState<Phase>({ name: 'checking' })
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Held in memory only (it came from the URL fragment); never stored or logged.
  const tokenRef = useRef<string | null>(null)

  const check = useCallback(async () => {
    const token = readActivationToken(window.location.hash)
    tokenRef.current = token
    if (!token) {
      setPhase({ name: 'no_token' })
      return
    }
    setPhase({ name: 'checking' })
    try {
      const result = await api.activationValidate(token)
      setPhase(result.valid ? { name: 'ready', expiresAt: result.expiresAt } : { name: 'invalid' })
    } catch (cause) {
      const failure = describeActivationFailure(cause)
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
    const problem = activationFormProblem({ studentId, password, confirm })
    if (problem) {
      setError(ACTIVATION_PROBLEM_COPY[problem])
      return
    }
    setSubmitting(true)
    try {
      const result = await api.activationComplete({
        token: tokenRef.current,
        studentId: normalizeStudentNumber(studentId),
        password,
      })
      // The password is not needed any more: drop it from memory/state immediately.
      setPassword('')
      setConfirm('')
      setPhase({ name: 'activated', already: result.alreadyActivated === true })
    } catch (cause) {
      const failure = describeActivationFailure(cause)
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
          Checking your activation link…
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
        <div className="space-y-5">
          {phase.name === 'invalid' ? (
            <div>
              <h1 className="font-heading text-xl font-bold text-maroon dark:text-white">
                This link is no longer valid
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Activation links work once and expire after a few days. Request a new one below.
              </p>
            </div>
          ) : (
            <div>
              <h1 className="font-heading text-xl font-bold text-maroon dark:text-white">Activate your account</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Open the activation link from your email to continue. No email yet, or did the link expire? Request a
                new one.
              </p>
            </div>
          )}
          <RequestLinkForm heading="Get a new activation link" />
          <p className="text-center text-sm">
            <Link href="/login/student" className="font-medium text-maroon underline dark:text-golden">
              Already activated? Go to login
            </Link>
          </p>
        </div>
      </Shell>
    )
  }

  if (phase.name === 'activated') {
    return (
      <Shell>
        <div role="status" className="space-y-4">
          <div className="flex items-center gap-2 text-maroon dark:text-golden">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
            <h1 className="font-heading text-xl font-bold">
              {phase.already ? 'Already activated' : 'Account activated'}
            </h1>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {phase.already
              ? 'This account was already activated. Sign in with the password you chose.'
              : 'Your password is set. Sign in with your student number and the password you just chose.'}
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
          <h1 className="font-heading text-xl font-bold text-maroon dark:text-white">Activate your account</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Confirm your student number and choose a password. You will use it every time you sign in.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="activate-student">Student number</Label>
          <Input
            id="activate-student"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            autoComplete="username"
            autoCapitalize="characters"
            placeholder="2024-00001-MN-0"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="activate-password">New password</Label>
          <Input
            id="activate-password"
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
          <Label htmlFor="activate-confirm">Confirm password</Label>
          <Input
            id="activate-confirm"
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
          {submitting ? 'Activating…' : 'Activate account'}
        </Button>
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          Slow connection? It is safe to tap again if nothing seems to happen.
        </p>
      </form>
    </Shell>
  )
}
