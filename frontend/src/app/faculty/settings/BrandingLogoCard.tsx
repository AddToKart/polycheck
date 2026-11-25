'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BrandLogo, BRANDING_CHANGED_EVENT, useBranding } from '@/components/branding/BrandingProvider'
import { api } from '@/lib/api-client'
import { describeMutationError } from '@/lib/run-mutation'

const MAX_BYTES = 256 * 1024
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.readAsDataURL(file)
  })
}

/** Institution logo: shown on the login screen, ID cards, kiosk and sidebar. Falls back to the Polycheck mark. */
export function BrandingLogoCard({ disabled }: { disabled: boolean }) {
  const { logoDataUrl } = useBranding()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const finish = (text: string, tone: 'success' | 'error') => {
    setMessage({ tone, text })
    if (tone === 'success') window.dispatchEvent(new Event(BRANDING_CHANGED_EVENT))
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (!ACCEPTED.includes(file.type)) return finish('Choose a PNG, JPEG or WebP image.', 'error')
    if (file.size > MAX_BYTES) return finish('The logo must be 256 KB or smaller.', 'error')
    setBusy(true)
    try {
      await api.setBrandingLogo(await readAsDataUrl(file))
      finish('Logo updated.', 'success')
    } catch (error) {
      finish(describeMutationError(error), 'error')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onRemove = async () => {
    setBusy(true)
    try {
      await api.clearBrandingLogo()
      finish('Logo removed. The default Polycheck mark is shown.', 'success')
    } catch (error) {
      finish(describeMutationError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 border border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center">
      <BrandLogo size={64} className="h-16 w-16 shrink-0 object-contain" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold">Institution logo</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          PNG, JPEG or WebP, up to 256 KB. A square image works best. Without one, the default Polycheck mark is used.
        </p>
        {message ? (
          <p role={message.tone === 'error' ? 'alert' : 'status'} className={message.tone === 'error' ? 'text-xs text-red-600' : 'text-xs text-green-700'}>
            {message.text}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Upload institution logo"
          disabled={disabled || busy}
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
          {logoDataUrl ? 'Replace logo' : 'Upload logo'}
        </Button>
        {logoDataUrl ? (
          <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => void onRemove()}>
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  )
}
