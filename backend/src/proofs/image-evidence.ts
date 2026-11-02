import { BadRequestException } from '@nestjs/common'

export interface DecodedImageEvidence {
  buffer: Buffer
  extension: string
  mime: string
}

/**
 * Decodes the data-URL image format used by proof-of-class and excuse
 * evidence. The magic-byte check prevents a caller from storing arbitrary
 * content under an image content type.
 */
export function decodeImageDataUrl(value: string, maxBytes: number, label = 'Image'): DecodedImageEvidence {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match) throw new BadRequestException(`${label} must be a JPEG, PNG, or WebP data URL`)
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length === 0 || buffer.length > maxBytes) {
    throw new BadRequestException(`${label} image must be between 1 byte and ${maxBytes} bytes`)
  }
  const mime = match[1]
  const validMagic =
    (mime === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
    (mime === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mime === 'image/webp' &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP')
  if (!validMagic) throw new BadRequestException(`${label} image content does not match its declared type`)
  return { buffer, extension: mime === 'image/jpeg' ? 'jpg' : mime.slice('image/'.length), mime }
}
