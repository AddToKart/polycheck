'use client'

import { useRef, useState } from 'react'
import { Camera, ImagePlus, Upload, X } from 'lucide-react'
import { PROOF_PHOTOS_PER_SESSION } from '@polycheck/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api-client'
import { describeMutationError } from '@/lib/run-mutation'
import { compressPhoto } from '@/lib/proof-photos'

interface PickedPhoto {
  key: string
  dataUrl: string
}

/** Take or choose up to four class photos, check them, then upload them to one session. */
export function ProofUploader({
  sectionId,
  sessionId,
  alreadyUploaded,
  uploader,
  onUploaded,
}: {
  sectionId: string
  sessionId: string
  /** Photos this officer has already added to the session. */
  alreadyUploaded: number
  uploader: { id: string; fullName: string }
  onUploaded: () => void | Promise<void>
}) {
  const [picked, setPicked] = useState<PickedPhoto[]>([])
  const [description, setDescription] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const counter = useRef(0)
  const remaining = Math.max(0, PROOF_PHOTOS_PER_SESSION - alreadyUploaded)
  const room = Math.max(0, remaining - picked.length)

  const choose = async (files: FileList | null) => {
    const chosen = Array.from(files ?? [])
    if (chosen.length === 0) return
    setError('')
    setDone('')
    if (chosen.length > room) {
      setError(`You can add ${room} more photo${room === 1 ? '' : 's'} to this session. The extra ones were left out.`)
    }
    setPreparing(true)
    try {
      for (const file of chosen.slice(0, room)) {
        const dataUrl = await compressPhoto(file)
        counter.current += 1
        const key = `photo-${counter.current}`
        setPicked((current) => [...current, { key, dataUrl }])
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That photo could not be added.')
    } finally {
      setPreparing(false)
    }
  }

  const upload = async () => {
    setUploading(true)
    setError('')
    setDone('')
    let sent = 0
    try {
      // One at a time: whatever already went through stays uploaded if a later one fails.
      for (const photo of picked) {
        await api.uploadProofOfClass({
          sectionId,
          sessionId,
          photoData: photo.dataUrl,
          description: description.trim() || undefined,
          uploadedBy: uploader.id,
          uploadedByStudentName: uploader.fullName,
        })
        sent += 1
        setPicked((current) => current.filter((item) => item.key !== photo.key))
      }
      setDescription('')
      setDone(`${sent} photo${sent === 1 ? '' : 's'} uploaded.`)
    } catch (cause) {
      setError(
        `${sent > 0 ? `${sent} uploaded. ` : ''}${describeMutationError(cause, 'The photo could not be uploaded.')}`,
      )
    } finally {
      setUploading(false)
      if (sent > 0) await onUploaded()
    }
  }

  const picker = (label: string, icon: React.ReactNode, camera: boolean) => (
    <label
      className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 border border-zinc-300 px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 ${
        room === 0 || preparing || uploading ? 'pointer-events-none opacity-50' : ''
      }`}
    >
      {icon}
      {label}
      <input
        type="file"
        accept="image/*"
        {...(camera ? { capture: 'environment' as const } : { multiple: true })}
        className="sr-only"
        disabled={room === 0 || preparing || uploading}
        onChange={(event) => {
          void choose(event.target.files)
          event.target.value = ''
        }}
      />
    </label>
  )

  return (
    <div className="space-y-3 border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        {remaining === 0
          ? `You have added all ${PROOF_PHOTOS_PER_SESSION} photos for this session.`
          : `You can add ${remaining} more photo${remaining === 1 ? '' : 's'} to this session. Photos are made smaller automatically.`}
      </p>
      {remaining > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {picker('Take a photo', <Camera className="h-4 w-4" aria-hidden="true" />, true)}
            {picker('Choose photos', <ImagePlus className="h-4 w-4" aria-hidden="true" />, false)}
          </div>
          {picked.length > 0 ? (
            <>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {picked.map((photo, index) => (
                  <li key={photo.key} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a photo not yet uploaded */}
                    <img src={photo.dataUrl} alt={`Photo ${index + 1} to upload`} className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPicked((current) => current.filter((item) => item.key !== photo.key))}
                      disabled={uploading}
                      aria-label={`Remove photo ${index + 1}`}
                      className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center bg-black/60 text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <Input
                placeholder="Add a note (optional)"
                aria-label="Photo note"
                value={description}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
              />
              <Button onClick={() => void upload()} disabled={uploading || preparing} className="w-full">
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                {uploading ? 'Uploading…' : `Upload ${picked.length} photo${picked.length === 1 ? '' : 's'}`}
              </Button>
            </>
          ) : null}
        </>
      ) : null}
      {preparing ? <p role="status" className="text-xs text-zinc-500">Preparing the photo…</p> : null}
      {error ? <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      {done ? <p role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{done}</p> : null}
    </div>
  )
}
