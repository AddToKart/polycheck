import { router } from 'expo-router'
import { AssistantChat } from '../../components/AssistantChat'
import { useAuthGate } from '../../hooks/use-auth-gate'

export default function FacultyAssistantScreen() {
  const user = useAuthGate(['teacher', 'super_admin'])
  if (!user) return null

  return (
    <AssistantChat
      mode={user.role === 'super_admin' ? 'admin' : 'faculty'}
      onBack={() => {
        if (router.canGoBack()) router.back()
        else router.replace('/(faculty)/dashboard')
      }}
    />
  )
}
