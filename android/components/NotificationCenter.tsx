import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import type { AppNotification, NotificationType } from '@polycheck/shared'
import { api } from '../services/api-client'
import { subscribeToNotifications } from '../services/realtime'
import {
  countUnreadNotifications,
  formatRelativeNotificationTime,
  markNotificationsReadLocally,
  mergeNotifications,
  resolveNotificationRoute,
} from '../lib/notifications'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import { CampusHeader } from './CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, CampusIconButton } from './CampusPrimitives'
import { useCampusToast } from './CampusToast'

const POLL_INTERVAL_MS = 30_000
const CLOCK_TICK_MS = 60_000

const TYPE_ICONS: Record<NotificationType, keyof typeof MaterialIcons.glyphMap> = {
  dispute_filed: 'gavel',
  dispute_resolved: 'verified',
  excuse_requested: 'assignment-turned-in',
  excuse_decided: 'fact-check',
  attendance_absent: 'event-busy',
  standing_below_threshold: 'trending-down',
  account_status_changed: 'manage-accounts',
  password_reset: 'lock-reset',
  role_changed: 'swap-horiz',
  key_provisioned: 'vpn-key',
}

function relativeTimeLabel(createdAt: string, now: number): string {
  return formatRelativeNotificationTime(createdAt, now)
}

export function NotificationCenter() {
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const listRef = useRef<AppNotification[]>([])
  const seenRealtimeRef = useRef(new Set<string>())
  const mountedRef = useRef(true)
  const user = api.getCurrentUser()

  const applyList = useCallback((next: AppNotification[]) => {
    listRef.current = next
    setNotifications(next)
  }, [])

  const refresh = useCallback(async (kind: 'initial' | 'poll' | 'refresh' = 'initial') => {
    try {
      const [list, count] = await Promise.all([
        api.getNotifications({ limit: 100 }),
        api.getUnreadNotificationCount(),
      ])
      if (!mountedRef.current) return
      applyList(list)
      seenRealtimeRef.current = new Set(list.map((notification) => notification.id))
      setUnread(typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : countUnreadNotifications(list))
      setError(null)
    } catch (loadError) {
      if (!mountedRef.current || kind === 'poll') return
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.')
    } finally {
      if (!mountedRef.current) return
      setLoading(false)
      if (kind === 'refresh') setRefreshing(false)
    }
  }, [applyList])

  useFocusEffect(useCallback(() => {
    mountedRef.current = true
    void refresh('initial')
    const poll = setInterval(() => { void refresh('poll') }, POLL_INTERVAL_MS)
    const clock = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    const unsubscribe = subscribeToNotifications((notification) => {
      if (!mountedRef.current || seenRealtimeRef.current.has(notification.id)) return
      seenRealtimeRef.current.add(notification.id)
      const next = mergeNotifications(listRef.current, [notification], 100)
      applyList(next)
      if (!notification.readAt) setUnread((current) => current + 1)
    })
    return () => {
      mountedRef.current = false
      clearInterval(poll)
      clearInterval(clock)
      unsubscribe()
    }
  }, [applyList, refresh]))

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void refresh('refresh')
  }, [refresh])

  const markAllRead = useCallback(async () => {
    if (unread === 0) return
    const previous = listRef.current
    applyList(markNotificationsReadLocally(previous, { all: true }))
    setUnread(0)
    try {
      await api.markNotificationsRead({ all: true })
    } catch (markError) {
      if (!mountedRef.current) return
      applyList(previous)
      setUnread(countUnreadNotifications(previous))
      showToast('error', 'Unable to mark notifications read', markError instanceof Error ? markError.message : 'Check your connection and try again.')
    }
  }, [applyList, showToast, unread])

  const openNotification = useCallback(async (notification: AppNotification) => {
    const route = user
      ? resolveNotificationRoute({ link: notification.link, type: notification.type }, user.role)
      : null
    if (route) router.push(route as never)
    if (notification.readAt) return

    try {
      await api.markNotificationsRead({ ids: [notification.id] })
      if (!mountedRef.current) return
      const next = markNotificationsReadLocally(listRef.current, { ids: [notification.id] })
      applyList(next)
      setUnread(countUnreadNotifications(next))
    } catch {
      if (mountedRef.current) {
        showToast('error', 'Unable to mark as read', 'The notification is still unread. Try again when you are online.')
      }
    }
  }, [applyList, showToast, user])

  const openDashboard = () => {
    if (router.canGoBack()) router.back()
    else router.replace(user?.role === 'student' ? '/(tabs)/dashboard' : '/(faculty)/dashboard')
  }

  const renderItem = ({ item: notification }: { item: AppNotification }) => {
    const unreadItem = !notification.readAt
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${unreadItem ? 'Unread. ' : ''}${notification.title}. ${notification.body}`}
        accessibilityHint="Opens the related screen"
        onPress={() => void openNotification(notification)}
        className={`min-h-16 flex-row gap-3 border border-line p-4 dark:border-line-dark ${
          unreadItem
            ? 'border-l-4 border-l-golden bg-golden/5 dark:bg-golden/5'
            : 'bg-white dark:bg-surface-dark'
        }`}
      >
        <View className={`h-11 w-11 items-center justify-center rounded-none ${unreadItem ? 'bg-golden/25 dark:bg-golden/15' : 'bg-maroon/5 dark:bg-white/5'}`}>
          <MaterialIcons
            name={TYPE_ICONS[notification.type] ?? 'notifications'}
            size={20}
            color={isDark ? pupColors.golden : pupColors.maroon}
          />
        </View>
        <View className="flex-1">
          <View className="flex-row items-start gap-2">
            {unreadItem ? <View className="mt-1.5 h-2 w-2 rounded-full bg-maroon dark:bg-golden" /> : null}
            <Text
              className={`flex-1 font-sans text-sm leading-5 ${unreadItem ? 'font-sans-bold text-ink dark:text-white' : 'font-sans-semibold text-ink dark:text-zinc-200'}`}
              numberOfLines={2}
            >
              {notification.title}
            </Text>
          </View>
          <Text className="mt-1 font-sans text-xs leading-5 text-muted dark:text-zinc-400" numberOfLines={3}>
            {notification.body}
          </Text>
          <Text className="mt-1.5 font-sans-bold text-[10px] uppercase tracking-wider text-muted dark:text-zinc-500">
            {relativeTimeLabel(notification.createdAt, now)}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={isDark ? pupColors.mutedLight : pupColors.muted} />
      </Pressable>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark" testID="notification-center">
      <CampusHeader
        eyebrow="Updates"
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread · ${notifications.length} total` : 'You are all caught up.'}
        onBack={openDashboard}
        actions={(
          <>
            <CampusIconButton icon="done-all" label="Mark all notifications read" onPress={() => void markAllRead()} disabled={unread === 0} inverse testID="notifications-mark-all" />
            <CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />
          </>
        )}
      />

      {loading ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading notifications" className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={isDark ? pupColors.golden : pupColors.maroon} />
          <Text className="mt-3 font-sans-medium text-sm text-muted dark:text-zinc-400">Loading notifications…</Text>
        </View>
      ) : error && !notifications.length ? (
        <View className="px-4 pt-4">
          <CampusCard className="border-l-red-600 border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
            <Text accessibilityLiveRegion="assertive" className="font-sans-bold text-sm text-red-900 dark:text-red-200">Unable to load notifications</Text>
            <Text className="mt-1 font-sans text-xs leading-5 text-red-700 dark:text-red-300">{error}</Text>
            <CampusButton label="Try again" icon="refresh" variant="secondary" onPress={() => { setLoading(true); void refresh('initial') }} className="mt-4" />
          </CampusCard>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={notifications}
          keyExtractor={(notification) => notification.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? pupColors.golden : pupColors.maroon} />}
          ListEmptyComponent={(
            <CampusEmptyState
              icon="notifications-none"
              title="NO NOTIFICATIONS YET"
              description="Updates about excuses, disputes, and attendance will appear here."
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}
