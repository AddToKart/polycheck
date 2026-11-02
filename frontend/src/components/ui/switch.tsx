'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange' | 'role'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/**
 * Square switch built on a native checkbox so it stays keyboard operable and
 * can be associated with a `<Label htmlFor>`. The visible track is decorative;
 * the transparent input overlays it for pointer and keyboard interaction.
 */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <span className={cn('relative inline-flex h-6 w-11 shrink-0', className)}>
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none flex h-6 w-11 items-center border p-0.5 transition-colors',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-golden peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-zinc-900',
          'peer-disabled:opacity-60',
          checked
            ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden'
            : 'border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800',
        )}
      >
        <span
          className={cn(
            'block h-4 w-4 bg-white transition-transform motion-reduce:transition-none dark:bg-maroon-dark',
            checked ? 'translate-x-[22px]' : 'translate-x-0',
          )}
        />
      </span>
    </span>
  ),
)
Switch.displayName = 'Switch'

export { Switch }
