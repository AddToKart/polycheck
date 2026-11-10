'use client'

import { Lock, ShieldAlert } from 'lucide-react'
import { formatCooldownCountdown } from '@polycheck/shared'
import { Button } from '@/components/ui/button'
import { useTrustedNow } from '@/lib/hooks/use-trusted-now'

export type StudentLoginGate =
  | {
      kind: 'cooldown'
      message: string
      remainingSeconds: number
      /** Device clock reading when the 403 payload arrived (countdown anchor). */
      anchorMs: number
    }
  | {
      kind: 'active_session'
      message: string
      activeDeviceKind: 'mobile' | 'web' | null
    }

interface StudentLoginDeviceGateProps {
  gate: StudentLoginGate
  retrying: boolean
  onRetry: () => void
}

/**
 * Locked states for the web student login route. Both replace the credential
 * form: the backend rejected this device before issuing a session, so retrying
 * is the only forward action once the block clears.
 */
export function StudentLoginDeviceGate({
  gate,
  retrying,
  onRetry,
}: StudentLoginDeviceGateProps) {
  return gate.kind === 'cooldown' ? (
    <CooldownPanel
      message={gate.message}
      remainingSeconds={gate.remainingSeconds}
      anchorMs={gate.anchorMs}
      retrying={retrying}
      onRetry={onRetry}
    />
  ) : (
    <ActiveSessionPanel
      message={gate.message}
      activeDeviceKind={gate.activeDeviceKind}
      retrying={retrying}
      onRetry={onRetry}
    />
  )
}

function CooldownPanel({
  message,
  remainingSeconds,
  anchorMs,
  retrying,
  onRetry,
}: {
  message: string
  remainingSeconds: number
  anchorMs: number
  retrying: boolean
  onRetry: () => void
}) {
  // `remainingSeconds` is a server-measured duration, so only elapsed time
  // matters. Both ends of the interval use the cached `/health` offset, keeping
  // the countdown off the device's absolute wall clock; until `/health`
  // answers the null offset falls back to platform time without a display jump.
  const { nowMs, offsetMs } = useTrustedNow({ refreshOffset: true })
  const trustedNowMs = nowMs + (offsetMs ?? 0)
  const trustedAnchorMs = anchorMs + (offsetMs ?? 0)
  const elapsedSeconds = Math.max(0, (trustedNowMs - trustedAnchorMs) / 1_000)
  const remaining = Math.max(0, remainingSeconds - elapsedSeconds)

  return (
    <GateShell
      titleId="student-login-cooldown-title"
      title="Device change cooling down"
      message={message}
      icon={<Lock className="h-5 w-5 text-golden" aria-hidden="true" />}
    >
      <div className="border-l-4 border-golden bg-zinc-50 px-4 py-3 dark:bg-zinc-950">
        <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-zinc-400">
          Time remaining
        </p>
        <p
          role="timer"
          aria-live="off"
          aria-label="Device cooldown time remaining"
          className="font-heading text-4xl font-bold tabular-nums text-maroon dark:text-golden"
        >
          {formatCooldownCountdown(remaining)}
        </p>
      </div>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Signing back in on the device you logged out from is instant. If this is
        a new device, wait for the countdown — or ask your instructor to issue an
        Emergency Device Release.
      </p>
      <RetryButton retrying={retrying} onRetry={onRetry} />
    </GateShell>
  )
}

function ActiveSessionPanel({
  message,
  activeDeviceKind,
  retrying,
  onRetry,
}: {
  message: string
  activeDeviceKind: 'mobile' | 'web' | null
  retrying: boolean
  onRetry: () => void
}) {
  const holder =
    activeDeviceKind === 'mobile'
      ? 'your phone'
      : activeDeviceKind === 'web'
        ? 'the web browser'
        : 'another device'

  return (
    <GateShell
      titleId="student-login-active-session-title"
      title="Already signed in elsewhere"
      message="Your account is currently signed in on another device."
      icon={<ShieldAlert className="h-5 w-5 text-golden" aria-hidden="true" />}
    >
      <div className="border-l-4 border-maroon bg-zinc-50 px-4 py-3 dark:bg-zinc-950">
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          The active session is on {holder}. Sign out there first, then try
          again. If that device is unavailable, ask your instructor to issue an
          Emergency Device Release.
        </p>
        {message ? (
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {message}
          </p>
        ) : null}
      </div>
      <RetryButton retrying={retrying} onRetry={onRetry} />
    </GateShell>
  )
}

function GateShell({
  titleId,
  title,
  message,
  icon,
  children,
}: {
  titleId: string
  title: string
  message: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby={titleId}
      className="w-full border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="flex items-center gap-3 border-b-4 border-golden bg-maroon px-6 py-4">
        {icon}
        <p className="text-[10px] font-sans font-bold uppercase tracking-[0.25em] text-golden">
          Device check
        </p>
      </div>
      <div className="space-y-5 px-6 py-6">
        <div className="space-y-2">
          <h3
            id={titleId}
            className="font-heading text-2xl font-bold text-foreground"
          >
            {title}
          </h3>
          <p
            role="alert"
            className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
          >
            {message}
          </p>
        </div>
        {children}
      </div>
    </section>
  )
}

function RetryButton({
  retrying,
  onRetry,
}: {
  retrying: boolean
  onRetry: () => void
}) {
  return (
    <Button
      type="button"
      onClick={onRetry}
      disabled={retrying}
      className="h-12 w-full rounded-none bg-maroon text-base font-bold uppercase tracking-wide text-white hover:bg-maroon-dark"
    >
      {retrying ? 'Checking…' : 'Try again'}
    </Button>
  )
}
