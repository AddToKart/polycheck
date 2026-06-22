import { useState, useEffect } from 'react'
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../../services/mock-api'
import { fonts } from '../../../theme/typography'
import { useTheme } from '../../../theme/ThemeContext'
import type { User } from '@polycheck/shared'

export default function CreateSubjectScreen() {
  const { isDark } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu) setUser(cu)
  }, [])

  const handleCreate = () => {
    if (!user || !name || !code) return
    api.createSubject({ name, code, description: description || undefined })
    router.push('/(faculty)/subjects')
  }

  if (!user) return null

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#F5A800' : '#7B1113'} />
        </TouchableOpacity>
        <Text style={[styles.heading, isDark && styles.headingDark]}>Create Subject</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Subject Name */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Subject Name</Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Software Engineering"
          placeholderTextColor="#AAA"
        />

        {/* Subject Code */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Subject Code</Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          value={code}
          onChangeText={setCode}
          placeholder="e.g. CCIS 3104"
          placeholderTextColor="#AAA"
        />

        {/* Description */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Description (optional)</Text>
        <TextInput
          style={[styles.textArea, isDark && styles.inputDark]}
          value={description}
          onChangeText={setDescription}
          placeholder="Brief description of the subject"
          placeholderTextColor="#AAA"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Create button */}
        <TouchableOpacity
          style={[styles.createBtn, isDark && styles.createBtnDark, (!name || !code) && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!name || !code}
          accessibilityRole="button"
          accessibilityLabel="Create subject"
        >
          <MaterialIcons name="add" size={20} color="#FFFFFF" />
          <Text style={[styles.createBtnText, isDark && styles.createBtnTextDark]}>Create Subject</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0C' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  backBtn: { padding: 4, marginRight: 12 },
  heading: { flex: 1, fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A' },
  headingDark: { color: '#F5A800' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },
  label: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#888', marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelDark: { color: 'rgba(255,255,255,0.5)' },
  input: { borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: fonts.body, color: '#333', backgroundColor: '#FFFFFF' },
  inputDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215', color: '#FFF' },
  textArea: { borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: fonts.body, color: '#333', backgroundColor: '#FFFFFF', minHeight: 100 },
  createBtn: { backgroundColor: '#7B1113', paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 32 },
  createBtnDark: { backgroundColor: '#F5A800' },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  createBtnTextDark: { color: '#4A0A0B' },
})
