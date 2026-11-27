import { PROOF_PHOTO_MAX_BYTES } from '@polycheck/shared'
import { API_BASE } from '@/lib/api-config'

/** Photos straight from a camera can be large; anything bigger than this is not a class photo. */
const MAX_SOURCE_BYTES = 30_000_000
/** What compression aims for: sharp enough to count heads, small enough to store thousands. */
const TARGET_BYTES = 450_000
/** Longest side and JPEG quality, tried in order until the photo is small enough. */
const STEPS: ReadonlyArray<readonly [number, number]> = [
  [1600, 0.72],
  [1600, 0.6],
  [1280, 0.55],
  [1024, 0.5],
]

export class PhotoError extends Error {}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new PhotoError('The photo could not be read.'))
    reader.readAsDataURL(blob)
  })

/**
 * Shrinks a photo to a small JPEG before it is uploaded. Redrawing it also drops the hidden camera data,
 * including the GPS position where it was taken.
 */
export async function compressPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new PhotoError('Choose a photo file.')
  if (file.size > MAX_SOURCE_BYTES) throw new PhotoError('That photo is too large. Take it again at a lower resolution.')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoError('This photo could not be opened. Use a JPG, PNG or WebP photo.')
  }
  try {
    const canvas = document.createElement('canvas')
    let smallest: Blob | null = null
    for (const [side, quality] of STEPS) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) break
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      smallest = await toBlob(canvas, quality)
      if (smallest && smallest.size <= TARGET_BYTES) break
    }
    if (!smallest || smallest.size > PROOF_PHOTO_MAX_BYTES) {
      throw new PhotoError('The photo could not be made small enough. Try another one.')
    }
    return await toDataUrl(smallest)
  } finally {
    bitmap.close()
  }
}

/** A stored photo is served by the API, which may live on another address than this site. */
export function proofImageUrl(path: string): string {
  if (/^(https?:|data:|blob:)/.test(path)) return path
  return /^https?:/.test(API_BASE) ? new URL(path, API_BASE).toString() : path
}
