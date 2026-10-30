import { Pressable, Text, View } from 'react-native'

type CampusSwitchRowProps = {
  label: string
  description?: string
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
  testID?: string
}

/**
 * Square settings switch row (institution settings, plan Locked Decision 10).
 * The whole row is the switch target; maroon/golden = on, zinc = off.
 */
export const CampusSwitchRow = ({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  testID,
}: CampusSwitchRowProps) => (
  <Pressable
    accessibilityRole="switch"
    accessibilityLabel={label}
    accessibilityHint={description}
    accessibilityState={{ checked: value, disabled }}
    testID={testID}
    disabled={disabled}
    onPress={() => onValueChange(!value)}
    className={`min-h-14 flex-row items-center gap-4 rounded-none border border-line bg-white px-4 py-3 dark:border-line-dark dark:bg-surface-dark ${disabled ? 'opacity-50' : ''}`}
  >
    <View className="flex-1">
      <Text className="font-sans-bold text-sm text-ink dark:text-white">{label}</Text>
      {description ? (
        <Text className="mt-1 font-sans text-[11px] leading-5 text-muted dark:text-zinc-400">{description}</Text>
      ) : null}
    </View>
    <View
      className={`h-7 w-12 justify-center rounded-none p-1 ${value ? 'bg-maroon dark:bg-golden' : 'bg-zinc-300 dark:bg-zinc-700'}`}
    >
      <View
        className={`h-5 w-5 rounded-none ${value ? 'self-end bg-white dark:bg-maroon-dark' : 'self-start bg-white dark:bg-zinc-200'}`}
      />
    </View>
  </Pressable>
)
