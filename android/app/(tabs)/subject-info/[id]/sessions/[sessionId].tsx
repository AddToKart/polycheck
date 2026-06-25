import { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../../../../../services/mock-api'
import { fonts } from '../../../../../theme/typography'
import { useTheme } from '../../../../../theme/ThemeContext'
import type { Student, Session, Section, ProofOfClass } from '@polycheck/shared'

export default function StudentSessionDetailScreen() {
  const { isDark } = useTheme()
  const { id: sectionId, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>()
  const [user, setUser] = useState<Student | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [section, setSection] = useState<Section | null>(null)
  const [proofs, setProofs] = useState<ProofOfClass[]>([])
  const [isQac, setIsQac] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [photoDescription, setPhotoDescription] = useState('')
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'student') { router.replace('/'); return }
    const student = cu as Student
    setUser(student)
    const roles = api.getStudentRoles(student.id)
    setIsQac(roles.some(r => r.sectionId === sectionId && r.role === 'qac'))
  }, [sectionId])

  useEffect(() => {
    if (!sessionId || !sectionId) return
    setSession(api.getSession(sessionId) ?? null)
    setSection(api.getSection(sectionId) ?? null)
    setProofs(api.getProofsOfClass(sessionId))
  }, [sessionId, sectionId])

  const handleUploadProof = () => {
    if (!user || !session) return
    api.uploadProofOfClass({
      sectionId: session.sectionId,
      sessionId: session.id,
      photoData: uploadedPhoto ?? `proof-${Date.now()}`,
      description: photoDescription || undefined,
      uploadedBy: user.id,
      uploadedByStudentName: user.fullName,
    })
    setProofs(api.getProofsOfClass(sessionId))
    setShowUpload(false)
    setPhotoDescription('')
    setUploadedPhoto(null)
  }

  const handleDeleteProof = (proofId: string) => {
    api.deleteProofOfClass(proofId)
    setProofs(api.getProofsOfClass(sessionId))
  }

  if (!session || !section) return null

  const subj = api.getSubject(section.subjectId)
  const bg = isDark ? '#0A0A0C' : '#F5F5F5'
  const surface = isDark ? '#121215' : '#FFFFFF'
  const border = isDark ? 'rgba(245, 168, 0, 0.15)' : '#DDD'
  const textPrimary = isDark ? '#FFFFFF' : '#333'
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#888'
  const textTertiary = isDark ? 'rgba(255,255,255,0.5)' : '#999'
  const iconColor = isDark ? '#FFDF00' : '#7B1113'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: surface, borderBottomWidth: 1, borderBottomColor: border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
          <MaterialIcons name="arrow-back" size={22} color={iconColor} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text className="text-lg font-heading font-bold" style={{ color: isDark ? '#FFDF00' : '#4A0A0B' }} numberOfLines={1}>{subj?.name ?? ''}</Text>
          <Text className="text-xs mt-0.5" style={{ color: textSecondary }}>
            {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Session Info */}
        <View style={{ backgroundColor: surface, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border }}>
          <Text className="text-sm font-sans-bold mb-3" style={{ color: textPrimary }}>Session Details</Text>
          <View className="flex-row flex-wrap gap-4">
            <View>
              <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px]" style={{ color: textSecondary }}>Time</Text>
              <Text className="text-sm font-sans-semibold" style={{ color: textPrimary }}>{session.startTime} - {session.endTime}</Text>
            </View>
            <View>
              <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px]" style={{ color: textSecondary }}>Status</Text>
              <Text className="text-sm font-sans-semibold" style={{ color: session.isActive ? '#4CAF50' : textSecondary }}>{session.isActive ? 'Active' : 'Completed'}</Text>
            </View>
            {session.room && (
              <View>
                <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px]" style={{ color: textSecondary }}>Room</Text>
                <Text className="text-sm font-sans-semibold" style={{ color: textPrimary }}>{session.room}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Proof of Class */}
        <View style={{ backgroundColor: surface, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border }}>
          <View className="flex-row items-center gap-1.5 mb-3">
            <MaterialIcons name="camera-alt" size={18} color={iconColor} />
            <Text className="text-sm font-sans-bold" style={{ color: textPrimary }}>Proof of Class</Text>
          </View>

          {isQac && (
            <View className="mb-3">
              <TouchableOpacity
                className="flex-row items-center gap-1 px-3 py-1.5 border self-start mb-2"
                style={{ borderColor: border }}
                onPress={() => setShowUpload(!showUpload)}
                accessibilityRole="button"
              >
                <MaterialIcons name="cloud-upload" size={16} color={iconColor} />
                <Text className="text-xs font-sans-semibold" style={{ color: textPrimary }}>Upload Proof Photo</Text>
              </TouchableOpacity>
              {showUpload && (
                <View style={{ backgroundColor: isDark ? '#0A0A0C' : '#F9F9F9', padding: 12, borderWidth: 1, borderColor: border }}>
                  <TouchableOpacity
                    style={{ width: '100%', aspectRatio: 16 / 9, borderWidth: 2, borderStyle: 'dashed', borderColor: isDark ? 'rgba(245,168,0,0.3)' : '#CCC', alignItems: 'center', justifyContent: 'center', marginBottom: 10, backgroundColor: isDark ? '#121215' : '#F5F5F5' }}
                    onPress={() => setUploadedPhoto(`proof-${Date.now()}`)}
                  >
                    {uploadedPhoto ? (
                      <View className="items-center">
                        <MaterialIcons name="camera-alt" size={28} color="#4CAF50" />
                        <Text className="text-xs font-sans-medium mt-1" style={{ color: '#4CAF50' }}>Photo captured</Text>
                      </View>
                    ) : (
                      <View className="items-center">
                        <MaterialIcons name="camera-alt" size={28} color="#999" />
                        <Text className="text-xs font-sans-medium mt-1" style={{ color: '#999' }}>Tap to capture</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TextInput
                    className="text-sm border px-3 py-2 mb-2"
                    style={{ color: textPrimary, borderColor: border, backgroundColor: isDark ? '#0A0A0C' : '#FFF' }}
                    value={photoDescription}
                    onChangeText={setPhotoDescription}
                    placeholder="Add description (optional)"
                    placeholderTextColor="#999"
                  />
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      className="px-4 py-2"
                      style={{ backgroundColor: isDark ? '#FFDF00' : '#7B1113', opacity: uploadedPhoto ? 1 : 0.5 }}
                      onPress={handleUploadProof}
                      disabled={!uploadedPhoto}
                      accessibilityRole="button"
                    >
                      <Text className="text-xs font-sans-semibold" style={{ color: isDark ? '#4A0A0B' : '#FFF' }}>Submit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="px-4 py-2 border" style={{ borderColor: border }} onPress={() => setShowUpload(false)} accessibilityRole="button">
                      <Text className="text-xs font-sans-semibold" style={{ color: textSecondary }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {proofs.length === 0 ? (
            <Text className="text-sm text-center py-4" style={{ color: textTertiary }}>No proof photos uploaded yet.</Text>
          ) : (
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              {proofs.map((poc) => (
                <View key={poc.id} style={{ width: '47%', backgroundColor: isDark ? '#0A0A0C' : '#F9F9F9', borderWidth: 1, borderColor: border, padding: 10 }}>
                  <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: isDark ? '#1A1A1D' : '#E5E5E5', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    <MaterialIcons name="camera-alt" size={24} color={isDark ? 'rgba(255,255,255,0.3)' : '#BBB'} />
                  </View>
                  <Text numberOfLines={1} className="text-xs font-sans-semibold" style={{ color: textPrimary }}>{poc.uploadedByStudentName}</Text>
                  <Text className="text-[9px]" style={{ color: textSecondary }}>{new Date(poc.uploadedAt).toLocaleString()}</Text>
                  {poc.description && <Text className="text-[9px] italic mt-0.5" style={{ color: textTertiary }}>"{poc.description}"</Text>}
                  {isQac && user?.id === poc.uploadedBy && (
                    <TouchableOpacity className="flex-row items-center gap-1 mt-1.5" onPress={() => handleDeleteProof(poc.id)} accessibilityRole="button">
                      <MaterialIcons name="delete" size={12} color="#EF4444" />
                      <Text style={{ fontSize: 9, color: '#EF4444', fontWeight: '600' }}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
