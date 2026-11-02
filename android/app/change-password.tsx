import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../services/api-client'
import { useCampusToast } from '../components/CampusToast'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import { CampusHeader } from '../components/CampusHeader'
import { CampusButton, CampusCard, CampusIconButton } from '../components/CampusPrimitives'
import { CampusFormField } from '../components/CampusFormField'

const MIN_PASSWORD_LENGTH = 12

/**
 * Blocking gate for accounts created or reset with a temporary password.
 * The root layout routes here whenever `user.mustChangePassword` is true and
 * refuses to open a dashboard until the flag clears.
 */
export default function ChangePasswordScreen() {
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const [user, setUser] = useState(() => api.getCurrentUser())
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const current = api.getCurrentUser()
    if (!current) {
      router.replace('/')
      return
    }
    if (!current.mustChangePassword) {
      router.replace(current.role === 'student' ? '/(tabs)/dashboard' : '/(faculty)/dashboard')
      return
    }
    setUser(current)
  }, [])

  if (!user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-campus dark:bg-campus-dark">
        <ActivityIndicator size="large" color={isDark ? pupColors.golden : pupColors.maroon} />
      </SafeAreaView>
    )
  }

  const submit = async () => {
    if (submitting) return
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      showToast('warning', 'Password too short', `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('warning', 'Passwords do not match', 'Re-enter the same new password in both fields.')
      return
    }
    setSubmitting(true)
    try {
      await api.changePassword(undefined, newPassword)
      showToast('success', 'Password updated', 'Your account is ready. Welcome to Polycheck.')
      router.replace(user.role === 'student' ? '/(tabs)/dashboard' : '/(faculty)/dashboard')
    } catch (error) {
      showToast('error', 'Unable to change password', error instanceof Error ? error.message : 'Try again in a moment.')
    } finally {
      setSubmitting(false)
    }
  }

  const signOut = async () => {
    await api.logout()
    router.replace('/')
  }

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark" testID="change-password-screen">
      <CampusHeader
        eyebrow="Account security"
        title="Choose a new password"
        subtitle="This account is using a temporary password. Set your own before continuing."
        actions={<CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />}
      />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2" keyboardShouldPersistTaps="handled">
          <CampusCard className="p-5">
            <View className="mb-5 h-12 w-12 items-center justify-center rounded-none bg-maroon dark:bg-golden">
              <MaterialIcons name="lock-reset" size={24} color={isDark ? pupColors.maroonDark : '#FFFFFF'} />
            </View>
            <Text className="font-heading text-2xl text-ink dark:text-white">{user.fullName}</Text>
            <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">
              {user.studentId ?? user.email ?? 'Polycheck account'}
            </Text>
            <Text className="mb-6 mt-4 font-sans text-sm leading-5 text-muted dark:text-zinc-400">
              Your temporary password must be replaced before you can open classes, sessions, or attendance records.
            </Text>

            <View className="gap-4">
              <CampusFormField
                label="New password"
                testID="change-password-new"
                icon="lock"
                hint={`At least ${MIN_PASSWORD_LENGTH} characters. Use uppercase, lowercase, a number, and a symbol.`}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <CampusFormField
                label="Confirm new password"
                testID="change-password-confirm"
                icon="lock-outline"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                onSubmitEditing={() => void submit()}
              />
            </View>

            <CampusButton
              testID="change-password-submit"
              label={submitting ? 'Saving…' : 'Set new password'}
              icon="check"
              disabled={submitting}
              onPress={() => void submit()}
              className="mt-6"
            />

            <CampusButton
              label="Sign out"
              icon="logout"
              variant="secondary"
              onPress={() => void signOut()}
              className="mt-3"
            />
          </CampusCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
