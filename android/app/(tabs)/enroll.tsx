import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, router } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { api } from '../../services/mock-api'
import { useTheme } from '../../theme/ThemeContext'

export default function EnrollScreen() {
  const { isDark } = useTheme()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const user = api.getCurrentUser()
    if (!user || user.role !== 'student') {
      router.replace('/')
    }
  }, [])

  const handleEnroll = async () => {
    const trimmed = code.trim()
    if (!trimmed) {
      Alert.alert('Error', 'Please enter an enrollment code.')
      return
    }

    setLoading(true)

    try {
      await api.enrollByCode(trimmed)
    } catch (error) {
      Alert.alert('Unable to Enroll', error instanceof Error ? error.message : 'Please try again.')
      setLoading(false)
      return
    }

    Alert.alert('Success', 'You have been successfully enrolled!', [
      { text: 'OK', onPress: () => router.back() },
    ])
    setCode('')
    setLoading(false)
  }

  const bg = isDark ? '#0A0A0C' : '#F5F5F5'
  const surface = isDark ? '#121215' : '#FFFFFF'
  const border = isDark ? 'rgba(245, 168, 0, 0.2)' : '#DDD'
  const textPrimary = isDark ? '#FFFFFF' : '#333'
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#888'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          title: 'Enroll in Subject',
          headerShown: true,
          headerStyle: {
            backgroundColor: isDark ? '#0A0A0C' : '#FFFFFF',
          },
          headerTintColor: isDark ? '#FFDF00' : '#7B1113',
          headerTitleStyle: {
            fontFamily: 'DMSans_700Bold',
            fontSize: 16,
          },
          headerShadowVisible: false,
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <MaterialIcons name="school" size={48} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text className="text-2xl font-heading font-bold mt-4" style={{ color: textPrimary }}>Enroll in a Subject</Text>
            <Text className="text-sm mt-2 text-center" style={{ color: textSecondary }}>
              Enter the enrollment code provided by your instructor.
            </Text>
          </View>

          <View style={{ backgroundColor: surface, padding: 20, borderWidth: 1, borderColor: border }}>
            <TextInput
              style={{
                color: textPrimary,
                backgroundColor: isDark ? '#0A0A0C' : '#FAFAFA',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(245, 168, 0, 0.3)' : '#DDD',
                marginBottom: 16,
                paddingHorizontal: 12,
                fontSize: 18,
                textAlign: 'center',
                letterSpacing: 3,
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                height: 48,
              }}
              value={code}
              onChangeText={setCode}
              placeholder="Enter enrollment code"
              placeholderTextColor="#888"
              autoFocus
              autoCapitalize="characters"
            />

            <TouchableOpacity
              className="h-12 items-center justify-center"
              style={{ backgroundColor: isDark ? '#FFDF00' : '#7B1113', opacity: loading ? 0.6 : 1 }}
              onPress={handleEnroll}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text className="text-sm font-sans-bold uppercase tracking-wider" style={{ color: isDark ? '#4A0A0B' : '#FFF' }}>
                {loading ? 'Enrolling...' : 'Enroll'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
