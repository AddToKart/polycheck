import { useEffect, useState } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import type { ExcuseReason } from '@polycheck/shared'
import { EXCUSE_REASON_OPTIONS, validateExcuseForm } from '../lib/excuses'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import { CampusButton } from './CampusPrimitives'

const MAX_BASE64_LENGTH = 6_900_000

type ExcusePhoto = { uri: string; base64: string; mimeType: string }

export function ExcuseRequestModal({
  visible,
  submitting,
  onClose,
  onSubmit,
}: {
  visible: boolean
  submitting: boolean
  onClose: () => void
  onSubmit: (reason: ExcuseReason, description: string, evidenceData?: string) => void
}) {
  const { isDark } = useTheme()
  const [reason, setReason] = useState<ExcuseReason | null>(null)
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<ExcusePhoto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    setReason(null)
    setDescription('')
    setPhoto(null)
    setError(null)
  }, [visible])

  const pickPhoto = async () => {
    setError(null)
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setError('Photo access was denied. You can submit the excuse without evidence.')
      return
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        base64: true,
      })
      const asset = result.canceled ? null : result.assets?.[0]
      if (!asset?.base64) return
      if (asset.base64.length > MAX_BASE64_LENGTH) {
        setError('That photo is too large. Choose a smaller image.')
        return
      }
      setPhoto({
        uri: asset.uri,
        base64: asset.base64,
        mimeType: asset.mimeType ?? 'image/jpeg',
      })
    } catch {
      setError('Unable to open the photo library. Try again.')
    }
  }

  const submit = () => {
    const validation = validateExcuseForm({ reason, description })
    if (validation) {
      setError(validation)
      return
    }
    if (!reason) return
    setError(null)
    onSubmit(
      reason,
      description.trim(),
      photo ? `data:${photo.mimeType};base64,${photo.base64}` : undefined,
    )
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/65"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable className="flex-1" onPress={onClose} accessibilityRole="button" accessibilityLabel="Close excuse form" />
        <Pressable
          accessibilityRole="none"
          onPress={() => undefined}
          className="max-h-[92%] rounded-t-[30px] border-t-2 border-golden/40 bg-white px-5 pb-8 pt-3 dark:bg-surface-dark"
        >
          <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <View className="mb-4 flex-row items-start gap-4">
            <View className="h-12 w-12 items-center justify-center rounded-none bg-golden">
              <MaterialIcons name="assignment-turned-in" size={23} color={pupColors.maroonDark} />
            </View>
            <View className="flex-1">
              <Text className="font-sans-bold text-[10px] uppercase tracking-[2px] text-maroon dark:text-golden">Excuse request</Text>
              <Text className="mt-1 font-heading text-2xl text-ink dark:text-white">Explain this record</Text>
              <Text className="mt-1 font-sans text-xs leading-5 text-muted dark:text-zinc-400">
                Your instructor reviews every request. Supporting photos are optional.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/10"
            >
              <MaterialIcons name="close" size={20} color={isDark ? '#FFFFFF' : pupColors.maroonDark} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text className="mb-2 font-sans-bold text-xs uppercase tracking-wider text-ink dark:text-zinc-200">Reason</Text>
            <View className="gap-2">
              {EXCUSE_REASON_OPTIONS.map((option) => {
                const selected = reason === option.value
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => { setReason(option.value); setError(null) }}
                    className={`min-h-14 flex-row items-center gap-3 rounded-none border px-3 py-2 ${
                      selected
                        ? 'border-maroon border-l-4 border-l-maroon bg-maroon/5 dark:border-golden dark:border-l-golden dark:bg-golden/10'
                        : 'border-line dark:border-line-dark'
                    }`}
                  >
                    <View className={`h-4 w-4 items-center justify-center rounded-none border ${selected ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-muted'}`}>
                      {selected ? <View className="h-1.5 w-1.5 bg-white dark:bg-maroon-dark" /> : null}
                    </View>
                    <Text className="flex-1 font-sans-semibold text-sm text-ink dark:text-white">{option.label}</Text>
                  </Pressable>
                )
              })}
            </View>

            <Text className="mb-2 mt-5 font-sans-bold text-xs uppercase tracking-wider text-ink dark:text-zinc-200">What happened?</Text>
            <TextInput
              accessibilityLabel="Excuse description"
              className="min-h-24 rounded-none border border-line bg-zinc-50 p-4 font-sans text-sm text-ink dark:border-line-dark dark:bg-campus-dark dark:text-white"
              style={{ textAlignVertical: 'top' }}
              value={description}
              onChangeText={(text) => { setDescription(text); setError(null) }}
              placeholder="Add dates, context, or anything your instructor should know (at least 10 characters)."
              placeholderTextColor={isDark ? pupColors.muted : pupColors.mutedLight}
              maxLength={1_000}
              multiline
            />
            <Text className="mt-1 text-right font-sans text-[10px] text-muted dark:text-zinc-500">{description.length}/1000</Text>

            <Text className="mb-2 mt-4 font-sans-bold text-xs uppercase tracking-wider text-ink dark:text-zinc-200">Evidence (optional)</Text>
            {photo ? (
              <View className="flex-row items-center gap-3 rounded-none border border-line p-3 dark:border-line-dark">
                <Image source={{ uri: photo.uri }} className="h-16 w-16 rounded-none" resizeMode="cover" accessibilityLabel="Selected excuse evidence" />
                <View className="flex-1">
                  <Text className="font-sans-bold text-xs text-ink dark:text-white">Photo attached</Text>
                  <Text className="mt-1 font-sans text-[11px] text-muted dark:text-zinc-400">Stored with your request for review.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove attached photo"
                  onPress={() => setPhoto(null)}
                  className="h-11 w-11 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/10"
                >
                  <MaterialIcons name="delete-outline" size={20} color={isDark ? '#FFFFFF' : pupColors.maroonDark} />
                </Pressable>
              </View>
            ) : (
              <CampusButton label="Attach a photo" icon="add-photo-alternate" variant="secondary" onPress={() => void pickPhoto()} />
            )}

            {error ? (
              <Text accessibilityLiveRegion="assertive" className="mt-3 font-sans-semibold text-xs leading-5 text-red-700 dark:text-red-300">{error}</Text>
            ) : null}

            <View className="mt-5 flex-row gap-3">
              <CampusButton label="Cancel" variant="secondary" onPress={onClose} className="flex-1" />
              <CampusButton
                label={submitting ? 'Sending…' : 'Send request'}
                icon="send"
                disabled={submitting}
                onPress={submit}
                className="flex-1"
                testID="excuse-request-submit"
              />
            </View>
          </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}
