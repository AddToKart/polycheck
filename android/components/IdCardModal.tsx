import { useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Image, Modal, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { CampusIconButton } from './CampusPrimitives'

type StudentCredential = {
  fullName: string
  studentId: string
  program: string
  yearLevel: number
}

const IdCardFront = ({ student, isDark }: { student: StudentCredential; isDark: boolean }) => (
  <View className="flex-1 overflow-hidden rounded-none border-2 border-zinc-300 bg-white dark:border-zinc-700 dark:bg-surface-dark shadow-md">
    <View className="flex-row items-center gap-3 bg-maroon p-3 border-b-2 border-golden">
      <View className="h-9 w-9 items-center justify-center rounded-none bg-white">
        <Image source={require('../assets/pup-logo.png')} className="h-7 w-7" resizeMode="contain" />
      </View>
      <View className="flex-1">
        <Text className="font-sans-bold text-[7px] uppercase tracking-[1.5px] text-golden">Republic of the Philippines</Text>
        <Text className="mt-0.5 font-heading font-bold text-[9px] uppercase tracking-wider text-white">Polytechnic University of the Philippines</Text>
      </View>
      <MaterialIcons name="verified" size={18} color="#FFDF00" />
    </View>

    <View className="flex-1 flex-row bg-[#FDFBF7] p-4 dark:bg-surface-dark">
      <View className="mr-4 w-[32%]">
        <View className="aspect-[3/4] w-full items-center justify-center rounded-none border-2 border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800">
          <MaterialIcons name="person" size={44} color={isDark ? '#6B6466' : '#B5AEB0'} />
        </View>
        <View className="mt-2 border-b-2 border-zinc-800 pb-0.5 dark:border-zinc-400">
          <Text className="text-center font-sans-medium text-[6px] uppercase tracking-[1px] text-muted dark:text-zinc-500">Signature</Text>
        </View>
      </View>

      <View className="flex-1 justify-center">
        <Text className="font-sans-bold text-[8px] uppercase tracking-[1.5px] text-zinc-500">Student Number</Text>
        <Text className="mt-0.5 font-mono text-lg font-bold text-maroon dark:text-golden">{student.studentId}</Text>

        <Text className="mt-2.5 font-sans-bold text-[8px] uppercase tracking-[1.5px] text-zinc-500">Full Name</Text>
        <Text className="mt-0.5 font-heading text-base font-bold uppercase leading-5 text-ink dark:text-white" numberOfLines={2}>{student.fullName}</Text>

        <View className="mt-3 flex-row gap-4">
          <View className="flex-1">
            <Text className="font-sans-bold text-[8px] uppercase tracking-[1.5px] text-zinc-500">Program</Text>
            <Text className="mt-0.5 font-sans-bold text-[10px] text-ink dark:text-white">{student.program}</Text>
          </View>
          <View>
            <Text className="font-sans-bold text-[8px] uppercase tracking-[1.5px] text-zinc-500">Validity</Text>
            <Text className="mt-0.5 font-sans-bold text-[10px] text-ink dark:text-white">2026–2027</Text>
          </View>
        </View>
      </View>
    </View>
  </View>
)

const IdCardBack = ({ isDark }: { isDark: boolean }) => (
  <View className="flex-1 overflow-hidden rounded-none border-2 border-zinc-300 bg-white dark:border-zinc-700 dark:bg-surface-dark shadow-md">
    <View className="mt-4 h-11 w-full bg-zinc-900" />
    <View className="flex-1 flex-row gap-4 p-4">
      <View className="flex-1 justify-between">
        <View>
          <Text className="font-sans-bold text-[9px] uppercase tracking-[1.5px] text-maroon dark:text-golden">Conditions of Use</Text>
          <Text className="mt-1.5 font-sans text-[8px] leading-3 text-zinc-600 dark:text-zinc-400">
            This card is non-transferable and must be presented upon entry to the university premises. The finder of this lost card is requested to surrender it to the Office of Student Affairs.
          </Text>
        </View>
        <View className="mt-auto">
          <Text className="font-sans-bold text-[7px] uppercase tracking-[1px] text-zinc-500">Emergency Contact</Text>
          <View className="mt-1 h-4 border-b border-zinc-400 dark:border-zinc-600" />
          <View className="mt-1 h-4 border-b border-zinc-400 dark:border-zinc-600" />
        </View>
      </View>
      <View className="w-[34%] items-center justify-center border-l-2 border-dashed border-zinc-300 pl-3 dark:border-zinc-700">
        <View className="aspect-square w-full items-center justify-center rounded-none border-2 border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-white p-1">
          <MaterialIcons name="qr-code-2" size={54} color="#171316" />
        </View>
        <Text className="mt-2 text-center font-mono text-[7px] font-bold uppercase tracking-widest text-zinc-500">SCAN TO VERIFY</Text>
      </View>
    </View>
  </View>
)

type IdCardModalProps = {
  visible: boolean
  student: StudentCredential
  onClose: () => void
}

export const IdCardModal = ({ visible, student, onClose }: IdCardModalProps) => {
  const { isDark } = useTheme()
  const [isFlipped, setIsFlipped] = useState(false)
  const flipAnimation = useRef(new Animated.Value(0)).current

  const flipCard = () => {
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      Animated.timing(flipAnimation, {
        toValue: isFlipped ? 0 : 180,
        duration: reduceMotion ? 0 : 420,
        useNativeDriver: true,
      }).start()
      setIsFlipped((flipped) => !flipped)
    })
  }

  const frontRotation = flipAnimation.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] })
  const backRotation = flipAnimation.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] })

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.82)',
          padding: 16,
        }}
      >
        <View
          style={{
            width: '100%',
            borderRadius: 0,
            borderWidth: 1.5,
            borderTopWidth: 5,
            borderTopColor: '#FFDF00',
            borderColor: isDark ? '#30272A' : '#7B1113',
            backgroundColor: isDark ? '#171316' : '#FFFFFF',
            padding: 20,
            elevation: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.5,
            shadowRadius: 20,
          }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text className="font-sans-bold text-[10px] uppercase tracking-[2px] text-maroon dark:text-golden">Verified Credential</Text>
              <Text className="font-sans-bold text-xl font-bold text-ink dark:text-white">Digital Student ID</Text>
            </View>
            <CampusIconButton icon="close" label="Close modal" onPress={onClose} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFlipped ? 'Student ID back side' : 'Student ID front side'}
            accessibilityHint="Double tap to flip the card"
            onPress={flipCard}
            className="w-full"
            style={{ aspectRatio: 1.586 }}
          >
            <Animated.View
              className="absolute inset-0 shadow-lg"
              style={{ transform: [{ perspective: 1000 }, { rotateY: frontRotation }], backfaceVisibility: 'hidden' }}
            >
              <IdCardFront student={student} isDark={isDark} />
            </Animated.View>
            <Animated.View
              className="absolute inset-0 shadow-lg"
              style={{ transform: [{ perspective: 1000 }, { rotateY: backRotation }], backfaceVisibility: 'hidden' }}
            >
              <IdCardBack isDark={isDark} />
            </Animated.View>
          </Pressable>

          <View className="mt-4 flex-row items-center justify-center gap-2">
            <MaterialIcons name="3d-rotation" size={16} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text className="font-sans-bold text-xs uppercase tracking-widest text-muted dark:text-zinc-400">
              Tap card to view {isFlipped ? 'front' : 'back'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}
