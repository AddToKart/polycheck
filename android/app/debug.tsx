import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function DebugScreen() {
  return (
    <SafeAreaView className="flex-1 bg-campus">
      <View className="flex-1 gap-2 p-5">
        <Text style={{ fontSize: 16, color: '#000' }}>STYLE-PROP-BASELINE</Text>
        <Text className="text-base text-ink">C1 text-base text-ink</Text>
        <Text className="font-sans-bold text-base text-ink">C2 font-sans-bold</Text>
        <Text className="font-heading text-base text-ink">C3 font-heading</Text>
        <Text className="text-xs text-maroon">C4 text-xs text-maroon</Text>
        <Text className="text-base text-maroon dark:text-golden">C5 dark variant</Text>
        <Text className="font-sans-bold text-[10px] uppercase tracking-[2.5px] text-maroon">C6 tracking arbitrary</Text>
        <Text className="font-heading text-[42px] leading-[48px] text-ink">C7 heading 42px</Text>
        <View className="flex-1 items-center justify-center">
          <Text className="font-sans-bold text-base text-maroon">C8 inside flex-1 justify-center</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
