import type { ReactNode } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { pupColors } from '../theme/colors'

type CampusHeaderProps = {
  eyebrow: string
  title: string
  subtitle?: string
  onBack?: () => void
  actions?: ReactNode
}

export const CampusHeader = ({ eyebrow, title, subtitle, onBack, actions }: CampusHeaderProps) => (
  <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 }}>
    <View
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderBottomWidth: 4,
        borderBottomColor: pupColors.golden,
        backgroundColor: pupColors.maroon,
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 16,
      }}
      className="relative overflow-hidden rounded-none border-b-4 border-b-golden bg-maroon px-5 pb-5 pt-4 dark:bg-maroon-deep"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              onPress={onBack}
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <MaterialIcons name="arrow-back" size={20} color={pupColors.white} />
            </Pressable>
          ) : (
            <Image
              source={require('../assets/pup-logo.png')}
              style={{ width: 40, height: 40 }}
              resizeMode="contain"
            />
          )}
          <View>
            <Text
              style={{
                fontFamily: 'DMSans_700Bold',
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: 2.5,
                color: pupColors.golden,
              }}
              className="font-sans-bold text-[9px] uppercase tracking-[2.5px] text-golden"
            >
              Polycheck
            </Text>
            <Text
              style={{
                fontFamily: 'DMSans_500Medium',
                fontSize: 10,
                color: 'rgba(255, 255, 255, 0.7)',
                marginTop: 2,
              }}
              className="mt-0.5 font-sans-medium text-[10px] text-white/70"
            >
              PUP Attendance
            </Text>
          </View>
        </View>
        {actions ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{actions}</View> : null}
      </View>

      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 2.5,
          color: pupColors.golden,
        }}
        className="font-sans-bold text-[10px] uppercase tracking-[2.5px] text-golden"
      >
        {eyebrow}
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: 28,
          lineHeight: 34,
          color: '#FFFFFF',
          marginTop: 4,
        }}
        className="mt-1 font-sans-bold text-3xl font-bold leading-8 text-white"
        numberOfLines={2}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 12,
            lineHeight: 20,
            color: 'rgba(255, 255, 255, 0.75)',
            marginTop: 6,
          }}
          className="mt-1.5 font-sans text-xs leading-5 text-white/75"
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  </View>
)
