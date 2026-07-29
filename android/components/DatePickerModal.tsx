import { useEffect, useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

type DatePickerModalProps = {
  visible: boolean
  onClose: () => void
  onSelectDate: (date: string) => void
  value: string
  title: string
  isDark: boolean
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  if (year && month && day) return { year, month: month - 1, day }
  const today = new Date()
  return { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() }
}

export default function DatePickerModal({ visible, onClose, onSelectDate, value, title, isDark }: DatePickerModalProps) {
  const initial = parseDate(value)
  const [currentYear, setCurrentYear] = useState(initial.year)
  const [currentMonth, setCurrentMonth] = useState(initial.month)
  const [selectedDay, setSelectedDay] = useState<number | null>(value ? initial.day : null)

  useEffect(() => {
    if (!visible) return
    const next = parseDate(value)
    setCurrentYear(next.year)
    setCurrentMonth(next.month)
    setSelectedDay(value ? next.day : null)
  }, [value, visible])

  const changeMonth = (amount: number) => {
    const next = new Date(currentYear, currentMonth + amount, 1)
    setCurrentYear(next.getFullYear())
    setCurrentMonth(next.getMonth())
    setSelectedDay(null)
  }

  const days: Array<number | null> = Array.from({ length: new Date(currentYear, currentMonth, 1).getDay() }, () => null)
  days.push(...Array.from({ length: new Date(currentYear, currentMonth + 1, 0).getDate() }, (_, index) => index + 1))
  while (days.length % 7 !== 0) days.push(null)
  const rows = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, (index + 1) * 7))
  const today = new Date()
  const viewingCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth

  const selectToday = () => {
    const next = new Date()
    setCurrentYear(next.getFullYear())
    setCurrentMonth(next.getMonth())
    setSelectedDay(next.getDate())
  }

  const confirm = () => {
    if (selectedDay !== null) onSelectDate(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`)
    onClose()
  }

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close date picker" className="flex-1 items-center justify-center bg-black/60 p-5" onPress={onClose}>
      <Pressable accessibilityRole="none" onPress={() => undefined} className="w-full max-w-[360px] overflow-hidden rounded-[30px] border border-line bg-white shadow-xl dark:border-line-dark dark:bg-[#151013]">
        <View className="bg-maroon px-5 pb-5 pt-4 dark:bg-[#2A0E11]"><Text className="font-sans-bold text-[9px] uppercase tracking-[2px] text-golden">{title}</Text><Text accessibilityLiveRegion="polite" className="mt-2 font-heading text-2xl text-white">{selectedDay ? `${MONTHS[currentMonth]} ${selectedDay}, ${currentYear}` : 'Select a date'}</Text></View>
        <View className="flex-row items-center justify-between px-3 py-3"><Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => changeMonth(-1)} className="h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/5"><MaterialIcons name="chevron-left" size={24} color={isDark ? '#FFDF00' : '#7B1113'} /></Pressable><Text className="font-sans-bold text-sm text-ink dark:text-white">{MONTHS[currentMonth]} {currentYear}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => changeMonth(1)} className="h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/5"><MaterialIcons name="chevron-right" size={24} color={isDark ? '#FFDF00' : '#7B1113'} /></Pressable></View>
        <View className="px-4 pb-4">
          <View className="mb-1 flex-row">{WEEK_DAYS.map((day, index) => <View key={day} className="flex-1 items-center py-2"><Text className={`font-sans-bold text-[10px] ${index === 0 ? 'text-red-500' : 'text-muted dark:text-zinc-500'}`}>{day}</Text></View>)}</View>
          {rows.map((row, rowIndex) => <View key={rowIndex} className="flex-row">{row.map((day, dayIndex) => {
            if (!day) return <View key={`empty-${dayIndex}`} className="aspect-square flex-1" />
            const selected = selectedDay === day
            const isToday = viewingCurrentMonth && today.getDate() === day
            return <Pressable key={day} accessibilityRole="radio" accessibilityLabel={`${MONTHS[currentMonth]} ${day}, ${currentYear}`} accessibilityState={{ checked: selected }} onPress={() => setSelectedDay(day)} className={`aspect-square flex-1 items-center justify-center rounded-2xl border ${selected ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : isToday ? 'border-maroon dark:border-golden' : 'border-transparent'}`}><Text className={`font-sans-bold text-xs ${selected ? 'text-white dark:text-maroon-dark' : 'text-ink dark:text-white'}`}>{day}</Text></Pressable>
          })}</View>)}
        </View>
        <View className="flex-row items-center justify-between border-t border-line p-3 dark:border-line-dark"><Pressable accessibilityRole="button" onPress={selectToday} className="min-h-12 justify-center px-3"><Text className="font-sans-bold text-xs text-maroon dark:text-golden">Today</Text></Pressable><View className="flex-row gap-2"><Pressable accessibilityRole="button" onPress={onClose} className="min-h-12 justify-center px-3"><Text className="font-sans-bold text-xs text-muted dark:text-zinc-400">Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={selectedDay === null} onPress={confirm} className="min-h-12 justify-center rounded-2xl bg-maroon px-5 opacity-100 disabled:opacity-40 dark:bg-golden"><Text className="font-sans-bold text-xs text-white dark:text-maroon-dark">Select</Text></Pressable></View></View>
      </Pressable>
    </Pressable>
  </Modal>
}
