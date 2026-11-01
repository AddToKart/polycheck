import { useEffect, useState } from 'react'
import { Image, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { DEFAULT_MAINTENANCE_MESSAGE } from '@polycheck/shared'
import { formatMaintenanceRemaining } from '../../lib/maintenance'
import { useTheme } from '../../theme/ThemeContext'
import { pupColors } from '../../theme/colors'

export interface MaintenanceScreenProps {
  message?: string
  estimatedEnd?: string
  /** Students additionally see the offline queue preservation notice. */
  studentNotice?: boolean
  embedded?: boolean
}

/**
 * Branded maintenance surface for the root shell and login portals.
 * Uses only NativeWind classes + Animated for the wrench (reduced-motion safe).
 */
export function MaintenanceScreen({ message, estimatedEnd, studentNotice = false, embedded = false }: MaintenanceScreenProps) {
  const { isDark } = useTheme()
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [])

  const countdown = formatMaintenanceRemaining(estimatedEnd, nowMs)

  return (
    <View
      testID="maintenance-screen"
      accessibilityRole="alert"
      accessibilityLabel="Polycheck is under scheduled maintenance"
      className={
        embedded
          ? 'items-center justify-center px-4 py-6'
          : `flex-1 items-center justify-center px-5 py-10 ${isDark ? 'bg-campus-dark' : 'bg-maroon'}`
      }
    >
      <View className="w-full max-w-md border border-golden/30 bg-black/20 p-6 dark:bg-white/5">
        <View className="mb-5 flex-row items-center justify-center gap-4">
          <Image
            source={require('../../assets/pup-logo.png')}
            style={{ width: 44, height: 44 }}
            resizeMode="contain"
            accessibilityLabel="PUP Seal Logo"
          />
          <View className="h-12 w-12 items-center justify-center">
            <MaterialIcons name="build" size={34} color={pupColors.golden} />
          </View>
        </View>

        <Text className="text-center font-sans-bold text-[10px] uppercase tracking-[3px] text-golden">
          Scheduled maintenance
        </Text>
        <Text className="mt-2 text-center font-heading text-2xl text-white">
          Polycheck is under scheduled maintenance
        </Text>
        <Text className="mt-3 text-center font-sans text-sm leading-6 text-white/80">
          {message?.trim() || DEFAULT_MAINTENANCE_MESSAGE}
        </Text>

        {countdown.tone !== 'none' ? (
          <View
            accessibilityLiveRegion="polite"
            className={`mt-5 flex-row items-center justify-center gap-2 border px-3 py-2 ${
              countdown.tone === 'overdue' ? 'border-golden bg-golden/10' : 'border-white/30 bg-white/5'
            }`}
          >
            <MaterialIcons name="schedule" size={15} color={pupColors.golden} />
            <Text className="font-sans-bold text-[10px] uppercase tracking-wider text-white">
              {countdown.label}
            </Text>
          </View>
        ) : null}

        {studentNotice ? (
          <View className="mt-5 border-l-4 border-golden bg-white/10 px-3 py-3">
            <Text className="font-sans-bold text-[10px] uppercase tracking-widest text-golden">
              Your records are safe
            </Text>
            <Text className="mt-1 font-sans text-xs leading-5 text-white/85">
              In-class attendance continues normally. Offline records are securely stored on this device and
              will sync as soon as servers reopen.
            </Text>
          </View>
        ) : null}

        <View className="mt-5 border-t border-white/15 pt-4">
          <Text className="font-sans text-[11px] leading-5 text-white/70">
            IT desk: Campus MIS Office (IT Coordinator){'\n'}Support: Office of the Campus Director
          </Text>
        </View>
      </View>
    </View>
  )
}
