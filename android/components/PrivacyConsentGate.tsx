import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Modal, Pressable, SafeAreaView, Text, View } from 'react-native'
import type { PrivacyNotice, User } from '@polycheck/shared'
import { api } from '../services/api-client'

export const PrivacyConsentGate = ({ user }: { user: User | null }) => {
  const [notice, setNotice] = useState<PrivacyNotice | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    setError('')
    if (!user || user.role !== 'student') {
      setNotice(null)
      return
    }
    try {
      setNotice(await api.getPrivacyNotice())
    } catch {
      if (!user.privacyConsentedAt) setError('Connect to the internet to review and accept the privacy notice.')
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const requiresConsent =
    user?.role === 'student' &&
    ((!notice && !user.privacyConsentedAt) || Boolean(notice && user.privacyConsentVersion !== notice.version))

  const accept = async () => {
    if (!notice || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await api.acceptPrivacyConsent(notice.version)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record privacy consent.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={Boolean(requiresConsent)} animationType="fade" presentationStyle="fullScreen">
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-1 justify-center px-5">
          <View className="border border-t-4 border-zinc-700 border-t-golden bg-surface-dark p-6">
            <Text className="font-sans-bold text-xs uppercase tracking-[2px] text-golden">Privacy consent</Text>
            <Text className="mt-3 font-serif text-3xl font-bold text-white">Attendance uses location evidence</Text>
            <Text className="mt-4 font-sans text-sm leading-6 text-zinc-300">
              {notice?.summary ?? 'The current privacy notice must be loaded before attendance check-in can be used.'}
            </Text>
            {notice ? (
              <Pressable accessibilityRole="link" className="mt-5 min-h-11 justify-center" onPress={() => void Linking.openURL(notice.url)}>
                <Text className="font-sans-bold text-sm text-golden underline">Read the complete privacy notice</Text>
              </Pressable>
            ) : null}
            {error ? <Text accessibilityRole="alert" className="mt-4 font-sans-semibold text-sm text-red-400">{error}</Text> : null}
            {notice ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Accept privacy notice" disabled={submitting} className="mt-6 min-h-12 flex-row items-center justify-center bg-maroon px-4 disabled:opacity-50" onPress={() => void accept()}>
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-sans-bold text-sm uppercase tracking-wider text-white">I understand and consent</Text>}
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" className="mt-3 min-h-12 items-center justify-center border border-zinc-600" onPress={() => void refresh()}>
              <Text className="font-sans-bold text-sm uppercase tracking-wider text-white">Retry</Text>
            </Pressable>
            <Text className="mt-4 font-sans text-xs leading-5 text-zinc-400">If you decline, sign out from the account menu. QR attendance submission remains disabled.</Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  )
}
