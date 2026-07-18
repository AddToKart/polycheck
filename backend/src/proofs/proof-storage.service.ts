import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { extname, resolve } from 'path'

export interface StoredProof {
  buffer: Buffer
  contentType: string
}

@Injectable()
export class ProofStorageService implements OnModuleInit {
  private readonly driver: 'local' | 's3'
  private readonly s3?: S3Client

  constructor(private readonly config: ConfigService) {
    this.driver = config.get<'local' | 's3'>('STORAGE_DRIVER') ?? 'local'
    if (this.driver === 's3') {
      const accessKeyId = config.get<string>('S3_ACCESS_KEY_ID')
      const secretAccessKey = config.get<string>('S3_SECRET_ACCESS_KEY')
      this.s3 = new S3Client({
        region: config.get<string>('S3_REGION') ?? 'us-east-1',
        endpoint: config.get<string>('S3_ENDPOINT') || undefined,
        forcePathStyle: config.get<boolean>('S3_FORCE_PATH_STYLE') ?? false,
        ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
      })
    }
  }

  async onModuleInit() {
    if (this.driver !== 's3') return
    await this.s3!.send(new HeadBucketCommand({ Bucket: this.config.getOrThrow<string>('S3_BUCKET') }))
  }

  async store(buffer: Buffer, extension: string, contentType: string) {
    const fileName = `${randomUUID()}.${extension}`
    if (this.driver === 's3') {
      const bucket = this.config.getOrThrow<string>('S3_BUCKET')
      const key = `proofs/${fileName}`
      await this.s3!.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }))
      return `s3://${bucket}/${key}`
    }
    const directory = await this.localDirectory()
    await writeFile(resolve(directory, fileName), buffer, { flag: 'wx' })
    return `/uploads/${fileName}`
  }

  async read(reference: string): Promise<StoredProof> {
    if (reference.startsWith('s3://')) {
      const { bucket, key } = this.parseS3Reference(reference)
      const result = await this.s3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      if (!result.Body) throw new NotFoundException('Proof file not found')
      return {
        buffer: Buffer.from(await result.Body.transformToByteArray()),
        contentType: result.ContentType ?? this.contentType(key),
      }
    }
    const path = await this.localPath(reference)
    try {
      return { buffer: await readFile(path), contentType: this.contentType(path) }
    } catch {
      throw new NotFoundException('Proof file not found')
    }
  }

  async remove(reference: string) {
    if (reference.startsWith('s3://')) {
      const { bucket, key } = this.parseS3Reference(reference)
      await this.s3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      return
    }
    const path = await this.localPath(reference).catch(() => null)
    if (path) await unlink(path).catch(() => undefined)
  }

  private s3Client() {
    if (!this.s3) throw new NotFoundException('S3 proof storage is not configured')
    return this.s3
  }

  private parseS3Reference(reference: string) {
    const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(reference)
    if (!match) throw new NotFoundException('Proof file not found')
    return { bucket: match[1], key: match[2] }
  }

  private async localDirectory() {
    const directory = resolve(this.config.get<string>('UPLOAD_DIR') ?? 'uploads')
    await mkdir(directory, { recursive: true })
    return directory
  }

  private async localPath(reference: string) {
    if (!reference.startsWith('/uploads/')) throw new NotFoundException('Proof file not found')
    const directory = await this.localDirectory()
    const path = resolve(directory, reference.slice('/uploads/'.length))
    if (!path.startsWith(`${directory}\\`) && !path.startsWith(`${directory}/`)) {
      throw new NotFoundException('Proof file not found')
    }
    return path
  }

  private contentType(path: string) {
    const extension = extname(path).toLowerCase()
    return extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
  }
}
