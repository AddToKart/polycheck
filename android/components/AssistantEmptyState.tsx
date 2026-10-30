import { Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'

interface AssistantEmptyStateProps {
  title: string
  description: string
  prompts: string[]
  can: string[]
  cant: string[]
  onSelectPrompt: (prompt: string) => void
}

/**
 * Role-aware assistant landing: hero, 2×2 starter prompts, and a compact
 * can/can't list that mirrors the role's read-only tool scope.
 */
export function AssistantEmptyState({
  title,
  description,
  prompts,
  can,
  cant,
  onSelectPrompt,
}: AssistantEmptyStateProps) {
  const { isDark } = useTheme()
  const accent = isDark ? pupColors.golden : pupColors.maroon

  return (
    <View testID="assistant-empty" className="flex-1 items-center justify-center px-1 py-6">
      <View className="h-12 w-12 items-center justify-center border border-golden/60 bg-golden/15">
        <MaterialIcons name="auto-awesome" size={22} color={accent} />
      </View>
      <Text className="mt-3 text-center font-heading text-lg leading-tight text-maroon dark:text-golden">
        {title}
      </Text>
      <Text className="mt-2 max-w-xs text-center font-sans text-xs leading-5 text-muted dark:text-zinc-400">
        {description}
      </Text>

      <Text className="mt-5 self-start font-sans-bold text-[10px] uppercase tracking-widest text-muted dark:text-zinc-400">
        Try asking
      </Text>
      <View className="mt-2 w-full flex-row flex-wrap gap-2">
        {prompts.slice(0, 4).map((prompt, index) => (
          <Pressable
            key={prompt}
            testID={`assistant-prompt-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`Use suggestion: ${prompt}`}
            onPress={() => onSelectPrompt(prompt)}
            className="min-h-[62px] w-[48%] justify-between border border-line bg-white p-2.5 dark:border-line-dark dark:bg-surface-dark"
          >
            <Text className="font-sans-semibold text-xs leading-snug text-ink dark:text-zinc-200">
              {prompt}
            </Text>
            <MaterialIcons
              name="north-east"
              size={14}
              color={isDark ? pupColors.mutedLight : pupColors.muted}
              style={{ alignSelf: 'flex-end', marginTop: 6 }}
            />
          </Pressable>
        ))}
      </View>

      <View className="mt-4 w-full flex-row gap-2">
        <View
          accessibilityLabel="What the assistant can do"
          className="flex-1 border border-line p-2.5 dark:border-line-dark"
        >
          <Text className="font-sans-bold text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Can
          </Text>
          <View className="mt-1.5 gap-1">
            {can.map((item) => (
              <View key={item} className="flex-row gap-1.5">
                <MaterialIcons
                  name="check"
                  size={11}
                  color={isDark ? '#34D399' : '#047857'}
                  style={{ marginTop: 2 }}
                />
                <Text className="flex-1 font-sans text-[10px] leading-4 text-muted dark:text-zinc-300">
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View
          accessibilityLabel="What the assistant cannot do"
          className="flex-1 border border-line p-2.5 dark:border-line-dark"
        >
          <Text className="font-sans-bold text-[10px] uppercase tracking-widest text-muted dark:text-zinc-400">
            {"Can't"}
          </Text>
          <View className="mt-1.5 gap-1">
            {cant.map((item) => (
              <View key={item} className="flex-row gap-1.5">
                <MaterialIcons
                  name="close"
                  size={11}
                  color={isDark ? pupColors.mutedLight : pupColors.muted}
                  style={{ marginTop: 2 }}
                />
                <Text className="flex-1 font-sans text-[10px] leading-4 text-muted dark:text-zinc-400">
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <Text className="mt-4 text-center font-sans-bold text-[10px] uppercase tracking-widest text-muted dark:text-zinc-400">
        Read-only · scoped to your account
      </Text>
    </View>
  )
}
