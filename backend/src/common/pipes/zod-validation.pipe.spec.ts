import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from './zod-validation.pipe'

describe('ZodValidationPipe', () => {
  const schema = z.object({
    name: z.string().min(2),
    age: z.number().int().min(0),
  })

  it('returns parsed data for valid input', () => {
    const pipe = new ZodValidationPipe(schema)
    const input = { name: 'Alice', age: 25 }
    const result = pipe.transform(input)
    expect(result).toEqual(input)
  })

  it('applies schema transforms/coercion and returns parsed data', () => {
    const coercingSchema = z.object({
      count: z.coerce.number().int(),
    })
    const pipe = new ZodValidationPipe(coercingSchema)
    const result = pipe.transform({ count: '7' })
    expect(result).toEqual({ count: 7 })
  })

  it('throws BadRequestException with structured errors for invalid input', () => {
    const pipe = new ZodValidationPipe(schema)
    expect(() => pipe.transform({ name: 'a', age: -1 })).toThrow(BadRequestException)
  })

  it('exposes mapped error fields and messages in the exception', () => {
    const pipe = new ZodValidationPipe(schema)
    try {
      pipe.transform({ name: 'a', age: -1 })
      fail('Expected pipe to throw BadRequestException')
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException)
      const response = (error as BadRequestException).getResponse() as {
        message: string
        errors: { field: string; message: string }[]
      }
      expect(response.message).toBe('Validation failed')
      const fields = response.errors.map((e) => e.field)
      expect(fields).toContain('name')
      expect(fields).toContain('age')
      for (const e of response.errors) {
        expect(typeof e.message).toBe('string')
        expect(e.message.length).toBeGreaterThan(0)
      }
    }
  })

  it('aggregates multiple errors for multiple invalid fields', () => {
    const pipe = new ZodValidationPipe(schema)
    try {
      pipe.transform({ name: 123, age: 'not-a-number' })
      fail('Expected pipe to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException)
      const response = (error as BadRequestException).getResponse() as {
        errors: { field: string; message: string }[]
      }
      expect(response.errors.length).toBeGreaterThanOrEqual(2)
    }
  })
})
