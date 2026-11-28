'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, ChevronRight, RefreshCw } from 'lucide-react'
import type { ProofOfClass, QacSection, QacSessionSlot, Student } from '@polycheck/shared'
import { formatSectionHeading, formatTime } from '@polycheck/shared'
import { api, requestUserLogout } from '@/lib/api-client'
import { describeMutationError } from '@/lib/run-mutation'
import { ErrorDisplay, LoadingSpinner } from '@/lib/hooks'
import { Sidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ProofPhotoGrid } from '@/components/proofs/ProofPhotoGrid'
import { ProofUploader } from '@/components/proofs/ProofUploader'
import { PhotoReportButton } from '@/components/proofs/PhotoReportButton'

const heading = (section: QacSection) => formatSectionHeading({ section: section.section, course: section.course })
const times = (slot: QacSessionSlot) => `${formatTime(slot.startTime)} to ${formatTime(slot.endTime)}`

/** One class that is happening now: the uploader plus the officer's own photos. */
function OpenSession({ section, slot, user, onChanged }: {
  section: QacSection
  slot: QacSessionSlot
  user: Student
  onChanged: () => Promise<void>
}) {
  const [photos, setPhotos] = useState<ProofOfClass[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const all = await api.getProofsOfClass(slot.id)
      setPhotos(all.filter((proof) => proof.uploadedBy === user.id))
      setError('')
    } catch (cause) {
      setError(describeMutationError(cause, 'Your photos could not be loaded.'))
    }
  }, [slot.id, user.id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Happening now</p>
        <p className="text-sm font-bold text-foreground">
          {times(slot)}
          {slot.room ? ` · ${slot.room}` : ''}
        </p>
      </div>
      <ProofUploader
        sectionId={section.sectionId}
        sessionId={slot.id}
        alreadyUploaded={Math.max(slot.myPhotoCount, photos.length)}
        uploader={user}
        onUploaded={async () => {
          await load()
          await onChanged()
        }}
      />
      {error ? <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      {photos.length > 0 ? <ProofPhotoGrid proofs={photos} /> : null}
    </div>
  )
}

export default function QacPhotosPage() {
  const router = useRouter()
  const [user, setUser] = useState<Student | null>(null)
  const [sections, setSections] = useState<QacSection[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      setSections(await api.getMyQacSections())
      setError('')
    } catch (cause) {
      setError(describeMutationError(cause, 'Your QAC classes could not be loaded.'))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const current = api.getCurrentUser()
    if (!current || current.role !== 'student') {
      router.push('/')
      return
    }
    setUser(current as Student)
    void load()
  }, [router, load])

  const handleLogout = () => {
    void requestUserLogout().then((outcome) => {
      if (outcome.loggedOut) router.push('/')
    })
  }

  if (!user) return <LoadingSpinner />

  const section = sections?.find((item) => item.sectionId === selected) ?? null
  const open = section?.sessions.filter((slot) => slot.open) ?? []
  const closed = section?.sessions.filter((slot) => !slot.open) ?? []

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <Sidebar user={{ ...user, email: user.email ?? '' }} onLogout={handleLogout} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4 sm:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 basis-52">
              <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon dark:text-white">
                <Camera className="h-6 w-6 text-maroon dark:text-golden" aria-hidden="true" />
                Class Photos
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                As Quality Assurance Coordinator you can add photos while a class is ongoing.
              </p>
            </div>
            <Button variant="outline" onClick={() => void load()} disabled={refreshing}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>

          {error ? <ErrorDisplay message={error} onRetry={() => void load()} /> : null}
          {!error && sections === null ? <LoadingSpinner /> : null}
          {!error && sections?.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
                You are not a QAC in any class. Your professor gives this role.
              </CardContent>
            </Card>
          ) : null}

          {!section && sections && sections.length > 0 ? (
            <ul className="space-y-3">
              {sections.map((item) => {
                const live = item.sessions.some((slot) => slot.open)
                return (
                  <li key={item.sectionId}>
                    <button
                      type="button"
                      onClick={() => setSelected(item.sectionId)}
                      className="flex w-full items-center gap-3 border border-zinc-200 bg-white p-4 text-left hover:border-maroon dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-golden"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-heading text-base font-bold text-foreground">{item.subjectName}</span>
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                          {item.subjectCode} · {heading(item)} · {item.teacherName}
                        </span>
                        <span className={`mt-1 block text-xs font-bold ${live ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400'}`}>
                          {live ? 'Class is ongoing — add photos' : 'No class is ongoing'}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {section ? (
            <div className="space-y-4">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> All my QAC classes
              </Button>
              <Card>
                <CardContent className="space-y-4 p-4 sm:p-6">
                  <div>
                    <h2 className="break-words font-heading text-lg font-bold text-foreground">{section.subjectName}</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {section.subjectCode} · {heading(section)} · {section.teacherName}
                    </p>
                  </div>
                  <div className="space-y-2 border-y border-zinc-200 py-3 dark:border-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Compile this section&rsquo;s class photos, with their date and time stamps, into one PDF.
                    </p>
                    <PhotoReportButton
                      key={section.sectionId}
                      scope={{ sectionId: section.sectionId }}
                      label={section.section}
                      chooseDates
                    />
                  </div>
                  {open.map((slot) => (
                    <OpenSession key={slot.id} section={section} slot={slot} user={user} onChanged={load} />
                  ))}
                  {open.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No class is ongoing right now. Photos can be added during class, until 15 minutes after it ends.
                    </p>
                  ) : null}
                  {closed.length > 0 ? (
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Other classes today</p>
                      <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {closed.map((slot) => (
                          <li key={slot.id}>
                            {times(slot)}
                            {slot.room ? ` · ${slot.room}` : ''} · {slot.myPhotoCount} photo{slot.myPhotoCount === 1 ? '' : 's'} from you
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
