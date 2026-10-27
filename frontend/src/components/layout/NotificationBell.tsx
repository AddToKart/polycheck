'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import type { AppNotification } from '@polycheck/shared'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatRelativeTime } from '@/lib/admin-overview'
import {
  NOTIFICATION_TYPE_LABELS,
  notificationDestination,
} from '@/lib/notification-center'
import { cn } from '@/lib/utils'

interface NotificationBellProps {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  error: string | null
  onOpen: () => void
  onMarkAll: () => void
  onMarkRead: (notification: AppNotification) => Promise<void> | void
  triggerClassName?: string
}

function badgeLabel(count: number) {
  return count > 99 ? '99+' : String(count)
}

/**
 * Notification centre bell. Rendered in the desktop sidebar header and the
 * mobile top bar from `Sidebar`; both instances share the same state.
 */
export function NotificationBell({
  notifications,
  unreadCount,
  loading,
  error,
  onOpen,
  onMarkAll,
  onMarkRead,
  triggerClassName,
}: NotificationBellProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) onOpen()
  }

  const selectNotification = (notification: AppNotification) => {
    const destination = notificationDestination(notification)
    setOpen(false)
    // Let the authoritative read persist before the next page's badge poll so
    // the unread count cannot reappear while navigating.
    void Promise.resolve(onMarkRead(notification)).finally(() => {
      if (destination) router.push(destination)
    })
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          className={cn(
            'relative inline-flex h-9 w-9 items-center justify-center rounded-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-golden focus-visible:ring-offset-2 focus-visible:ring-offset-maroon',
            triggerClassName,
          )}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center border border-maroon bg-golden px-1 text-[9px] font-bold leading-4 text-maroon-dark dark:border-golden-dark"
            >
              {badgeLabel(unreadCount)}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        aria-label="Notifications"
        className="w-[22rem] max-w-[calc(100vw-2rem)] rounded-none border-zinc-300 p-0 dark:border-zinc-700 dark:bg-surface-dark"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <p className="font-heading text-sm font-bold text-maroon dark:text-golden">Notifications</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
            </p>
          </div>
          <button
            type="button"
            onClick={onMarkAll}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-1.5 border border-zinc-300 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:border-maroon hover:text-maroon disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-golden dark:hover:text-golden"
          >
            <CheckCheck className="h-3 w-3" aria-hidden="true" />
            Mark all read
          </button>
        </div>

        <div className="max-h-[22rem] overflow-y-auto" aria-live="polite">
          {loading && notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Loading notifications…
            </p>
          ) : error && notifications.length === 0 ? (
            <div role="alert" className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              <button
                type="button"
                onClick={onOpen}
                className="border border-zinc-300 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:border-maroon hover:text-maroon dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-golden dark:hover:text-golden"
              >
                Try again
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">No notifications yet</p>
              <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                Disputes, excuses, and attendance updates will appear here.
              </p>
            </div>
          ) : (
            <>
              {error ? (
                <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-[11px] text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                  {error}
                </p>
              ) : null}
              <ul>
              {notifications.map((notification, index) => {
                const unread = !notification.readAt
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => selectNotification(notification)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60',
                        index !== 0 ? 'border-t border-zinc-100 dark:border-zinc-800' : '',
                        unread ? 'bg-zinc-50/70 dark:bg-zinc-800/30' : '',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'mt-1.5 h-1.5 w-1.5 shrink-0',
                          unread ? 'bg-golden' : 'bg-transparent',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm', unread ? 'font-bold' : 'font-medium', 'text-foreground')}>
                          {notification.title}
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {notification.body}
                        </span>
                        <span className="mt-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                          {NOTIFICATION_TYPE_LABELS[notification.type]} · {formatRelativeTime(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
              </ul>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
