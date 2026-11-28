'use client'

import { FilterField, FilterSelect, type FilterOption } from '@/components/FilterBar'
import { Input } from '@/components/ui/input'

interface SearchAndSortProps {
  idPrefix: string
  query: string
  onQueryChange: (value: string) => void
  placeholder: string
  sort: string
  onSortChange: (value: string) => void
  /** The first option is the default order. */
  sortOptions: ReadonlyArray<FilterOption>
}

/** The search box and sort order every list shares, so they look and behave the same everywhere. */
export function SearchAndSort({
  idPrefix,
  query,
  onQueryChange,
  placeholder,
  sort,
  onSortChange,
  sortOptions,
}: SearchAndSortProps) {
  return (
    <>
      <FilterField id={`${idPrefix}-search`} label="Search" className="min-w-[12rem] flex-1">
        <Input
          id={`${idPrefix}-search`}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          className="h-9 rounded-none"
        />
      </FilterField>
      <FilterSelect
        id={`${idPrefix}-sort`}
        label="Sort by"
        value={sort}
        onChange={onSortChange}
        options={[...sortOptions]}
        className="min-w-[11rem]"
      />
    </>
  )
}
