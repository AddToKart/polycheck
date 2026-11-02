'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export interface SettingSwitchProps {
  /** Setting key — also the input id, so the external label stays associated. */
  id: string
  label: string
  caption?: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}

/**
 * Labelled settings row for a boolean institution setting. Uses the shared
 * square `Switch` primitive (role=switch, Space toggles, golden focus ring) and
 * keeps the label, caption, and control accessible to assistive technology.
 */
export function SettingSwitch({
  id,
  label,
  caption,
  checked,
  disabled = false,
  onCheckedChange,
  className,
}: SettingSwitchProps) {
  const captionId = caption ? `${id}-caption` : undefined

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className={cn('min-w-0', disabled && 'opacity-60')}>
        <Label
          htmlFor={id}
          className={cn('text-sm', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
        >
          {label}
        </Label>
        {caption ? (
          <p
            id={captionId}
            className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400"
          >
            {caption}
          </p>
        ) : null}
      </div>

      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={captionId}
        className="mt-0.5"
      />
    </div>
  )
}
