import { AssistantChat } from '../../components/AssistantChat'
import { useAuthGate } from '../../hooks/use-auth-gate'

export default function StudentAssistantScreen() {
  const user = useAuthGate(['student'])
  if (!user) return null

  return <AssistantChat mode="student" />
}
