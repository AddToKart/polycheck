export const MAX_PAGE_SIZE = 100
export const DEFAULT_PAGE_SIZE = 50

export interface PaginationParams {
  limit: number
  offset: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export function parsePagination(limit?: string, offset?: string): PaginationParams {
  const parsedLimit = parseInteger(limit, DEFAULT_PAGE_SIZE)
  const parsedOffset = parseInteger(offset, 0)
  return {
    limit: Math.min(Math.max(1, parsedLimit), MAX_PAGE_SIZE),
    offset: Math.max(0, parsedOffset),
  }
}

function parseInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function paginate<T>(data: T[], total: number, params: PaginationParams): PaginatedResult<T> {
  return {
    data,
    total,
    limit: params.limit,
    offset: params.offset,
    hasMore: params.offset + data.length < total,
  }
}
