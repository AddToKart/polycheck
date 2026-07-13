import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/mock-api'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'

const fields = [
  { key: 'institution_name', label: 'Institution name', defaultValue: 'Polytechnic University of the Philippines', keyboard: 'default' },
  { key: 'default_geofence_radius_meters', label: 'Default geofence radius (meters)', defaultValue: '40', keyboard: 'number-pad' },
  { key: 'default_qr_validity_minutes', label: 'Default QR validity (minutes)', defaultValue: '5', keyboard: 'number-pad' },
  { key: 'enrollment_code_expiry_days', label: 'Enrollment code expiry (days)', defaultValue: '14', keyboard: 'number-pad' },
] as const

export default function InstitutionSettingsScreen() {
  const { isDark } = useTheme()
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
      .catch((error) => Alert.alert('Unable to load settings', error instanceof Error ? error.message : 'Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (fields.some((field) => !values[field.key]?.trim())) {
      Alert.alert('Missing value', 'Complete every setting before saving.')
      return
    }
    setSaving(true)
    try {
      await Promise.all(fields.map((field) => api.setSetting(field.key, values[field.key])))
      Alert.alert('Settings saved', 'Institution defaults have been updated.')
    } catch (error) {
      Alert.alert('Unable to save settings', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const background = isDark ? '#0A0A0C' : '#F5F5F5'
  const surface = isDark ? '#121215' : '#FFFFFF'
  const border = isDark ? 'rgba(255,223,0,0.18)' : '#E4E4E7'
  const text = isDark ? '#FFFFFF' : '#27272A'
  const secondary = isDark ? 'rgba(255,255,255,0.55)' : '#71717A'

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: background }]}>
      <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: isDark ? '#FFDF00' : '#4A0A0B' }]}>Institution Settings</Text>
          <Text style={[styles.subtitle, { color: secondary }]}>Defaults for new attendance sessions</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={isDark ? '#FFDF00' : '#7B1113'} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
            {fields.map((field) => (
              <View style={styles.field} key={field.key}>
                <Text style={[styles.label, { color: text }]}>{field.label}</Text>
                <TextInput
                  value={values[field.key]}
                  onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
                  keyboardType={field.keyboard}
                  style={[styles.input, { color: text, borderColor: border, backgroundColor: isDark ? '#18181B' : '#FAFAFA' }]}
                  placeholderTextColor={secondary}
                />
              </View>
            ))}
            <TouchableOpacity disabled={saving} onPress={() => void handleSave()} style={[styles.saveButton, { backgroundColor: isDark ? '#FFDF00' : '#7B1113' }]}>
              {saving ? <ActivityIndicator color={isDark ? '#4A0A0B' : '#FFFFFF'} /> : (
                <>
                  <MaterialIcons name="save" size={18} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
                  <Text style={[styles.saveText, { color: isDark ? '#4A0A0B' : '#FFFFFF' }]}>Save Settings</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  iconButton: { padding: 6 },
  headerCopy: { flex: 1, marginLeft: 8 },
  title: { fontSize: 21, fontWeight: '700', fontFamily: fonts.heading },
  subtitle: { marginTop: 2, fontSize: 11, fontFamily: fonts.body },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  card: { borderWidth: 1, padding: 18, gap: 18 },
  field: { gap: 7 },
  label: { fontSize: 13, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  input: { height: 48, borderWidth: 1, paddingHorizontal: 12, fontSize: 15, fontFamily: fonts.body },
  saveButton: { height: 48, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { fontSize: 14, fontWeight: '700', fontFamily: fonts.bodyBold, textTransform: 'uppercase', letterSpacing: 0.5 },
})
