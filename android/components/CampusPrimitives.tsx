import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { AttendanceStatus } from '@polycheck/shared'
import { useTheme } from '../theme/ThemeContext'

const joinClasses = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

type CampusCardProps = {
  children: ReactNode
  className?: string
  onPress?: () => void
  accessibilityLabel?: string
}

export const CampusCard = ({ children, className, onPress, accessibilityLabel }: CampusCardProps) => {
  const classes = joinClasses(
    'rounded-none border border-line bg-white p-5 dark:border-line-dark dark:bg-surface-dark border-l-4 border-l-maroon dark:border-l-golden',
    className,
  )

  if (!onPress) return <View className={classes}>{children}</View>

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={classes}
      onPress={onPress}
    >
      {children}
    </Pressable>
  )
}

type CampusIconButtonProps = {
  icon: keyof typeof MaterialIcons.glyphMap
  label: string
  onPress: () => void
  inverse?: boolean
}

export const CampusIconButton = ({ icon, label, onPress, inverse = false }: CampusIconButtonProps) => {
  const { isDark } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      className={joinClasses(
        'h-10 w-10 items-center justify-center rounded-none border',
        inverse
          ? 'border-white/20 bg-white/10'
          : 'border-line bg-white dark:border-line-dark dark:bg-surface-dark',
      )}
    >
      <MaterialIcons name={icon} size={20} color={inverse ? '#FFFFFF' : isDark ? '#FFDF00' : '#7B1113'} />
    </Pressable>
  )
}

type CampusButtonProps = {
  label: string
  onPress: () => void
  icon?: keyof typeof MaterialIcons.glyphMap
  variant?: 'primary' | 'secondary' | 'gold'
  disabled?: boolean
  className?: string
}

export const CampusButton = ({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
  className,
}: CampusButtonProps) => {
  const { isDark } = useTheme()
  const variants = {
    primary: 'border-maroon bg-maroon dark:border-golden dark:bg-golden',
    secondary: 'border-line bg-white dark:border-line-dark dark:bg-surface-dark',
    gold: 'border-golden bg-golden',
  }
  const textVariants = {
    primary: 'text-white dark:text-maroon-dark',
    secondary: 'text-maroon dark:text-golden',
    gold: 'text-maroon-dark',
  }
  const iconColor = variant === 'secondary'
    ? isDark ? '#FFDF00' : '#7B1113'
    : variant === 'primary'
      ? isDark ? '#4A0A0B' : '#FFFFFF'
      : '#4A0A0B'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className={joinClasses(
        'min-h-12 flex-row items-center justify-center gap-2 rounded-none border px-5 uppercase tracking-widest',
        variants[variant],
        disabled && 'opacity-50',
        className,
      )}
    >
      {icon ? <MaterialIcons name={icon} size={18} color={iconColor} /> : null}
      <Text className={joinClasses('font-sans-bold text-xs uppercase tracking-widest', textVariants[variant])}>{label}</Text>
    </Pressable>
  )
}

type SectionHeadingProps = {
  title: string
  eyebrow?: string
  actionLabel?: string
  onAction?: () => void
}

export const SectionHeading = ({ title, eyebrow, actionLabel, onAction }: SectionHeadingProps) => {
  const { isDark } = useTheme()
  return <View className="mb-4 mt-2 flex-row items-end justify-between gap-4 border-b border-line pb-2 dark:border-line-dark">
    <View className="flex-1">
      {eyebrow ? (
        <Text className="mb-1 font-sans-bold text-[10px] uppercase tracking-[2px] text-maroon dark:text-golden">
          {eyebrow}
        </Text>
      ) : null}
      <Text className="font-sans-bold text-xl font-bold text-ink dark:text-white">{title}</Text>
    </View>
    {actionLabel && onAction ? (
      <Pressable accessibilityRole="button" onPress={onAction} className="min-h-10 flex-row items-center gap-1 px-2">
        <Text className="font-sans-bold text-xs uppercase tracking-wider text-maroon dark:text-golden">{actionLabel}</Text>
        <MaterialIcons name="arrow-forward" size={16} color={isDark ? '#FFDF00' : '#7B1113'} />
      </Pressable>
    ) : null}
  </View>
}

type MetricTileProps = {
  label: string
  value: string | number
  icon: keyof typeof MaterialIcons.glyphMap
  emphasis?: 'brand' | 'alert' | 'neutral'
}

export const MetricTile = ({ label, value, icon, emphasis = 'brand' }: MetricTileProps) => {
  const { isDark } = useTheme()
  const colors = emphasis === 'alert'
    ? { bg: 'bg-red-50 dark:bg-red-950/20', icon: '#DC2626', value: 'text-red-700 dark:text-red-300' }
    : emphasis === 'neutral'
      ? { bg: 'bg-zinc-100 dark:bg-white/5', icon: '#746C6E', value: 'text-ink dark:text-white' }
      : { bg: 'bg-maroon/5 dark:bg-golden/10', icon: '#7B1113', value: 'text-maroon dark:text-golden' }

  return (
    <View className="min-w-[46%] flex-1 rounded-none border border-line bg-white p-4 dark:border-line-dark dark:bg-surface-dark border-t-4 border-t-maroon dark:border-t-golden">
      <View className={joinClasses('mb-3 h-9 w-9 items-center justify-center rounded-none', colors.bg)}>
        <MaterialIcons name={icon} size={18} color={emphasis === 'brand' && isDark ? '#FFDF00' : colors.icon} />
      </View>
      <Text className={joinClasses('font-sans-bold text-3xl font-bold leading-8', colors.value)}>{value}</Text>
      <Text className="mt-1 font-sans-bold text-[10px] uppercase tracking-wider text-muted dark:text-zinc-400">{label}</Text>
    </View>
  )
}

const statusClasses: Record<AttendanceStatus, string> = {
  present: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  late: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  absent: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
  pending: 'border-line bg-zinc-50 text-muted dark:border-line-dark dark:bg-white/5 dark:text-zinc-300',
  disputed: 'border-golden bg-golden/20 text-maroon-dark dark:text-golden',
}

const statusTextClasses: Record<AttendanceStatus, string> = {
  present: 'text-emerald-800 dark:text-emerald-300',
  late: 'text-amber-800 dark:text-amber-300',
  absent: 'text-red-800 dark:text-red-300',
  pending: 'text-muted dark:text-zinc-300',
  disputed: 'text-maroon-dark dark:text-golden',
}

export const AttendanceStatusPill = ({ status }: { status: AttendanceStatus }) => (
  <View className={joinClasses('self-start rounded-none border px-2.5 py-1', statusClasses[status])}>
    <Text className={joinClasses('font-sans-bold text-[9px] uppercase tracking-widest', statusTextClasses[status])}>{status}</Text>
  </View>
)

type CampusEmptyStateProps = {
  icon: keyof typeof MaterialIcons.glyphMap
  title: string
  description: string
}

export const CampusEmptyState = ({ icon, title, description }: CampusEmptyStateProps) => {
  const { isDark } = useTheme()
  return (
    <View className="items-center rounded-none border border-dashed border-line bg-white/70 px-6 py-10 dark:border-line-dark dark:bg-surface-dark/70">
      <View className="mb-3 h-12 w-12 items-center justify-center rounded-none bg-maroon/5 dark:bg-golden/10">
        <MaterialIcons name={icon} size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
      </View>
      <Text className="font-sans-bold text-base font-bold text-ink dark:text-white uppercase tracking-wider">{title}</Text>
      <Text className="mt-2 max-w-64 text-center font-sans text-xs leading-5 text-muted dark:text-zinc-400">
        {description}
      </Text>
    </View>
  )
}
