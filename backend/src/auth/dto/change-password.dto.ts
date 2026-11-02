import { IsOptional, IsString, MaxLength } from 'class-validator'
import { IsStrongPassword } from '../../common/decorators/strong-password.decorator'

export class ChangePasswordDto {
  /**
   * Required for voluntary password changes. Optional only for accounts that
   * were provisioned with a temporary password and are forced to rotate it.
   */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword?: string

  @IsStrongPassword()
  newPassword!: string
}
