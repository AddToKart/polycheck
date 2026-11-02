import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { AiChatAttachment } from '@polycheck/shared'
import type { AttachmentDownloadState } from '../lib/assistant-ui'
import { attachmentAccessibilityLabel } from '../lib/assistant-ui'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'

const FORMAT_ICONS: Record<AiChatAttachment['format'], keyof typeof MaterialIcons.glyphMap> = {
  pdf: 'picture-as-pdf',
  docx: 'description',
  csv: 'grid-on',
}

interface AssistantAttachmentCardProps {
  attachment: AiChatAttachment
  state: AttachmentDownloadState
  onPress: () => void
  testID?: string
}

/**
 * File card for a generated master list / attendance export. Mirrors the web
 * card: format icon, label + filename, and a right-side download → spinner →
 * check state while the authenticated download runs.
 */
export function AssistantAttachmentCard({
  attachment,
  state,
  onPress,
  testID,
}: AssistantAttachmentCardProps) {
  const { isDark } = useTheme()
  const loading = state === 'loading'
  const done = state === 'done'
  const accent = isDark ? pupColors.golden : pupColors.maroon

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={attachmentAccessibilityLabel(attachment, state)}
      accessibilityState={{ disabled: loading, busy: loading }}
      disabled={loading}
      onPress={onPress}
      className={`min-h-11 flex-row items-center gap-2 border border-line bg-white px-2 py-2 dark:border-line-dark dark:bg-white/5 ${loading ? 'opacity-70' : ''}`}
    >
      <View className="h-8 w-8 shrink-0 items-center justify-center border border-maroon/20 bg-maroon/5 dark:border-golden/20 dark:bg-golden/10">
        <MaterialIcons name={FORMAT_ICONS[attachment.format]} size={16} color={accent} />
      </View>

      <View className="min-w-0 flex-1">
        <Text className="font-sans-semibold text-xs text-ink dark:text-zinc-100" numberOfLines={1}>
          {attachment.label || attachment.filename}
        </Text>
        <Text className="mt-0.5 font-sans-bold text-[9px] uppercase tracking-wider text-muted dark:text-zinc-500" numberOfLines={1}>
          {attachment.format} · {attachment.filename}
        </Text>
      </View>

      <View className="h-8 w-8 shrink-0 items-center justify-center">
        {loading ? (
          <ActivityIndicator size="small" color={accent} accessibilityLabel="Downloading file" />
        ) : done ? (
          <MaterialIcons
            name="check-circle"
            size={18}
            color={isDark ? '#34D399' : '#047857'}
            accessibilityLabel="Downloaded"
          />
        ) : (
          <MaterialIcons name="file-download" size={18} color={accent} />
        )}
      </View>
    </Pressable>
  )
}
