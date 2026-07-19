import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../services/api-client'
import { useTheme } from '../theme/ThemeContext'
import { CampusIconButton } from './CampusPrimitives'
import { CampusHeader } from './CampusHeader'

type CampusLoginPortalProps = {
  portal: 'student' | 'faculty'
}

export const CampusLoginPortal = ({ portal }: CampusLoginPortalProps) => {
  const { isDark, toggle } = useTheme()
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  const isStudent = portal === 'student'
  const identityLabel = isStudent ? 'Student Number' : 'PUP Email Address'
  const identityPlaceholder = isStudent ? '2024-00123-MN-0' : 'faculty@pup.edu.ph'

  const handleLogin = async () => {
    if (!identity.trim() || !password) {
      Alert.alert('Missing details', `Enter your ${identityLabel.toLowerCase()} and password.`)
      return
    }

    setLoading(true)
    try {
      const user = isStudent
        ? await api.loginStudent(identity.trim(), password)
        : await api.loginFaculty(identity.trim(), password)
      if (!user) throw new Error('The credentials you entered were not recognized.')

      router.replace(isStudent ? '/(tabs)/dashboard' : '/(faculty)/dashboard')
    } catch (error) {
      setLoading(false)
      Alert.alert(
        'Unable to sign in',
        error instanceof Error ? error.message : 'Check your details and try again.',
      )
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#171316' : '#7B1113' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <CampusHeader
            eyebrow={isStudent ? 'Student portal' : 'Faculty portal'}
            title={isStudent ? 'Welcome back, Iskolar.' : 'Welcome back, faculty.'}
            subtitle={
              isStudent
                ? 'Scan attendance, view classes, and carry your digital ID.'
                : 'Open sessions, manage classes, and review attendance.'
            }
            onBack={() => router.back()}
            actions={
              <CampusIconButton
                icon={isDark ? 'light-mode' : 'dark-mode'}
                label="Toggle color theme"
                onPress={toggle}
                inverse
              />
            }
          />

          <View
            style={{
              marginHorizontal: 16,
              marginTop: 8,
              borderRadius: 0,
              borderWidth: 1,
              borderTopWidth: 4,
              borderTopColor: '#FFDF00',
              borderColor: isDark ? 'rgba(255,255,255,0.18)' : '#E8E2E3',
              backgroundColor: isDark ? '#1F191D' : '#FFFFFF',
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <Text
              style={{
                fontFamily: 'Lora_400Regular',
                fontSize: 24,
                color: isDark ? '#FFFFFF' : '#211A1B',
              }}
            >
              Sign in securely
            </Text>
            <Text
              style={{
                fontFamily: 'DMSans_400Regular',
                fontSize: 13,
                color: isDark ? 'rgba(255,255,255,0.65)' : '#746C6E',
                marginTop: 4,
                marginBottom: 24,
              }}
            >
              Use your official university account credentials.
            </Text>

            <Text
              style={{
                fontFamily: 'DMSans_700Bold',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: isDark ? 'rgba(255,255,255,0.90)' : '#211A1B',
                marginBottom: 8,
              }}
            >
              {identityLabel}
            </Text>
            <View
              style={{
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 0,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.20)' : '#E8E2E3',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F9F8F8',
                paddingHorizontal: 14,
                marginBottom: 20,
              }}
            >
              <MaterialIcons name={isStudent ? 'badge' : 'mail'} size={18} color={isDark ? '#FFDF00' : '#7B1113'} />
              <TextInput
                accessibilityLabel={identityLabel}
                style={{
                  flex: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 12,
                  fontFamily: 'DMSans_400Regular',
                  fontSize: 15,
                  color: isDark ? '#FFFFFF' : '#211A1B',
                }}
                placeholder={identityPlaceholder}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.40)' : '#A39B9D'}
                value={identity}
                onChangeText={setIdentity}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={isStudent ? 'default' : 'email-address'}
                textContentType={isStudent ? 'username' : 'emailAddress'}
              />
            </View>

            <Text
              style={{
                fontFamily: 'DMSans_700Bold',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: isDark ? 'rgba(255,255,255,0.90)' : '#211A1B',
                marginBottom: 8,
              }}
            >
              Password
            </Text>
            <View
              style={{
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 0,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.20)' : '#E8E2E3',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F9F8F8',
                paddingHorizontal: 14,
                marginBottom: 12,
              }}
            >
              <MaterialIcons name="lock" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />
              <TextInput
                accessibilityLabel="Password"
                style={{
                  flex: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 12,
                  fontFamily: 'DMSans_400Regular',
                  fontSize: 15,
                  color: isDark ? '#FFFFFF' : '#211A1B',
                }}
                placeholder="Enter your password"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.40)' : '#A39B9D'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                textContentType="password"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                hitSlop={8}
                onPress={() => setPasswordVisible((v) => !v)}
                style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
              >
                <MaterialIcons
                  name={passwordVisible ? 'visibility-off' : 'visibility'}
                  size={18}
                  color={isDark ? '#A1A1AA' : '#746C6E'}
                />
              </Pressable>
            </View>

            <Text
              style={{
                fontFamily: 'DMSans_400Regular',
                fontSize: 12,
                lineHeight: 18,
                color: isDark ? 'rgba(255,255,255,0.55)' : '#746C6E',
                marginBottom: 24,
              }}
            >
              Your session is protected and can only be active on one device at a time.
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              disabled={loading}
              onPress={handleLogin}
              style={({ pressed }) => ({
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: 0,
                backgroundColor: '#7B1113',
                opacity: loading ? 0.6 : pressed ? 0.88 : 1,
              })}
            >
              <MaterialIcons name="login" size={18} color="#FFFFFF" />
              <Text
                style={{
                  fontFamily: 'DMSans_700Bold',
                  fontSize: 14,
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  color: '#FFFFFF',
                }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
