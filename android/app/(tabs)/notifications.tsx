import { NotificationCenter } from '../../components/NotificationCenter'
import { useAuthGate } from '../../hooks/use-auth-gate'

export default function StudentNotificationsScreen() {
  const user = useAuthGate(['student'])
  if (!user) return null
  return <NotificationCenter />
}
