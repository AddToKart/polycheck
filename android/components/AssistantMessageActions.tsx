import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import {
  MESSAGE_COPIED_ANNOUNCEMENT,
  MESSAGE_COPY_FAILED_ANNOUNCEMENT,
} from '../lib/assistant-ui'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import { useCampusToast } from './CampusToast'

interface AssistantMessageActionsProps {
  content: string
  stopped?: boolean
  onRetry?: () => void
  testID?: string
}

/**
 * Compact action row under assistant bubbles. Copy is always available for
 * non-empty replies; Retry appears only when a streamed draft was stopped.
 */
export function AssistantMessageActions({
  content,
  stopped = false,
  onRetry,
  testID,
}: AssistantMessageActionsProps) {
  const { isDark } = useTheme()
  const { showToast } = useCampusToast()
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current)
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      const written = await Clipboard.setStringAsync(content)
      if (!written) throw new Error('Clipboard is unavailable')
      setCopied(true)
      showToast('success', 'Copied', 'Assistant message copied to clipboard.')
      AccessibilityInfo.announceForAccessibility(MESSAGE_COPIED_ANNOUNCEMENT)
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => {
        resetTimerRef.current = null
        setCopied(false)
      }, 2_000)
    } catch {
      showToast('error', 'Copy failed', 'The message could not be copied.')
      AccessibilityInfo.announceForAccessibility(MESSAGE_COPY_FAILED_ANNOUNCEMENT)
    }
  }, [content, showToast])

  const accent = isDark ? pupColors.golden : pupColors.maroon
  const actionClass = 'min-h-8 flex-row items-center gap-1 px-1.5 py-1'

  if (!content && !(stopped && onRetry)) return null

  return (
    <View className="mt-1 flex-row flex-wrap items-center gap-1">
      {content ? (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={copied ? 'Message copied' : 'Copy assistant message'}
          accessibilityHint="Copies the raw markdown to the clipboard"
          hitSlop={6}
          onPress={() => void handleCopy()}
          className={actionClass}
        >
          <MaterialIcons
            name={copied ? 'check' : 'content-copy'}
            size={13}
            color={copied ? (isDark ? '#34D399' : '#047857') : accent}
          />
          <Text className={`font-sans-bold text-[10px] uppercase tracking-wider ${copied ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted dark:text-zinc-400'}`}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      ) : null}

      {stopped && onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry the stopped reply"
          hitSlop={6}
          onPress={onRetry}
          className={actionClass}
        >
          <MaterialIcons name="refresh" size={13} color={accent} />
          <Text className="font-sans-bold text-[10px] uppercase tracking-wider text-maroon dark:text-golden">
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
