import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { ConfigService } from '@nestjs/config'
import { ProofStorageService } from './proof-storage.service'

describe('ProofStorageService', () => {
  it('stores, reads, and removes local development proofs', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'polycheck-proofs-'))
    const config = {
      get: jest.fn((key: string) => ({ STORAGE_DRIVER: 'local', UPLOAD_DIR: directory })[key]),
    }
    const storage = new ProofStorageService(config as unknown as ConfigService)

    try {
      const reference = await storage.store(Buffer.from([0xff, 0xd8, 0xff]), 'jpg', 'image/jpeg')
      await expect(storage.read(reference)).resolves.toEqual({
        buffer: Buffer.from([0xff, 0xd8, 0xff]),
        contentType: 'image/jpeg',
      })
      await storage.remove(reference)
      await expect(storage.read(reference)).rejects.toThrow('Proof file not found')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
