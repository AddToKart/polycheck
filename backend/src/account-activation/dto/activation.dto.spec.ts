import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { ActivationCompleteDto, ActivationRequestLinkDto, ActivationValidateDto } from './activation.dto'

const TOKEN = 'A'.repeat(43)

describe('activation DTOs', () => {
  it('accepts well-formed complete and request-link bodies', async () => {
    const complete = plainToInstance(ActivationCompleteDto, {
      token: TOKEN,
      studentId: '2024-00001-MN-0',
      password: 'Sturdy-Pass#2026',
    })
    const request = plainToInstance(ActivationRequestLinkDto, { studentId: '2024-00001-mn-0', email: 'a@b.ph' })
    await expect(validate(complete)).resolves.toEqual([])
    await expect(validate(request)).resolves.toEqual([])
    await expect(validate(plainToInstance(ActivationValidateDto, { token: TOKEN }))).resolves.toEqual([])
  })

  it.each([
    ['a short token', { token: 'short' }],
    ['a malformed student number', { studentId: '2024-1' }],
    ['a password without a symbol', { password: 'NoSymbolsHere123' }],
    ['a password under 12 characters', { password: 'Aa1!short' }],
  ])('rejects %s on complete', async (_label, override) => {
    const dto = plainToInstance(ActivationCompleteDto, {
      token: TOKEN,
      studentId: '2024-00001-MN-0',
      password: 'Sturdy-Pass#2026',
      ...override,
    })
    expect((await validate(dto)).length).toBeGreaterThan(0)
  })

  it('rejects an invalid email on request-link', async () => {
    const dto = plainToInstance(ActivationRequestLinkDto, { studentId: '2024-00001-MN-0', email: 'not-an-email' })
    expect((await validate(dto)).length).toBeGreaterThan(0)
  })
})
