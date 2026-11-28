'use client'

import { Input } from '@/components/ui/input'

/** What is wrong with a whole-number field, or null. */
export function numberRangeIssue(value: string, min: number, max: number): string | null {
  const text = value.trim()
  if (!text) return `Enter a number from ${min} to ${max}.`
  if (!/^\d+$/.test(text)) return 'Use digits only.'
  const number = Number(text)
  return number < min || number > max ? `Enter a number from ${min} to ${max}.` : null
}

interface NumberFieldProps {
  id: string
  label: string
  unit: string
  value: string
  onChange: (value: string) => void
  min: number
  max: number
}

/**
 * A whole-number field that says what is wrong right under itself. A `type="number"` input accepted
 * text such as `55235e` and reported it to the page as empty, with nothing shown.
 */
export function NumberField({ id, label, unit, value, onChange, min, max }: NumberFieldProps) {
  const issue = numberRangeIssue(value, min, max)
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          maxLength={String(max).length}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
          aria-invalid={issue ? true : undefined}
          aria-describedby={issue ? `${id}-issue` : undefined}
          className={`w-full text-center font-bold ${issue ? 'border-red-600 focus-visible:ring-red-600/30 dark:border-red-400' : ''}`}
        />
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{unit}</span>
      </div>
      {issue ? (
        <p id={`${id}-issue`} role="alert" className="mt-1 text-xs font-semibold text-red-600 dark:text-red-300">
          {issue}
        </p>
      ) : null}
    </div>
  )
}
