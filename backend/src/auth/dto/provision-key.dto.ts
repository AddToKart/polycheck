import { IsString } from 'class-validator'

export class ProvisionKeyDto {
  @IsString()
  publicKey!: string
}
