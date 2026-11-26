import { Check, X } from 'lucide-react'
import { passwordChecks } from '@/lib/activation'

/**
 * Live password checklist: every rule is shown from the first keystroke with a check when it is met and an X
 * while it is missing, so people see what is left without submitting first. Mirrors the backend policy.
 */
export function PasswordRequirements({ password, className = '' }: { password: string; className?: string }) {
  const checks = passwordChecks(password)
  return (
    <ul className={`space-y-1 ${className}`} aria-label="Password requirements">
      {checks.map((item) => (
        <li
          key={item.id}
          data-met={item.met}
          className={`flex items-center gap-2 text-xs ${
            item.met ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
          }`}
        >
          {item.met ? (
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>
            {item.label}
            <span className="sr-only">{item.met ? ' (met)' : ' (not met)'}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
