import type { ReactNode } from 'react'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'

export type FilterOption = { id: string; label: string; hint?: string }
export type FilterChipOption<T extends string> = { value: T; label: string; count?: number }

/** Single filter chip — 56dp touch target per the mobile filter spec. */
export function FilterChip({
  label,
  selected,
  onPress,
  testID,
  count,
}: {
  label: string
  selected: boolean
  onPress: () => void
  testID?: string
  count?: number
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={`min-h-14 flex-row items-center justify-center gap-1.5 rounded-full border px-4 ${
        selected
          ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden'
          : 'border-line bg-white dark:border-line-dark dark:bg-surface-dark'
      }`}
    >
      <Text
        className={`font-sans-bold text-[10px] uppercase tracking-wider ${
          selected ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-400'
        }`}
      >
        {label}
      </Text>
      {typeof count === 'number' ? (
        <View
          className={`min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 ${
            selected ? 'bg-white/20 dark:bg-maroon-dark/15' : 'bg-zinc-100 dark:bg-white/10'
          }`}
        >
          <Text
            className={`font-sans-bold text-[9px] ${
              selected ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-300'
            }`}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

/** Horizontal, scrollable chip row used for status/date presets. */
export function FilterChipsRow<T extends string>({
  label,
  options,
  value,
  onChange,
  testID,
}: {
  label: string
  options: Array<FilterChipOption<T>>
  value: T
  onChange: (value: T) => void
  testID?: string
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2"
      accessibilityLabel={label}
      testID={testID}
    >
      {options.map((option) => (
        <FilterChip
          key={option.value}
          label={option.count === undefined ? option.label : `${option.label} (${option.count})`}
          selected={value === option.value}
          onPress={() => onChange(option.value)}
          testID={testID ? `${testID}-${option.value}` : undefined}
        />
      ))}
    </ScrollView>
  )
}

/**
 * Compact labelled select that opens a bottom-sheet option list. Long
 * subject/section lists stay readable, every row keeps a 56dp target.
 */
export function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onSelect,
  testID,
  disabled = false,
}: {
  label: string
  value: string
  placeholder: string
  options: FilterOption[]
  onSelect: (id: string) => void
  testID?: string
  disabled?: boolean
}) {
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const selectedLabel = options.find((option) => option.id === value)?.label ?? placeholder
  const accent = isDark ? pupColors.golden : pupColors.maroon

  const close = () => setOpen(false)
  const select = (id: string) => {
    setOpen(false)
    onSelect(id)
  }

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedLabel}`}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={`min-h-14 min-w-[46%] flex-1 flex-row items-center gap-3 rounded-2xl border px-4 ${
          value
            ? 'border-maroon/40 bg-maroon/5 dark:border-golden/40 dark:bg-golden/5'
            : 'border-line bg-white dark:border-line-dark dark:bg-surface-dark'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <MaterialIcons name="filter-list" size={18} color={value ? accent : isDark ? pupColors.mutedLight : pupColors.muted} />
        <View className="flex-1">
          <Text className="font-sans-bold text-[9px] uppercase tracking-[1.3px] text-muted dark:text-zinc-500">{label}</Text>
          <Text className="mt-0.5 font-sans-semibold text-xs text-ink dark:text-white" numberOfLines={1}>{selectedLabel}</Text>
        </View>
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={20} color={accent} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={close}>
          <Pressable
            accessibilityRole="none"
            onPress={() => undefined}
            className="max-h-[82%] rounded-t-[28px] border-t-2 border-golden/40 bg-white px-5 pt-2 dark:bg-surface-dark"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
            <View className="mb-3 h-1.5 w-12 self-center rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <View className="mb-3 flex-row items-center justify-between gap-4">
              <Text className="flex-1 font-heading text-2xl text-ink dark:text-white">{label}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filter options"
                onPress={close}
                className="h-11 w-11 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/10"
              >
                <MaterialIcons name="close" size={20} color={isDark ? '#FFFFFF' : pupColors.maroonDark} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: value === '' }}
                onPress={() => select('')}
                className="min-h-14 flex-row items-center gap-3 border-b border-line dark:border-line-dark"
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/5">
                  <MaterialIcons name="apps" size={17} color={accent} />
                </View>
                <Text className={`flex-1 font-sans-semibold text-sm ${value ? 'text-ink dark:text-white' : 'text-maroon dark:text-golden'}`}>{placeholder}</Text>
                {value === '' ? <MaterialIcons name="check" size={19} color={accent} /> : null}
              </Pressable>
              {options.map((option) => {
                const selected = option.id === value
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => select(option.id)}
                    className="min-h-14 flex-row items-center gap-3 border-b border-line px-0 dark:border-line-dark"
                  >
                    <View className="flex-1">
                      <Text className={`font-sans-semibold text-sm ${selected ? 'text-maroon dark:text-golden' : 'text-ink dark:text-white'}`} numberOfLines={1}>{option.label}</Text>
                      {option.hint ? <Text className="mt-0.5 font-sans text-[11px] text-muted dark:text-zinc-500" numberOfLines={1}>{option.hint}</Text> : null}
                    </View>
                    {selected ? <MaterialIcons name="check" size={19} color={accent} /> : null}
                  </Pressable>
                )
              })}
              {!options.length ? (
                <Text className="py-8 text-center font-sans text-sm text-muted dark:text-zinc-400">No options available.</Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

/** Shared card shell for a group of filters with a clear-all affordance. */
export function FilterPanel({
  children,
  filtered = false,
  onClear,
  title = 'Filters',
}: {
  children: ReactNode
  filtered?: boolean
  onClear?: () => void
  title?: string
}) {
  const { isDark } = useTheme()
  return (
    <View className="mb-4 gap-3 rounded-none border border-line bg-white p-4 dark:border-line-dark dark:bg-surface-dark border-t-4 border-t-maroon dark:border-t-golden">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="tune" size={18} color={isDark ? pupColors.golden : pupColors.maroon} />
          <Text className="font-sans-bold text-sm text-ink dark:text-white">{title}</Text>
        </View>
        {filtered && onClear ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear all filters" onPress={onClear} className="min-h-11 justify-center px-2">
            <Text className="font-sans-bold text-xs text-maroon dark:text-golden">Clear all</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  )
}
