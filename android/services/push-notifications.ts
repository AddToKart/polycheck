import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import type { User } from '@polycheck/shared'
import { api } from './api-client'
import { resolveNotificationRoute } from '../lib/notifications'

const CHANNEL_ID = 'default'
const E2E_MODE = process.env.EXPO_PUBLIC_E2E_MODE === 'true'
let lastAttemptedUserId: string | null = null

function debug(message: string, error?: unknown) {
  if (__DEV__) console.debug(`[polycheck:push] ${message}`, error ?? '')
}

/**
 * Foreground notifications stay quiet: the in-app center is the source of
 * truth and the realtime socket updates the badge while the app is open.
 */
export function configureForegroundNotifications() {
  if (Platform.OS === 'web') return
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
}

function expoProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  return extra?.eas?.projectId?.trim() || null
}

/**
 * Requests permission and registers an Expo push token once per app session.
 * Missing EAS project ids (bare dev clients, local builds) are skipped without
 * touching the UI so the app never crashes when push is not configured.
 */
export async function registerForPushNotifications(user: User): Promise<boolean> {
  if (Platform.OS === 'web' || E2E_MODE) return false
  if (lastAttemptedUserId === user.id) return false
  lastAttemptedUserId = user.id

  const projectId = expoProjectId()
  if (!projectId) {
    debug('Skipped: no extra.eas.projectId in app config')
    return false
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Polycheck alerts',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#FFDF00',
      })
    }

    const existing = await Notifications.getPermissionsAsync()
    let status = existing.status
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync()
      status = requested.status
    }
    if (status !== 'granted') {
      debug('Skipped: notification permission not granted')
      return false
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId })
    await api.registerPushToken({ token: token.data, platform: 'expo' })
    return true
  } catch (error) {
    debug('Registration failed', error)
    return false
  }
}

/**
 * Routes a tapped push notification into the app. Handles both a cold-start
 * response and responses received while the app is running.
 */
export function subscribeToNotificationOpens(
  user: User,
  onRoute: (route: string) => void,
): () => void {
  if (Platform.OS === 'web') return () => undefined

  const handled = new Set<string>()
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!response) return
    const identifier = response.notification.request.identifier
    if (identifier && handled.has(identifier)) return
    if (identifier) handled.add(identifier)

    const data = (response.notification.request.content.data ?? {}) as {
      link?: unknown
      type?: unknown
      notificationId?: unknown
    }
    const route = resolveNotificationRoute({
      link: typeof data.link === 'string' ? data.link : undefined,
      type: typeof data.type === 'string' ? data.type : undefined,
    }, user.role)
    if (typeof data.notificationId === 'string') {
      void api.markNotificationsRead({ ids: [data.notificationId] }).catch(() => undefined)
    }
    if (route) onRoute(route)
  }

  const subscription = Notifications.addNotificationResponseReceivedListener(handle)
  try {
    handle(Notifications.getLastNotificationResponse())
    Notifications.clearLastNotificationResponse()
  } catch (error) {
    debug('Unable to read the last notification response', error)
  }

  return () => subscription.remove()
}
