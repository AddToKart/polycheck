import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateStudentDto, CreateTeacherDto, ResetPasswordDto } from './manage-user.dto'

describe('user management DTOs', () => {
  it('accepts a complete student account request and converts the year level', async () => {
    const dto = plainToInstance(CreateStudentDto, {
      fullName: 'Test Student',
      studentId: '2026-00001-MN-0',
      email: 'student@iskolarngbayan.pup.edu.ph',
      password: 'Temporary1!Secure',
      program: 'BS Computer Science',
      yearLevel: '2',
      department: 'CCIS',
    })

    await expect(validate(dto)).resolves.toEqual([])
    expect(dto.yearLevel).toBe(2)
  })

  it.each([
    ['weak password', { password: 'too-weak' }],
    ['malformed student ID', { studentId: '2026-1' }],
    ['invalid year level', { yearLevel: 9 }],
    ['missing department', { department: undefined }],
  ])('rejects student requests with %s', async (_label, override) => {
    const dto = plainToInstance(CreateStudentDto, {
      fullName: 'Test Student',
      studentId: '2026-00001-MN-0',
      password: 'Temporary1!Secure',
      program: 'BS Computer Science',
      yearLevel: 2,
      department: 'CCIS',
      ...override,
    })

    await expect(validate(dto)).resolves.not.toEqual([])
  })

  it('applies the same strong-password policy to teacher creation and password resets', async () => {
    const teacher = plainToInstance(CreateTeacherDto, {
      fullName: 'Test Teacher',
      email: 'teacher@pup.edu.ph',
      password: 'weak-password',
    })
    const reset = plainToInstance(ResetPasswordDto, { password: 'weak-password' })

    expect(await validate(teacher)).not.toEqual([])
    expect(await validate(reset)).not.toEqual([])
  })
})
