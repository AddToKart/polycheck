import { useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusButton, CampusCard } from '../../components/CampusPrimitives'

export default function EnrollScreen() {
  const { isDark } = useTheme()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const user = api.getCurrentUser()
    if (!user || user.role !== 'student') router.replace('/')
  }, [])

  const handleEnroll = async () => {
    const trimmed = code.trim()
    if (!trimmed) {
      Alert.alert('Enrollment code required', 'Enter the code shared by your instructor.')
      return
    }

    setLoading(true)
    try {
      await api.enrollByCode(trimmed)
      setCode('')
      Alert.alert('Class added', 'You are now enrolled. Subject data will be available for offline use after sync.', [
        { text: 'View dashboard', onPress: () => router.replace('/(tabs)/dashboard') },
      ])
    } catch (error) {
      Alert.alert('Unable to enroll', error instanceof Error ? error.message : 'Check the code and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow="Student enrollment"
        title="Add a class"
        subtitle="Enter the one-time code provided by your instructor."
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="flex-1 px-4 pb-8 pt-2">
            <CampusCard className="p-6">
              <View className="mb-6 h-14 w-14 items-center justify-center rounded-[20px] bg-maroon/5 dark:bg-golden/10">
                <MaterialIcons name="vpn-key" size={25} color={isDark ? '#FFDF00' : '#7B1113'} />
              </View>
              <Text className="font-heading text-2xl text-ink dark:text-white">Enrollment code</Text>
              <Text className="mt-2 font-sans text-sm leading-5 text-muted dark:text-zinc-400">
                Codes are 6–8 characters and may expire. Ask your instructor for a new code if it is not accepted.
              </Text>

              <TextInput
                accessibilityLabel="Enrollment code"
                className="my-7 h-16 rounded-2xl border border-line bg-zinc-50 px-4 text-center font-sans-bold text-xl uppercase tracking-[4px] text-ink dark:border-line-dark dark:bg-white/5 dark:text-white"
                value={code}
                onChangeText={setCode}
                placeholder="ABC123"
                placeholderTextColor={isDark ? '#777177' : '#A39B9D'}
                autoFocus
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                onSubmitEditing={handleEnroll}
              />

              <CampusButton label={loading ? 'Checking code…' : 'Add class'} icon="add" onPress={handleEnroll} disabled={loading} />
            </CampusCard>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
