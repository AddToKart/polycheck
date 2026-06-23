import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { api } from '../../services/mock-api'
import { useTheme } from '../../theme/ThemeContext'

export default function StudentLoginScreen() {
  const { isDark, toggle } = useTheme()
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = () => {
    setLoading(true)
    const user = api.loginStudent(studentId)
    if (user) {
      router.replace('/(tabs)/dashboard')
    } else {
      Alert.alert('Invalid credentials', 'Please check your student number and password.')
    }
    setLoading(false)
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.iconBtn, isDark && styles.iconBtnDark]}
              accessibilityLabel="Go back"
            >
              <MaterialIcons name="arrow-back" size={24} color={isDark ? '#FFF' : '#000'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggle}
              style={[styles.iconBtn, isDark && styles.iconBtnDark]}
              accessibilityLabel="Toggle theme"
            >
              <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
            </TouchableOpacity>
          </View>

          <View style={[styles.card, isDark && styles.cardDark]}>
            <Text style={[styles.heading, isDark && styles.textGolden]}>Student Access</Text>
            <Text style={[styles.subHeading, isDark && styles.textWhite50]}>Authenticate to continue</Text>
 
            <Text style={[styles.label, isDark && styles.textWhite50]}>Student Number</Text>
            <View style={[styles.inputRow, isDark && styles.inputRowDark]}>
              <MaterialIcons name="badge" size={20} color="#888" />
              <TextInput
                style={[styles.input, isDark && styles.textWhite]}
                placeholder="2024-00123-MN-0"
                placeholderTextColor={isDark ? '#666' : '#999'}
                value={studentId}
                onChangeText={setStudentId}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
 
            <Text style={[styles.label, isDark && styles.textWhite50]}>Password</Text>
            <View style={[styles.inputRow, isDark && styles.inputRowDark]}>
              <MaterialIcons name="lock" size={20} color="#888" />
              <TextInput
                style={[styles.input, isDark && styles.textWhite]}
                placeholder="••••••••"
                placeholderTextColor={isDark ? '#666' : '#999'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
 
            <Text style={[styles.demo, isDark && styles.textWhite50]}>
              Demo: Use any ID (e.g. 2024-00123-MN-0)
            </Text>
 
            <TouchableOpacity
              style={[styles.submitBtn, isDark && styles.submitBtnDark, loading && styles.disabled]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text style={[styles.submitText, isDark && styles.submitTextDark]}>{loading ? 'Verifying...' : 'Sign In'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  containerDark: { backgroundColor: '#0A0A0C' },
  flex1: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  iconBtn: { padding: 8, borderWidth: 2, borderColor: '#D4D4D8', backgroundColor: '#FFFFFF' },
  iconBtnDark: { borderColor: 'rgba(245, 168, 0, 0.25)', backgroundColor: '#121215' },
  card: {
    width: '100%', maxWidth: 384, alignSelf: 'center',
    borderWidth: 2, borderColor: '#D4D4D8', backgroundColor: '#FFFFFF',
    padding: 32,
  },
  cardDark: { borderColor: 'rgba(245, 168, 0, 0.2)', backgroundColor: '#121215' },
  heading: { fontSize: 36, fontWeight: '800', fontFamily: 'Lora_400Regular', color: '#7B1113', marginBottom: 8, letterSpacing: -1, textAlign: 'center' },
  subHeading: { fontSize: 11, fontWeight: '700', color: '#71717A', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginBottom: 40 },
  label: { fontSize: 10, fontWeight: '700', color: '#71717A', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 },
  inputRow: {
    borderWidth: 2, borderColor: '#D4D4D8', backgroundColor: '#FAFAFA',
    flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingHorizontal: 12,
  },
  inputRowDark: { borderColor: '#3F3F46', backgroundColor: '#27272A' },
  input: { flex: 1, paddingVertical: 16, paddingHorizontal: 12, fontSize: 16, color: '#000000' },
  demo: { fontSize: 10, fontWeight: '700', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginBottom: 24 },
  submitBtn: { backgroundColor: '#7B1113', borderWidth: 2, borderColor: '#7B1113', paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitBtnDark: { backgroundColor: '#FFDF00', borderColor: '#FFDF00' },
  disabled: { opacity: 0.5 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', fontFamily: 'Lora_400Regular', textTransform: 'uppercase', letterSpacing: 2 },
  submitTextDark: { color: '#4A0A0B' },
  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#FFDF00' },
})