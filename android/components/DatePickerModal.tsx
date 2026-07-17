import React, { useState, useEffect } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View, Pressable } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { fonts } from '../theme/typography'

interface DatePickerModalProps {
  visible: boolean
  onClose: () => void
  onSelectDate: (dateStr: string) => void
  value: string // Format: YYYY-MM-DD
  title: string
  isDark: boolean
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function DatePickerModal({
  visible,
  onClose,
  onSelectDate,
  value,
  title,
  isDark
}: DatePickerModalProps) {
  // Parse initial value or default to today
  const getInitialState = () => {
    if (value) {
      const parts = value.split('-')
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10) - 1
        const d = parseInt(parts[2], 10)
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return { year: y, month: m, day: d }
        }
      }
    }
    const today = new Date()
    return {
      year: today.getFullYear(),
      month: today.getMonth(),
      day: today.getDate()
    }
  }

  const initialState = getInitialState()
  const [currentYear, setCurrentYear] = useState(initialState.year)
  const [currentMonth, setCurrentMonth] = useState(initialState.month)
  const [selectedDay, setSelectedDay] = useState<number | null>(value ? initialState.day : null)

  // Sync state with value prop when visibility changes
  useEffect(() => {
    if (visible) {
      const state = getInitialState()
      setCurrentYear(state.year)
      setCurrentMonth(state.month)
      setSelectedDay(value ? state.day : null)
    }
  }, [visible, value])

  const getDaysInMonth = (y: number, m: number) => {
    return new Date(y, m + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (y: number, m: number) => {
    return new Date(y, m, 1).getDay()
  }

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
    setSelectedDay(null)
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
    setSelectedDay(null)
  }

  const handleSelectDay = (day: number) => {
    setSelectedDay(day)
  }

  const handleConfirm = () => {
    if (selectedDay !== null) {
      const mm = String(currentMonth + 1).padStart(2, '0')
      const dd = String(selectedDay).padStart(2, '0')
      const formattedDate = `${currentYear}-${mm}-${dd}`
      onSelectDate(formattedDate)
    }
    onClose()
  }

  const handleSelectToday = () => {
    const today = new Date()
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
    setSelectedDay(today.getDate())
  }

  // Generate calendar grid
  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDayOffset = getFirstDayOfMonth(currentYear, currentMonth)
  const today = new Date()
  const isCurrentMonthToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth

  const daysGrid: (number | null)[] = []
  for (let i = 0; i < firstDayOffset; i++) {
    daysGrid.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    daysGrid.push(i)
  }

  // Group into rows of 7
  const rows: (number | null)[][] = []
  for (let i = 0; i < daysGrid.length; i += 7) {
    rows.push(daysGrid.slice(i, i + 7))
  }

  // Color tokens
  const primaryMaroon = '#7B1113'
  const primaryMaroonDark = '#4A0A0B'
  const accentGolden = '#FFDF00'

  const modalBg = isDark ? '#121215' : '#FFFFFF'
  const modalBorderColor = isDark ? 'rgba(255, 223, 0, 0.15)' : '#E4E4E7'
  const cellTextColor = isDark ? '#FFFFFF' : '#1F2937'
  const cellTextSecondaryColor = isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF'
  const headerBg = isDark ? primaryMaroonDark : primaryMaroon
  const headerTextColor = '#FFFFFF'

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.dialog, { backgroundColor: modalBg, borderColor: modalBorderColor }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: headerBg }]}>
            <Text style={styles.headerSubtitle}>{title}</Text>
            <Text style={styles.headerTitle}>
              {selectedDay !== null 
                ? `${MONTHS[currentMonth]} ${selectedDay}, ${currentYear}`
                : 'Select Date'
              }
            </Text>
          </View>

          {/* Month Selector */}
          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
              <MaterialIcons name="chevron-left" size={24} color={isDark ? accentGolden : primaryMaroon} />
            </TouchableOpacity>
            
            <Text style={[styles.monthYearLabel, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              {MONTHS[currentMonth]} {currentYear}
            </Text>

            <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
              <MaterialIcons name="chevron-right" size={24} color={isDark ? accentGolden : primaryMaroon} />
            </TouchableOpacity>
          </View>

          {/* Grid Container */}
          <View style={styles.calendarContainer}>
            {/* Day labels */}
            <View style={styles.weekLabelsRow}>
              {DAYS_OF_WEEK.map((lbl, idx) => (
                <Text 
                  key={lbl} 
                  style={[
                    styles.weekLabel, 
                    { color: cellTextSecondaryColor },
                    idx === 0 && { color: '#EF4444' } // Red for Sunday
                  ]}
                >
                  {lbl}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.grid}>
              {rows.map((row, rowIdx) => (
                <View key={`row-${rowIdx}`} style={styles.row}>
                  {row.map((day, colIdx) => {
                    if (day === null) {
                      return <View key={`empty-${colIdx}`} style={styles.cell} />
                    }

                    const isSelected = selectedDay === day
                    const isToday = isCurrentMonthToday && today.getDate() === day
                    
                    let bgStyle: any = {}
                    let textStyle: any = { color: cellTextColor }
                    let borderStyle: any = {}

                    if (isSelected) {
                      bgStyle = { backgroundColor: isDark ? accentGolden : primaryMaroon }
                      textStyle = { color: isDark ? primaryMaroonDark : '#FFFFFF', fontWeight: 'bold' }
                    } else if (isToday) {
                      borderStyle = { borderWidth: 1, borderColor: isDark ? accentGolden : primaryMaroon }
                    }

                    return (
                      <TouchableOpacity
                        key={`day-${day}`}
                        style={[styles.cell, bgStyle, borderStyle]}
                        onPress={() => handleSelectDay(day)}
                      >
                        <Text style={[styles.cellText, textStyle]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))}
            </View>
          </View>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: modalBorderColor }]}>
            <TouchableOpacity onPress={handleSelectToday} style={styles.footerBtnAction}>
              <Text style={[styles.footerBtnTextAction, { color: isDark ? accentGolden : primaryMaroon }]}>
                Today
              </Text>
            </TouchableOpacity>
            
            <View style={styles.footerRight}>
              <TouchableOpacity onPress={onClose} style={styles.footerBtn}>
                <Text style={[styles.footerBtnText, { color: cellTextSecondaryColor }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={handleConfirm} 
                disabled={selectedDay === null}
                style={[
                  styles.footerBtnConfirm, 
                  { backgroundColor: isDark ? accentGolden : primaryMaroon },
                  selectedDay === null && { opacity: 0.4 }
                ]}
              >
                <Text style={[styles.footerBtnTextConfirm, { color: isDark ? primaryMaroonDark : '#FFFFFF' }]}>
                  Select
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderRadius: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fonts.bodyBold,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: fonts.heading,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  navBtn: {
    padding: 8,
  },
  monthYearLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
  },
  calendarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  weekLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekLabel: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
  },
  grid: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cell: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 0,
  },
  cellText: {
    fontSize: 13,
    fontFamily: fonts.body,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
  },
  footerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  footerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  footerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: fonts.bodyBold,
  },
  footerBtnConfirm: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 0,
  },
  footerBtnTextConfirm: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: fonts.bodyBold,
  },
  footerBtnAction: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  footerBtnTextAction: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: fonts.bodyBold,
  },
})
