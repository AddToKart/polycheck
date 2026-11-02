'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  activeFilterCount,
  defaultUrlFilters,
  filterSearchString,
  readUrlFilters,
  writeUrlFilters,
  type UrlFilterSchema,
  type UrlFilterValues,
} from '@/lib/url-filters'

/**
 * URL-synced filter state. The hook owns only the keys declared in `schema`;
 * unrelated query parameters are preserved so links such as
 * `/student/dashboard?tab=attendance&subjectId=...` round-trip cleanly.
 */
export function useUrlFilters<S extends UrlFilterSchema>(schema: S) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const currentQuery = searchParams?.toString() ?? ''
  const values = readUrlFilters(schema, new URLSearchParams(currentQuery))

  const replace = (params: URLSearchParams) => {
    router.replace(`${pathname ?? ''}${filterSearchString(params)}`, { scroll: false })
  }

  const setFilters = (patch: Partial<UrlFilterValues<S>>) => {
    const params = new URLSearchParams(currentQuery)
    const nextValues = { ...readUrlFilters(schema, params), ...patch } as UrlFilterValues<S>
    replace(writeUrlFilters(schema, nextValues, params))
  }

  const setFilter = (key: keyof S & string, value: string) => {
    setFilters({ [key]: value } as Partial<UrlFilterValues<S>>)
  }

  const clearAll = () => {
    const params = new URLSearchParams(currentQuery)
    replace(writeUrlFilters(schema, defaultUrlFilters(schema), params))
  }

  return {
    values,
    setFilter,
    setFilters,
    clearAll,
    activeCount: activeFilterCount(schema, values),
  }
}
