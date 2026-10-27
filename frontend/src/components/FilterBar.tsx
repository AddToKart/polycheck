'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const controlClass =
  'h-9 w-full rounded-none border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-maroon focus:ring-2 focus:ring-maroon/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'

export interface FilterOption {
  value: string
  label: string
}

interface FilterBarProps {
  children: ReactNode
  onClear?: () => void
  activeCount?: number
  label?: string
  className?: string
}

/** Square, token-based filter container shared by the attendance workspaces. */
export function FilterBar({ children, onClear, activeCount = 0, label = 'Filters', className }: FilterBarProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        'flex flex-wrap items-end gap-3 border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/30',
        className,
      )}
    >
      {children}
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          disabled={activeCount === 0}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-none border border-zinc-300 bg-white px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:border-maroon hover:text-maroon disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-golden dark:hover:text-golden"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear all
          {activeCount > 0 ? <span aria-hidden="true">({activeCount})</span> : null}
        </button>
      ) : null}
    </section>
  )
}

interface FilterFieldProps {
  id?: string
  label: string
  children: ReactNode
  className?: string
}

export function FilterField({ id, label, children, className }: FilterFieldProps) {
  return (
    <div className={cn('min-w-[9rem] space-y-1', className)}>
      <label
        htmlFor={id}
        className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

interface FilterSelectProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
  allLabel?: string
  className?: string
}

export function FilterSelect({ id, label, value, onChange, options, allLabel, className }: FilterSelectProps) {
  return (
    <FilterField id={id} label={label} className={className}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(controlClass, 'cursor-pointer')}
      >
        {allLabel !== undefined ? <option value="">{allLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FilterField>
  )
}

interface FilterDateFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
}

export function FilterDateField({ id, label, value, onChange, className }: FilterDateFieldProps) {
  return (
    <FilterField id={id} label={label} className={cn('min-w-[8.5rem]', className)}>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-none text-xs"
      />
    </FilterField>
  )
}

interface FilterDateRangeProps {
  idPrefix: string
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  fromLabel?: string
  toLabel?: string
}

export function FilterDateRange({
  idPrefix,
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = 'From',
  toLabel = 'To',
}: FilterDateRangeProps) {
  return (
    <>
      <FilterDateField id={`${idPrefix}-from`} label={fromLabel} value={from} onChange={onFromChange} />
      <FilterDateField id={`${idPrefix}-to`} label={toLabel} value={to} onChange={onToChange} />
    </>
  )
}

interface FilterChipGroupProps {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  className?: string
}

/** Accessible single-select chip row (used for session lifecycle status). */
export function FilterChipGroup({ label, value, options, onChange, className }: FilterChipGroupProps) {
  return (
    <div className={cn('min-w-[9rem] space-y-1', className)}>
      <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-9 rounded-none border px-3 text-[10px] font-bold uppercase tracking-widest transition-colors',
              value === option.value
                ? 'border-maroon bg-maroon text-white dark:border-golden dark:bg-golden dark:text-maroon-dark'
                : 'border-zinc-300 bg-white text-zinc-500 hover:border-maroon hover:text-maroon dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-golden dark:hover:text-golden',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
