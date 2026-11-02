'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import {
  hasDesignation,
  REFERRAL_STATUS_LABELS,
  type AtRiskReferral,
  type ReferralStatus,
  type User,
} from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/lib/hooks'
import { useNotifications } from '@/lib/notifications'

/**
 * F5 (WF-LD7): the CHED referral queue for `/faculty/at-risk`.
 *
 * Referrals are grouped by status in lifecycle order; department heads and
 * super admins move them through `acknowledged` → `counseling_scheduled` →
 * `resolved` (triage flexibility — the server allows any→any), while other
 * oversight viewers see the queue read-only. Every row can re-download the
 * signed CHED "Notice of Impending Drop" slip.
 */

const CHED_NOTICE_FILENAME = 'PUP-CHED-Drop-Notice.pdf'

const STATUS_ORDER: readonly ReferralStatus[] = [
  'generated',
  'acknowledged',
  'counseling_scheduled',
  'resolved',
]

const STATUS_CLASSES: Record<ReferralStatus, string> = {
  generated: 'bg-golden text-maroon-dark',
  acknowledged: 'bg-maroon text-white',
  counseling_scheduled: 'bg-maroon-dark text-golden border border-golden',
  resolved: 'bg-emerald-600 text-white',
}

const TRANSITION_TARGETS: readonly ReferralStatus[] = [
  'acknowledged',
  'counseling_scheduled',
  'resolved',
]

const TRANSITION_LABELS: Partial<Record<ReferralStatus, string>> = {
  acknowledged: 'Acknowledge',
  counseling_scheduled: 'Schedule counseling',
  resolved: 'Mark resolved',
}

export function chedNoticeDownloadPath(referralId: string): string {
  return `/docs/at-risk-notice/${encodeURIComponent(referralId)}?format=pdf`
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function describeDate(value: string): string {
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export interface ReferralQueueProps {
  /** Signed-in oversight viewer — heads and super admins can triage. */
  user: User
  /** Bump to make the queue re-fetch (e.g. after a referral is generated). */
  refreshKey?: number
  /** Called after a successful status transition (the backend rows changed). */
  onReferralsChanged?: () => void
}

interface ReferralRowProps {
  referral: AtRiskReferral
  canManage: boolean
  updating: boolean
  downloading: boolean
  onTransition: (referral: AtRiskReferral, status: ReferralStatus) => void
  onDownload: (referral: AtRiskReferral) => void
}

function ReferralRow({
  referral,
  canManage,
  updating,
  downloading,
  onTransition,
  onDownload,
}: ReferralRowProps) {
  const busy = updating || downloading
  return (
    <li className="p-4 md:px-5 md:py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {referral.studentName}
            {referral.studentNumber ? (
              <span className="ml-2 font-mono text-xs font-normal text-zinc-500 dark:text-zinc-400">
                {referral.studentNumber}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            {referral.subjectName} · {referral.sectionName}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Instructor {referral.professorName} · Issued by {referral.generatedByName} ·{' '}
            {describeDate(referral.createdAt)}
          </p>
          {referral.note ? (
            <p className="text-xs italic text-zinc-500 dark:text-zinc-400">“{referral.note}”</p>
          ) : null}
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Last update {describeDate(referral.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:shrink-0">
          <span
            className={`inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${STATUS_CLASSES[referral.status]}`}
          >
            {REFERRAL_STATUS_LABELS[referral.status]}
          </span>
          {canManage
            ? TRANSITION_TARGETS.filter((status) => status !== referral.status).map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  className="min-h-11 md:min-h-0"
                  disabled={busy}
                  onClick={() => onTransition(referral, status)}
                >
                  {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
                  {TRANSITION_LABELS[status]}
                </Button>
              ))
            : null}
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 md:min-h-0"
            disabled={busy}
            aria-label={`Download CHED notice for ${referral.studentName}`}
            onClick={() => onDownload(referral)}
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden />
            )}
            Notice (PDF)
          </Button>
        </div>
      </div>
    </li>
  )
}

export function ReferralQueue({
  user,
  refreshKey = 0,
  onReferralsChanged,
}: ReferralQueueProps) {
  const { addNotification } = useNotifications()
  const [referrals, setReferrals] = useState<AtRiskReferral[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    api
      .getAtRiskReferrals()
      .then((rows) => {
        if (active) setReferrals(rows)
      })
      .catch((error) => {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : 'Unable to load CHED referrals',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [refreshKey, reloadNonce])

  const handleTransition = async (referral: AtRiskReferral, status: ReferralStatus) => {
    if (updatingId) return
    setUpdatingId(referral.id)
    try {
      const updated = await api.updateAtRiskReferral(referral.id, { status })
      setReferrals((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      addNotification(
        'success',
        'Referral updated',
        `${updated.studentName}'s referral is now ${REFERRAL_STATUS_LABELS[status]}.`,
      )
      onReferralsChanged?.()
    } catch (error) {
      addNotification(
        'error',
        'Referral update failed',
        error instanceof Error ? error.message : 'Unable to update the referral.',
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDownload = async (referral: AtRiskReferral) => {
    if (downloadingId) return
    setDownloadingId(referral.id)
    try {
      const blob = await api.downloadAssistantFile(chedNoticeDownloadPath(referral.id))
      triggerBrowserDownload(blob, CHED_NOTICE_FILENAME)
      addNotification(
        'success',
        'Notice downloaded',
        `The signed CHED notice for ${referral.studentName} has been saved.`,
      )
    } catch (error) {
      addNotification(
        'error',
        'Download failed',
        error instanceof Error ? error.message : 'Unable to download the CHED notice.',
      )
    } finally {
      setDownloadingId(null)
    }
  }

  const grouped = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        rows: referrals.filter((row) => row.status === status),
      })).filter((group) => group.rows.length > 0),
    [referrals],
  )

  const canManage = hasDesignation(user, 'academic_oversight')

  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            CHED CMO No. 40, Art. V §21 · Notice of Impending Drop
          </h2>
        </div>
        {loadError ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p
              role="alert"
              className="border border-red-300 bg-red-50 px-4 py-3 text-left text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
            >
              {loadError}
            </p>
            <Button variant="outline" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-sm text-zinc-500">
            <LoadingSpinner />
            Loading referrals…
          </div>
        ) : referrals.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-heading text-lg font-bold text-maroon dark:text-golden">
              No CHED referrals yet
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Notices issued with the “Impending drop” action on the oversight list will appear
              here for the guidance queue.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {grouped.map((group) => (
              <section key={group.status} aria-label={REFERRAL_STATUS_LABELS[group.status]}>
                <div className="flex items-center gap-2 bg-zinc-50 px-4 py-2 dark:bg-zinc-900">
                  <span
                    className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${STATUS_CLASSES[group.status]}`}
                  >
                    {REFERRAL_STATUS_LABELS[group.status]}
                  </span>
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {group.rows.length}
                  </span>
                </div>
                <ul>
                  {group.rows.map((referral) => (
                    <ReferralRow
                      key={referral.id}
                      referral={referral}
                      canManage={canManage}
                      updating={updatingId === referral.id}
                      downloading={downloadingId === referral.id}
                      onTransition={handleTransition}
                      onDownload={handleDownload}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
