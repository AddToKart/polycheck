import type { ElementType } from 'react'
import { Cpu, MapPin, ShieldAlert, Smartphone } from 'lucide-react'
import type { DisputeReason } from '@polycheck/shared'

type SecurityBadgeDefinition = {
  label: string
  icon: ElementType
  className: string
  iconClassName: string
}

const SECURITY_BADGES: Partial<Record<DisputeReason, SecurityBadgeDefinition>> = {
  rooted_device: {
    label: 'Rooted Device',
    icon: ShieldAlert,
    className: 'bg-red-950/80 border-red-500/60 text-red-300',
    iconClassName: 'text-red-400',
  },
  mocked_location: {
    label: 'Mock Location Provider',
    icon: MapPin,
    className: 'bg-amber-950/80 border-amber-500/60 text-amber-300',
    iconClassName: 'text-amber-400',
  },
  hook_detected: {
    label: 'Hooking Tool (Frida/Xposed)',
    icon: Cpu,
    className: 'bg-purple-950/80 border-purple-500/60 text-purple-300',
    iconClassName: 'text-purple-400',
  },
  emulator_detected: {
    label: 'Emulator Instance',
    icon: Smartphone,
    className: 'bg-red-950/90 border-red-700 text-red-400',
    iconClassName: 'text-red-400',
  },
}

export const SecurityDisputeBadge = ({ reason }: { reason?: DisputeReason }) => {
  const badge = reason ? SECURITY_BADGES[reason] : undefined
  if (!badge) return null

  const Icon = badge.icon
  return (
    <div
      className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
    >
      <Icon className={`h-3 w-3 shrink-0 ${badge.iconClassName}`} />
      {badge.label}
    </div>
  )
}
