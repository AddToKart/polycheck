import { describe, expect, it } from 'vitest'
import {
  activationFormProblem,
  describeActivationFailure,
  isPasswordAcceptable,
  normalizeStudentNumber,
  passwordChecks,
  readActivationToken,
} from './activation'

const TOKEN = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v'

describe('readActivationToken', () => {
  it('reads the token from the URL fragment', () => {
    expect(readActivationToken(`#token=${TOKEN}`)).toBe(TOKEN)
    expect(readActivationToken(`token=${TOKEN}`)).toBe(TOKEN)
    expect(readActivationToken(`#foo=1&token=${TOKEN}`)).toBe(TOKEN)
  })

  it('rejects missing, short or malformed tokens', () => {
    expect(readActivationToken('')).toBeNull()
    expect(readActivationToken('#')).toBeNull()
    expect(readActivationToken('#token=')).toBeNull()
    expect(readActivationToken('#token=short')).toBeNull()
    expect(readActivationToken(`#token=${TOKEN}%20junk`)).toBeNull()
    expect(readActivationToken('#other=value')).toBeNull()
  })
})

describe('student number and password policy', () => {
  it('normalizes spacing and case', () => {
    expect(normalizeStudentNumber(' 2024-00001-mn-0 ')).toBe('2024-00001-MN-0')
  })

  it('mirrors the server password policy', () => {
    expect(isPasswordAcceptable('Sturdy-Pass#2026')).toBe(true)
    for (const weak of ['short1!A', 'alllowercase1234!', 'ALLUPPERCASE1234!', 'NoNumbersHere!!', 'NoSymbols12345Aa']) {
      expect(isPasswordAcceptable(weak)).toBe(false)
    }
    expect(passwordChecks('').every((check) => !check.met)).toBe(true)
    expect(passwordChecks('Sturdy-Pass#2026').every((check) => check.met)).toBe(true)
  })

  it('reports the first blocking problem with the form', () => {
    const good = { studentId: '2024-00001-MN-0', password: 'Sturdy-Pass#2026', confirm: 'Sturdy-Pass#2026' }
    expect(activationFormProblem(good)).toBeNull()
    expect(activationFormProblem({ ...good, studentId: '2024-1' })).toBe('student_number')
    expect(activationFormProblem({ ...good, studentId: ' 2024-00001-mn-0 ' })).toBeNull()
    expect(activationFormProblem({ ...good, password: 'weak', confirm: 'weak' })).toBe('password')
    expect(activationFormProblem({ ...good, confirm: 'Different-Pass#2026' })).toBe('mismatch')
  })
})

describe('describeActivationFailure', () => {
  it('maps the typed API errors the page must react to', () => {
    expect(describeActivationFailure({ status: 400, code: 'activation_link_invalid' })).toEqual({ kind: 'invalid_link' })
    expect(describeActivationFailure({ status: 400, code: 'activation_student_number_mismatch' })).toMatchObject({
      kind: 'student_number',
    })
    expect(describeActivationFailure({ status: 400, code: 'activation_rate_limited' })).toMatchObject({
      kind: 'rate_limited',
    })
    expect(describeActivationFailure({ status: 429 })).toMatchObject({ kind: 'rate_limited' })
    expect(describeActivationFailure({ status: 400, message: 'Password does not meet the strength requirements' })).toEqual({
      kind: 'password',
      message: 'Password does not meet the strength requirements',
    })
  })

  it('treats anything without an HTTP status as a retry-safe network problem', () => {
    for (const error of [new TypeError('Failed to fetch'), null, undefined, { message: 'timeout' }]) {
      expect(describeActivationFailure(error)).toMatchObject({ kind: 'network' })
    }
    expect(describeActivationFailure({ status: 503 })).toMatchObject({ kind: 'network' })
  })
})
