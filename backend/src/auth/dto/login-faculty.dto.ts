import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

export class LoginFacultyDto {
  @IsEmail()
  @MaxLength(254)
  email!: string

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string
}
