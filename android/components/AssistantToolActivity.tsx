import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { AiToolInvocationSummary, AiToolOutcome } from '@polycheck/shared'
import { toolActivityLabel, toolInvocationLabel } from '../lib/assistant-ui'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'

const OUTCOME_STYLES: Record<AiToolOutcome, {
  chip: string
  text: string
  icon: keyof typeof MaterialIcons.glyphMap
  iconLight: string
  iconDark: string
}> = {
  succeeded: {
    chip: 'border-emerald-500/40 bg-emerald-500/10 dark:border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: 'check-circle',
    iconLight: '#047857',
    iconDark: '#34D399',
  },
  denied: {
    chip: 'border-amber-500/40 bg-amber-500/10 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-400',
    icon: 'block',
    iconLight: '#B45309',
    iconDark: '#FBBF24',
  },
  failed: {
    chip: 'border-red-500/40 bg-red-500/10 dark:border-red-500/30',
    text: 'text-red-700 dark:text-red-400',
    icon: 'error-outline',
    iconLight: '#B91C1C',
    iconDark: '#F87171',
  },
}

interface AssistantToolActivityProps {
  invocations: AiToolInvocationSummary[]
  testID?: string
}

/**
 * Collapsed tool disclosure for one assistant message. Collapsed by default;
 * expanding reveals outcome-colored chips with the server's detail text.
 */
export function AssistantToolActivity({ invocations, testID }: AssistantToolActivityProps) {
  const { isDark } = useTheme()
  const [open, setOpen] = useState(false)

  if (invocations.length === 0) return null
  const label = toolActivityLabel(invocations.length)

  return (
    <View className="mt-2">
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Shows the tools used to build this reply"
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        onPress={() => setOpen((value) => !value)}
        className="min-h-8 flex-row items-center gap-1 self-start py-1"
      >
        <Text className="font-sans-bold text-[10px] uppercase tracking-widest text-muted dark:text-zinc-400">
          {label}
        </Text>
        <MaterialIcons
          name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={14}
          color={isDark ? pupColors.mutedLight : pupColors.muted}
        />
      </Pressable>

      {open ? (
        <View className="mt-1 flex-row flex-wrap gap-1.5" accessibilityLabel="Tool activity">
          {invocations.map((invocation, index) => {
            const outcome = OUTCOME_STYLES[invocation.outcome]
            const detail = invocation.detail?.trim()
            return (
              <View
                key={`${invocation.tool}-${index}`}
                accessible
                accessibilityLabel={detail
                  ? `${invocation.tool.replace(/_/g, ' ')} ${invocation.outcome}. ${detail}`
                  : `${invocation.tool.replace(/_/g, ' ')} ${invocation.outcome}`}
                className={`max-w-full border px-1.5 py-1 ${outcome.chip}`}
              >
                <View className="flex-row items-center gap-1">
                  <MaterialIcons
                    name={outcome.icon}
                    size={11}
                    color={isDark ? outcome.iconDark : outcome.iconLight}
                  />
                  <Text className={`font-sans-bold text-[9px] uppercase tracking-wider ${outcome.text}`}>
                    {toolInvocationLabel(invocation)}
                  </Text>
                </View>
                {detail ? (
                  <Text className="mt-0.5 font-sans text-[10px] leading-4 text-muted dark:text-zinc-400">
                    {detail}
                  </Text>
                ) : null}
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}
