import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusButton, CampusCard, CampusIconButton } from '../../components/CampusPrimitives'
import { CampusFormField } from '../../components/CampusFormField'

const fields = [
  { key: 'institution_name', label: 'Institution name', defaultValue: 'Polytechnic University of the Philippines', keyboard: 'default' as const, icon: 'account-balance' as const },
  { key: 'default_geofence_radius_meters', label: 'Default geofence radius', defaultValue: '40', keyboard: 'number-pad' as const, icon: 'my-location' as const, hint: 'Measured in meters.' },
  { key: 'default_qr_validity_minutes', label: 'Default QR validity', defaultValue: '5', keyboard: 'number-pad' as const, icon: 'timer' as const, hint: 'Measured in minutes.' },
  { key: 'enrollment_code_expiry_days', label: 'Enrollment code expiry', defaultValue: '14', keyboard: 'number-pad' as const, icon: 'vpn-key' as const, hint: 'Measured in days.' },
] as const

export default function InstitutionSettingsScreen() {
  const { isDark, toggle } = useTheme()
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.key, field.defaultValue])))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const current = api.getCurrentUser()
    if (!current || current.role !== 'super_admin') {
      router.replace('/(faculty)/dashboard')
      return
    }
    void api.getSettings()
      .then((settings) => setValues((currentValues) => ({ ...currentValues, ...Object.fromEntries(settings.map((setting) => [setting.key, setting.value])) })))
      .catch((error) => Alert.alert('Unable to load settings', error instanceof Error ? error.message : 'Try again.'))
      .finally(() => setLoading(false))
  }, [])

  const saveSettings = async () => {
    if (fields.some((field) => !values[field.key]?.trim())) {
      Alert.alert('Missing value', 'Complete every institution setting before saving.')
      return
    }
    setSaving(true)
    try {
      await Promise.all(fields.map((field) => api.setSetting(field.key, values[field.key])))
      Alert.alert('Settings saved', 'Institution defaults have been updated.')
    } catch (error) {
      Alert.alert('Unable to save settings', error instanceof Error ? error.message : 'Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0B0B0E' : '#F7F6F6' }}>
      <CampusHeader
        eyebrow="Super administrator"
        title="Institution settings"
        subtitle="Defaults applied when faculty create new attendance sessions."
        onBack={() => router.back()}
        actions={<CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />}
      />
      {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#7B1113" /></View> : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
          <CampusCard>
            <Text className="font-heading text-xl text-ink dark:text-white">University defaults</Text>
            <Text className="mb-6 mt-2 font-sans text-sm leading-5 text-muted dark:text-zinc-400">These values guide new sessions but do not alter existing records.</Text>
            <View className="gap-4">
              {fields.map((field) => <CampusFormField key={field.key} label={field.label} hint={'hint' in field ? field.hint : undefined} icon={field.icon} keyboardType={field.keyboard} value={values[field.key]} onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />)}
            </View>
            <CampusButton label={saving ? 'Saving settings…' : 'Save settings'} icon="save" disabled={saving} onPress={() => void saveSettings()} className="mt-7" />
          </CampusCard>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
