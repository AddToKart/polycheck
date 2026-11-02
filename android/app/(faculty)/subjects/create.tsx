import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { api } from '../../../services/api-client'
import { useAuthGate } from '../../../hooks/use-auth-gate'
import { CampusHeader } from '../../../components/CampusHeader'
import { CampusButton, CampusCard } from '../../../components/CampusPrimitives'
import { CampusFormField } from '../../../components/CampusFormField'
import { useCampusToast } from '../../../components/CampusToast'

export default function CreateSubjectScreen() {
  const { showToast } = useCampusToast()
  const user = useAuthGate(['teacher'])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const createSubject = async () => {
    if (!user || !name.trim() || !code.trim()) return
    setCreating(true)
    try {
      await api.createSubject({ name: name.trim(), code: code.trim().toUpperCase(), description: description.trim() || undefined })
      showToast('success', 'Subject created', 'You can now add class sections to this subject.')
      router.replace('/(faculty)/subjects')
    } catch (error) {
      showToast('error', 'Unable to create subject', error instanceof Error ? error.message : 'Try again in a moment.')
    } finally {
      setCreating(false)
    }
  }

  if (!user) return null

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader eyebrow="Faculty workspace" title="Create a subject" subtitle="Add the parent course first, then create its class sections." onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-12" keyboardShouldPersistTaps="handled">
        <CampusCard>
          <Text className="font-heading text-xl text-ink dark:text-white">Subject profile</Text>
          <Text className="mb-6 mt-2 font-sans text-sm leading-5 text-muted dark:text-zinc-400">Use the official curriculum name and course code students recognize.</Text>
          <View className="gap-4">
            <CampusFormField label="Subject name" value={name} onChangeText={setName} placeholder="Software Engineering" icon="auto-stories" />
            <CampusFormField label="Subject code" value={code} onChangeText={setCode} placeholder="CCIS 3104" icon="tag" autoCapitalize="characters" />
            <CampusFormField label="Description" value={description} onChangeText={setDescription} placeholder="Optional overview of the subject" icon="notes" multiline maxLength={500} />
          </View>
          <CampusButton label={creating ? 'Creating subject…' : 'Create subject'} icon="add" disabled={!name.trim() || !code.trim() || creating} onPress={() => void createSubject()} className="mt-7" />
        </CampusCard>
      </ScrollView>
    </SafeAreaView>
  )
}
