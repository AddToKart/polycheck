import { NotificationCenter } from '../../components/NotificationCenter'
import { useAuthGate } from '../../hooks/use-auth-gate'

export default function FacultyNotificationsScreen() {
  const user = useAuthGate(['teacher', 'super_admin'])
  if (!user) return null
  return <NotificationCenter />
}
