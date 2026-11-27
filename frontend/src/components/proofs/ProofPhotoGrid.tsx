'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { ProofOfClass } from '@polycheck/shared'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { proofImageUrl } from '@/lib/proof-photos'

const taken = (proof: ProofOfClass) => new Date(proof.uploadedAt).toLocaleString()

/** Class photos as thumbnails; tapping one opens it full size. */
export function ProofPhotoGrid({
  proofs,
  onDelete,
  isDeleting,
}: {
  proofs: ProofOfClass[]
  /** Given only to the professor, who may delete photos. */
  onDelete?: (proof: ProofOfClass) => void
  isDeleting?: (proof: ProofOfClass) => boolean
}) {
  const [open, setOpen] = useState<ProofOfClass | null>(null)

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {proofs.map((proof) => (
          <div key={proof.id} className="min-w-0 border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setOpen(proof)}
              className="block w-full"
              aria-label={`View the photo from ${proof.uploadedByStudentName}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- private photo served by the API with the session cookie */}
              <img
                src={proofImageUrl(proof.photoData)}
                alt={`Class photo from ${proof.uploadedByStudentName}`}
                loading="lazy"
                className="aspect-video w-full bg-zinc-200 object-cover dark:bg-zinc-800"
              />
            </button>
            <p className="mt-2 truncate text-xs font-medium text-foreground">{proof.uploadedByStudentName}</p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{taken(proof)}</p>
            {proof.description ? (
              <p className="mt-1 break-words text-[10px] italic text-zinc-500 dark:text-zinc-400">&quot;{proof.description}&quot;</p>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className="mt-2 flex min-h-8 items-center gap-1 text-[10px] text-red-500 hover:text-red-700 disabled:opacity-50"
                disabled={isDeleting?.(proof)}
                onClick={() => onDelete(proof)}
              >
                <Trash2 className="h-3 w-3" />
                {isDeleting?.(proof) ? 'Deleting…' : 'Delete'}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <Dialog open={open !== null} onOpenChange={(next) => (next ? undefined : setOpen(null))}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Class photo</DialogTitle>
            <DialogDescription>{open ? `${open.uploadedByStudentName} · ${taken(open)}` : ''}</DialogDescription>
          </DialogHeader>
          {open ? (
            // eslint-disable-next-line @next/next/no-img-element -- private photo served by the API with the session cookie
            <img
              src={proofImageUrl(open.photoData)}
              alt={`Class photo from ${open.uploadedByStudentName}`}
              className="mt-3 max-h-[70dvh] w-full object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
