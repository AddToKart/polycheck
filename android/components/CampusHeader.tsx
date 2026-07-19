import type { ReactNode } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

type CampusHeaderProps = {
  eyebrow: string
  title: string
  subtitle?: string
  onBack?: () => void
  actions?: ReactNode
}

export const CampusHeader = ({ eyebrow, title, subtitle, onBack, actions }: CampusHeaderProps) => (
  <View className="px-4 pb-3 pt-2">
    <View className="relative overflow-hidden rounded-none border-b-4 border-b-golden bg-maroon px-5 pb-5 pt-4 dark:bg-[#2A0E11]">
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              onPress={onBack}
              className="h-10 w-10 items-center justify-center rounded-none border border-white/20 bg-white/10"
            >
              <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
            </Pressable>
          ) : (
            <Image source={require('../assets/pup-logo.png')} className="h-10 w-10" resizeMode="contain" />
          )}
          <View>
            <Text className="font-sans-bold text-[9px] uppercase tracking-[2.5px] text-golden">Polycheck</Text>
            <Text className="mt-0.5 font-sans-medium text-[10px] text-white/70">PUP Attendance</Text>
          </View>
        </View>
        {actions ? <View className="flex-row items-center gap-2">{actions}</View> : null}
      </View>

      <Text className="font-sans-bold text-[10px] uppercase tracking-[2.5px] text-golden">{eyebrow}</Text>
      <Text className="mt-1 font-sans-bold text-3xl font-bold leading-8 text-white" numberOfLines={2}>{title}</Text>
      {subtitle ? <Text className="mt-1.5 font-sans text-xs leading-5 text-white/75">{subtitle}</Text> : null}
    </View>
  </View>
)
