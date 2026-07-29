import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { CampusButton } from './CampusPrimitives'

export const formatCampusTime = (value: string) => {
  const [hourValue, minuteValue] = value.split(':').map(Number)
  const period = hourValue >= 12 ? 'PM' : 'AM'
  const hour = hourValue === 0 ? 12 : hourValue > 12 ? hourValue - 12 : hourValue
  return `${hour}:${String(minuteValue).padStart(2, '0')} ${period}`
}

export const CampusPickerField = ({ label, value, placeholder, onPress, icon = 'keyboard-arrow-down' }: { label: string; value?: string; placeholder: string; onPress: () => void; icon?: keyof typeof MaterialIcons.glyphMap }) => {
  const { isDark } = useTheme()
  return <View>
    <Text className="mb-2 font-sans-bold text-xs text-ink dark:text-zinc-200">{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || placeholder}`} onPress={onPress} className="min-h-14 flex-row items-center rounded-2xl border border-line bg-zinc-50 px-4 dark:border-line-dark dark:bg-white/5">
      <Text className={`flex-1 font-sans text-sm ${value ? 'text-ink dark:text-white' : 'text-muted dark:text-zinc-500'}`}>{value || placeholder}</Text>
      <MaterialIcons name={icon} size={21} color={isDark ? '#FFDF00' : '#7B1113'} />
    </Pressable>
  </View>
}

export const ChoiceSheet = ({ visible, title, options, value, onSelect, onClose }: { visible: boolean; title: string; options: Array<{ value: string; label: string }>; value: string; onSelect: (value: string) => void; onClose: () => void }) => {
  const { isDark } = useTheme()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/80" onPress={onClose}>
        <Pressable onPress={() => undefined} className="max-h-[75%] rounded-t-[36px] border-t-2 border-x border-maroon/20 bg-white px-5 pb-10 pt-4 shadow-2xl dark:border-golden/25 dark:bg-[#161214]">
          <View className="mb-4 h-1.5 w-14 self-center rounded-full bg-maroon/30 dark:bg-golden/40" />
          <View className="mb-4 flex-row items-center justify-between border-b border-line pb-3 dark:border-line-dark">
            <Text className="font-heading text-2xl text-ink dark:text-white">{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={onClose} className="h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/10">
              <MaterialIcons name="close" size={21} color={isDark ? '#FFFFFF' : '#181113'} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {options.map((option) => {
              const active = value === option.value
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => { onSelect(option.value); onClose() }}
                  className={`mb-2.5 min-h-14 flex-row items-center rounded-2xl border px-4 ${active ? 'border-maroon bg-maroon/10 dark:border-golden dark:bg-golden/15' : 'border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-surface-dark'}`}
                >
                  <Text className={`flex-1 font-sans-bold text-sm ${active ? 'text-maroon dark:text-golden' : 'text-ink dark:text-white'}`}>{option.label}</Text>
                  {active ? <MaterialIcons name="check-circle" size={22} color={isDark ? '#FFDF00' : '#7B1113'} /> : null}
                </Pressable>
              )
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export const TimePickerSheet = ({ visible, title = 'Select time', value, onChange, onClose }: { visible: boolean; title?: string; value: string; onChange: (value: string) => void; onClose: () => void }) => {
  const [selectedHour, setSelectedHour] = useState(Number(value.split(':')[0]))
  const [selectedMinute, setSelectedMinute] = useState(Number(value.split(':')[1]))
  useEffect(() => { if (visible) { setSelectedHour(Number(value.split(':')[0])); setSelectedMinute(Number(value.split(':')[1])) } }, [value, visible])
  const hours = Array.from({ length: 24 }, (_, index) => index)
  const minutes = [0, 15, 30, 45]
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/80" onPress={onClose}>
        <Pressable onPress={() => undefined} className="rounded-t-[36px] border-t-2 border-x border-maroon/20 bg-white px-5 pb-10 pt-4 shadow-2xl dark:border-golden/25 dark:bg-[#161214]">
          <View className="mb-4 h-1.5 w-14 self-center rounded-full bg-maroon/30 dark:bg-golden/40" />
          <Text className="mb-5 font-heading text-2xl text-ink dark:text-white">{title}</Text>
          <View className="mb-5 h-64 flex-row gap-3">
            <ScrollView className="flex-1 rounded-2xl border border-line bg-zinc-50 p-2 dark:border-line-dark dark:bg-white/5" showsVerticalScrollIndicator={false}>
              {hours.map((hour) => (
                <Pressable key={hour} accessibilityRole="radio" accessibilityState={{ checked: selectedHour === hour }} onPress={() => setSelectedHour(hour)} className={`min-h-11 items-center justify-center rounded-xl ${selectedHour === hour ? 'bg-maroon dark:bg-golden' : ''}`}>
                  <Text className={`font-sans-bold text-sm ${selectedHour === hour ? 'text-white dark:text-maroon-dark' : 'text-ink dark:text-white'}`}>{formatCampusTime(`${String(hour).padStart(2, '0')}:00`)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView className="flex-1 rounded-2xl border border-line bg-zinc-50 p-2 dark:border-line-dark dark:bg-white/5" showsVerticalScrollIndicator={false}>
              {minutes.map((minute) => (
                <Pressable key={minute} accessibilityRole="radio" accessibilityState={{ checked: selectedMinute === minute }} onPress={() => setSelectedMinute(minute)} className={`min-h-11 items-center justify-center rounded-xl ${selectedMinute === minute ? 'bg-maroon dark:bg-golden' : ''}`}>
                  <Text className={`font-sans-bold text-sm ${selectedMinute === minute ? 'text-white dark:text-maroon-dark' : 'text-ink dark:text-white'}`}>:{String(minute).padStart(2, '0')}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <CampusButton label="Use this time" icon="schedule" onPress={() => { onChange(`${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`); onClose() }} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}
