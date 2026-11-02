import { describe, expect, it } from 'vitest'
import { isCancellationShapedError } from './abort-errors'

describe('isCancellationShapedError', () => {
  it('recognizes explicit abort errors', () => {
    expect(isCancellationShapedError(new DOMException('Aborted', 'AbortError'))).toBe(true)
    expect(isCancellationShapedError(new Error('The user aborted a request.'))).toBe(true)
  })

  it('recognizes engine cancellation messages', () => {
    expect(isCancellationShapedError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isCancellationShapedError(new Error('NetworkError when attempting to fetch resource.'))).toBe(true)
    expect(isCancellationShapedError(new TypeError('Load failed'))).toBe(true)
  })

  it('does not classify unrelated application errors as cancellations', () => {
    expect(isCancellationShapedError(new Error('Session expired'))).toBe(false)
    expect(isCancellationShapedError(new Error('Forbidden'))).toBe(false)
    expect(isCancellationShapedError(null)).toBe(false)
  })
})
