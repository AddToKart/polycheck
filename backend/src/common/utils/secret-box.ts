import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const PREFIX = 'enc:v1:'

function deriveKey(secret: string) {
  return scryptSync(secret, 'polycheck-ai-key-v1', 32)
}

export function isSealedSecret(value: string): boolean {
  return value.startsWith(PREFIX)
}

export function sealSecret(value: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export function openSecret(value: string, secret: string): string | null {
  if (!isSealedSecret(value)) return null
  const [ivPart, tagPart, dataPart] = value.slice(PREFIX.length).split('.')
  if (!ivPart || !tagPart || !dataPart) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(ivPart, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    return null
  }
}
