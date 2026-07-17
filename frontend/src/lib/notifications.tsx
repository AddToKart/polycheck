'use client'
import React, { createContext, useContext, useState, useCallback } from 'react'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
  timestamp: Date
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (type: Notification['type'], title: string, message: string) => void
  dismissNotification: (id: string) => void
  unreadCount: number
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  addNotification: () => {},
  dismissNotification: () => {},
  unreadCount: 0,
})

export function useNotifications() {
  return useContext(NotificationContext)
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((type: Notification['type'], title: string, message: string) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    setNotifications((prev) => [{ id, type, title, message, timestamp: new Date() }, ...prev])
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, 6000)
  }, [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const unreadCount = notifications.length

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, dismissNotification, unreadCount }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm" role="region" aria-label="Notifications">
        {notifications.map((n) => {
          const colors = {
            success: 'bg-green-50 border-l-green-500 text-green-800 dark:bg-green-950/30 dark:border-l-green-400 dark:text-green-300',
            error: 'bg-red-50 border-l-red-500 text-red-800 dark:bg-red-950/30 dark:border-l-red-400 dark:text-red-300',
            info: 'bg-blue-50 border-l-blue-500 text-blue-800 dark:bg-blue-950/30 dark:border-l-blue-400 dark:text-blue-300',
            warning: 'bg-amber-50 border-l-amber-500 text-amber-800 dark:bg-amber-950/30 dark:border-l-amber-400 dark:text-amber-300',
          }
          const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ',
            warning: '⚠',
          }
          return (
            <div key={n.id} className={`border-l-4 p-4 shadow-lg animate-in slide-in-from-right ${colors[n.type]}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{icons[n.type]}</span>
                  <p className="font-bold text-sm">{n.title}</p>
                </div>
                <button onClick={() => dismissNotification(n.id)} className="text-current opacity-50 hover:opacity-100 text-sm font-bold">&times;</button>
              </div>
              <p className="text-xs mt-1 opacity-80">{n.message}</p>
            </div>
          )
        })}
      </div>
    </NotificationContext.Provider>
  )
}
