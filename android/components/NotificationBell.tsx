import { router } from 'expo-router'
import { api } from '../services/api-client'
import { useNotificationBadge } from '../hooks/use-notification-badge'
import { CampusIconButton } from './CampusPrimitives'

/**
 * Bell + unread badge for the student and faculty dashboards. The center is a
 * hidden route inside each group so the dashboard stays the entry point.
 */
export function NotificationBell({ inverse = false }: { inverse?: boolean }) {
  const user = api.getCurrentUser()
  const { count } = useNotificationBadge(Boolean(user))

  if (!user) return null

  return (
    <CampusIconButton
      icon="notifications"
      label="Notifications"
      inverse={inverse}
      badge={count}
      testID="notifications-bell"
      onPress={() => router.push(user.role === 'student' ? '/(tabs)/notifications' : '/(faculty)/notifications')}
    />
  )
}
