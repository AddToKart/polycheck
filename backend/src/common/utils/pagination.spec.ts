import { parsePagination, paginate, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from './pagination'

describe('pagination utility', () => {
  describe('parsePagination', () => {
    it('returns defaults when no parameters provided', () => {
      const result = parsePagination()
      expect(result).toEqual({ limit: DEFAULT_PAGE_SIZE, offset: 0 })
      expect(result.limit).toBe(50)
      expect(result.offset).toBe(0)
    })

    it('uses provided custom values', () => {
      const result = parsePagination('25', '40')
      expect(result).toEqual({ limit: 25, offset: 40 })
    })

    it('clamps limit to MAX_PAGE_SIZE when exceeding', () => {
      const result = parsePagination('500', '0')
      expect(result.limit).toBe(MAX_PAGE_SIZE)
      expect(result.limit).toBe(100)
    })

    it('clamps limit to 1 when below minimum', () => {
      const result = parsePagination('0', '0')
      expect(result.limit).toBe(1)
    })

    it('clamps negative limit to 1', () => {
      const result = parsePagination('-10', '0')
      expect(result.limit).toBe(1)
    })

    it('clamps negative offset to 0', () => {
      const result = parsePagination('10', '-20')
      expect(result.limit).toBe(10)
      expect(result.offset).toBe(0)
    })

    it('falls back to defaults for non-numeric values', () => {
      const result = parsePagination('abc', 'xyz')
      expect(result).toEqual({ limit: DEFAULT_PAGE_SIZE, offset: 0 })
    })
  })

  describe('paginate', () => {
    it('returns a paginated result with hasMore true when more data exists', () => {
      const data = [1, 2, 3]
      const result = paginate(data, 10, { limit: 3, offset: 0 })
      expect(result).toEqual({
        data: [1, 2, 3],
        total: 10,
        limit: 3,
        offset: 0,
        hasMore: true,
      })
    })

    it('returns hasMore false when all data consumed', () => {
      const data = [1, 2, 3]
      const result = paginate(data, 3, { limit: 3, offset: 0 })
      expect(result.hasMore).toBe(false)
    })

    it('respects offset for hasMore computation', () => {
      const data = [4, 5]
      const result = paginate(data, 5, { limit: 2, offset: 3 })
      expect(result.hasMore).toBe(false)
    })

    it('returns hasMore true when offset + data length is less than total', () => {
      const data = [4, 5]
      const result = paginate(data, 6, { limit: 2, offset: 3 })
      expect(result.hasMore).toBe(true)
    })
  })
})
