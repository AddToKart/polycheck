import { useEffect, useState } from 'react'
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import type { ProofOfClass, Section, Session, Student, Subject } from '@polycheck/shared'
import * as ImagePicker from 'expo-image-picker'
import { api } from '../../../../../services/api-client'
import { useTheme } from '../../../../../theme/ThemeContext'
import { CampusHeader } from '../../../../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, SectionHeading } from '../../../../../components/CampusPrimitives'
import { CampusFormField } from '../../../../../components/CampusFormField'

export default function StudentSessionDetailScreen() {
  const { isDark } = useTheme()
  const { id: sectionId, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>()
  const [user, setUser] = useState<Student | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [section, setSection] = useState<Section | null>(null)
  const [proofs, setProofs] = useState<ProofOfClass[]>([])
  const [subject, setSubject] = useState<Subject | null>(null)
  const [isQac, setIsQac] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [photoDescription, setPhotoDescription] = useState('')
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const currentUser = api.getCurrentUser()
    if (!currentUser || currentUser.role !== 'student') {
      router.replace('/')
      return
    }
    const student = currentUser as Student
    setUser(student)
    void api.getStudentRoles(student.id).then((roles) => setIsQac(roles.some((role) => role.sectionId === sectionId && role.role === 'qac')))
  }, [sectionId])

  useEffect(() => {
    if (!sessionId || !sectionId) return
    void Promise.all([api.getSession(sessionId), api.getSection(sectionId), api.getProofsOfClass(sessionId)])
      .then(async ([nextSession, nextSection, nextProofs]) => {
        setSession(nextSession)
        setSection(nextSection)
        setProofs(nextProofs)
        setSubject(await api.getSubject(nextSection.subjectId))
      })
      .catch(() => router.back())
  }, [sectionId, sessionId])

  const captureProofPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Camera required', 'Allow camera access to capture proof of class.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.7, base64: true })
    const asset = result.canceled ? undefined : result.assets[0]
    if (!asset?.base64) return
    const mimeType = asset.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType) ? asset.mimeType : 'image/jpeg'
    if (asset.base64.length * 0.75 > 5_000_000) {
      Alert.alert('Photo too large', 'Proof photos must be 5 MB or smaller.')
      return
    }
    setUploadedPhoto(`data:${mimeType};base64,${asset.base64}`)
  }

  const uploadProof = async () => {
    if (!user || !session || !uploadedPhoto) return
    setUploading(true)
    try {
      await api.uploadProofOfClass({
        sectionId: session.sectionId,
        sessionId: session.id,
        photoData: uploadedPhoto,
        description: photoDescription.trim() || undefined,
        uploadedBy: user.id,
        uploadedByStudentName: user.fullName,
      })
      setProofs(await api.getProofsOfClass(sessionId))
      setShowUpload(false)
      setPhotoDescription('')
      setUploadedPhoto(null)
      Alert.alert('Proof uploaded', 'The class photo is now attached to this session.')
    } catch (error) {
      Alert.alert('Unable to upload proof', error instanceof Error ? error.message : 'Try again in a moment.')
    } finally {
      setUploading(false)
    }
  }

  if (!session || !section) return null

  const sessionStats: Array<{ label: string; value: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
    { label: 'Time', value: `${session.startTime}–${session.endTime}`, icon: 'access-time' },
    { label: 'Status', value: session.isActive ? 'Active now' : 'Completed', icon: session.isActive ? 'radio-button-checked' : 'check-circle' },
    { label: 'Room', value: session.room || 'TBA', icon: 'room' },
  ]

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow={new Date(`${session.date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' })}
        title={subject?.name ?? 'Class session'}
        subtitle={`Section ${section.section} · ${session.startTime}–${session.endTime}`}
        onBack={() => router.back()}
      />

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-24">
        <CampusCard className="mb-7">
          <Text className="mb-4 font-sans-bold text-[10px] uppercase tracking-[1.5px] text-muted dark:text-zinc-500">Session details</Text>
          <View className="flex-row gap-3">
            {sessionStats.map((stat) => (
              <View key={stat.label} className="min-w-[30%] flex-1 rounded-2xl bg-zinc-50 p-3 dark:bg-white/5">
                <MaterialIcons name={stat.icon} size={18} color={isDark ? '#FFDF00' : '#7B1113'} />
                <Text className="mt-3 font-sans-bold text-[9px] uppercase tracking-[1px] text-muted dark:text-zinc-500">{stat.label}</Text>
                <Text className="mt-1 font-sans-bold text-xs text-ink dark:text-white">{stat.value}</Text>
              </View>
            ))}
          </View>
        </CampusCard>

        <SectionHeading eyebrow="Session evidence" title="Proof of class" />
        {isQac ? (
          <CampusCard className="mb-5">
            <View className="flex-row items-start gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-golden/15"><MaterialIcons name="camera-alt" size={21} color={isDark ? '#FFDF00' : '#7B1113'} /></View>
              <View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">QAC evidence upload</Text><Text className="mt-1 font-sans text-xs leading-5 text-muted dark:text-zinc-400">Capture the classroom during this session for the audit record.</Text></View>
            </View>
            <CampusButton label={showUpload ? 'Hide uploader' : 'Add proof photo'} icon={showUpload ? 'close' : 'add-a-photo'} variant="secondary" onPress={() => setShowUpload((visible) => !visible)} className="mt-4" />

            {showUpload ? (
              <View className="mt-4 border-t border-line pt-4 dark:border-line-dark">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={uploadedPhoto ? 'Retake proof photo' : 'Capture proof photo'}
                  onPress={() => void captureProofPhoto()}
                  className="aspect-video overflow-hidden rounded-3xl border border-dashed border-line bg-zinc-100 dark:border-line-dark dark:bg-white/5"
                >
                  {uploadedPhoto ? <Image source={{ uri: uploadedPhoto }} className="h-full w-full" resizeMode="cover" /> : <View className="flex-1 items-center justify-center"><MaterialIcons name="add-a-photo" size={28} color={isDark ? '#FFDF00' : '#7B1113'} /><Text className="mt-2 font-sans-bold text-xs text-muted dark:text-zinc-400">Tap to capture</Text></View>}
                </Pressable>
                <CampusFormField label="Description" value={photoDescription} onChangeText={setPhotoDescription} placeholder="Optional note about this class photo" className="mt-4" />
                <View className="mt-4 flex-row gap-3">
                  <CampusButton label="Cancel" variant="secondary" onPress={() => { setShowUpload(false); setUploadedPhoto(null) }} className="flex-1" />
                  <CampusButton label={uploading ? 'Uploading…' : 'Upload proof'} icon="cloud-upload" disabled={!uploadedPhoto || uploading} onPress={() => void uploadProof()} className="flex-1" />
                </View>
              </View>
            ) : null}
          </CampusCard>
        ) : null}

        {!proofs.length ? <CampusEmptyState icon="photo-camera" title="No proof photos yet" description="Photos uploaded by the QAC officer will appear here for the class audit." /> : (
          <View className="flex-row flex-wrap gap-3">
            {proofs.map((proof) => (
              <CampusCard key={proof.id} className="w-[48%] p-2">
                <Image source={{ uri: proof.photoData }} className="aspect-video w-full rounded-2xl bg-zinc-100" resizeMode="cover" />
                <Text className="mt-3 font-sans-bold text-xs text-ink dark:text-white" numberOfLines={1}>{proof.uploadedByStudentName}</Text>
                <Text className="mt-1 font-sans text-[9px] text-muted dark:text-zinc-500">{new Date(proof.uploadedAt).toLocaleString('en-PH')}</Text>
                {proof.description ? <Text className="mt-2 font-sans text-[10px] italic leading-4 text-muted dark:text-zinc-400" numberOfLines={2}>{proof.description}</Text> : null}
              </CampusCard>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
