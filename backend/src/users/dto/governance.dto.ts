import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator'

export type EmergencyDeviceReleaseReason = 'dead_battery' | 'lost_or_damaged' | 'borrowed_device' | 'other'

export class TeacherResetStudentPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sectionId!: string
}

export class EmergencyDeviceReleaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sectionId!: string

  @IsIn(['dead_battery', 'lost_or_damaged', 'borrowed_device', 'other'])
  reason!: EmergencyDeviceReleaseReason

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string
}

export class UpdateContactsDto {
  /** Empty string clears the stored secondary email. */
  @IsOptional()
  @IsString()
  @MaxLength(254)
  @ValidateIf((value: UpdateContactsDto) => value.contactEmail !== '')
  @IsEmail()
  contactEmail?: string

  /** Empty string clears the stored emergency mobile number. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @ValidateIf((value: UpdateContactsDto) => value.contactPhone !== '')
  contactPhone?: string
}

export class UnregisterDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string
}
