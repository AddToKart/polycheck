'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PrivacyNotice, User } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'

export function PrivacyConsentGate() {
  const [user, setUser] = useState<User | null>(() => api.getCurrentUser())
  const [notice, setNotice] = useState<PrivacyNotice | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    const current = api.getCurrentUser()
    setUser(current)
    setError('')
    if (!current || current.role !== 'student') {
      setNotice(null)
      return
    }
    try {
      setNotice(await api.getPrivacyNotice())
    } catch {
      if (!current.privacyConsentedAt) setError('Connect to the internet to review and accept the privacy notice.')
    }
  }, [])

  useEffect(() => {
    void refresh()
    window.addEventListener('polycheck-auth-changed', refresh)
    return () => window.removeEventListener('polycheck-auth-changed', refresh)
  }, [refresh])

  const requiresConsent =
    user?.role === 'student' &&
    ((!notice && !user.privacyConsentedAt) || Boolean(notice && user.privacyConsentVersion !== notice.version))
  if (!requiresConsent) return null

  const accept = async () => {
    if (!notice || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const updated = await api.acceptPrivacyConsent(notice.version)
      setUser(updated)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record privacy consent.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="privacy-consent-title">
      <div className="w-full max-w-xl border border-zinc-300 border-t-4 border-t-golden bg-background p-6 shadow-2xl dark:border-zinc-700 dark:border-t-golden">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-maroon dark:text-golden">Privacy consent</p>
        <h2 id="privacy-consent-title" className="mt-2 font-serif text-2xl font-bold">Attendance uses location evidence</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {notice?.summary ?? 'The current privacy notice must be loaded before attendance check-in can be used.'}
        </p>
        {notice ? <a className="mt-4 inline-block text-sm font-bold text-maroon underline dark:text-golden" href={notice.url} target="_blank" rel="noreferrer">Read the complete privacy notice</a> : null}
        {error ? <p role="alert" className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {notice ? <Button className="min-h-11 flex-1" disabled={submitting} onClick={() => void accept()}>{submitting ? 'Recording consent…' : 'I understand and consent'}</Button> : null}
          <Button className="min-h-11 flex-1" variant="outline" onClick={() => void refresh()}>Retry</Button>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">If you decline, you may sign out; QR attendance submission remains disabled.</p>
      </div>
    </div>
  )
}
