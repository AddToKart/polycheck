export type NotificationType =
  | 'dispute_filed'
  | 'dispute_resolved'
  | 'excuse_requested'
  | 'excuse_decided'
  | 'attendance_absent'
  | 'standing_below_threshold'
  | 'account_status_changed'
  | 'password_reset'
  | 'role_changed'
  | 'key_provisioned'
  | 'device_released'
  | 'system_report_resolved'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  /** In-app route the notification points to. */
  link?: string
  readAt?: string
  createdAt: string
}

export interface NotificationReadInput {
  ids?: string[]
  all?: boolean
}

export interface PushTokenInput {
  token: string
  platform: 'expo'
}
