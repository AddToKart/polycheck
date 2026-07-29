import type { ComponentProps } from 'react'
import { Text, TextInput, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'

type CampusFormFieldProps = Omit<ComponentProps<typeof TextInput>, 'className' | 'style'> & {
  label: string
  hint?: string
  icon?: keyof typeof MaterialIcons.glyphMap
  className?: string
}

export const CampusFormField = ({ label, hint, icon, className, multiline, ...inputProps }: CampusFormFieldProps) => {
  const { isDark } = useTheme()
  return (
    <View className={className}>
      <Text className="mb-2 font-sans-bold text-xs text-ink dark:text-zinc-200">{label}</Text>
      <View className={`flex-row rounded-2xl border border-line bg-zinc-50 px-4 dark:border-line-dark dark:bg-white/5 ${multiline ? 'items-start' : 'items-center'}`}>
        {icon ? <MaterialIcons name={icon} size={19} color={isDark ? '#A1A1AA' : '#746C6E'} style={{ marginTop: multiline ? 16 : 0 }} /> : null}
        <TextInput
          accessibilityLabel={label}
          className={`min-h-14 flex-1 py-4 font-sans text-sm text-ink dark:text-white ${icon ? 'px-3' : 'px-0'} ${multiline ? 'min-h-24' : ''}`}
          style={multiline ? { textAlignVertical: 'top' } : undefined}
          placeholderTextColor={isDark ? '#777177' : '#A39B9D'}
          multiline={multiline}
          {...inputProps}
        />
      </View>
      {hint ? <Text className="mt-1.5 font-sans text-[11px] leading-4 text-muted dark:text-zinc-500">{hint}</Text> : null}
    </View>
  )
}
