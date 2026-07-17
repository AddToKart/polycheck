import { IsString, Matches } from 'class-validator'

export class ProvisionKeyDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'publicKey must be a 32-byte Ed25519 base64url key' })
  publicKey!: string
}
