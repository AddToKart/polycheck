/** Application event emitted after a notification row is persisted. */
export const NOTIFICATION_CREATED_EVENT = 'notification.created'

/** Socket.IO event pushed to the recipient's per-user room. */
export const USER_NOTIFICATION_EVENT = 'notifications:new'

/** Injection token for the Expo push HTTP client (mockable in tests). */
export const EXPO_PUSH_FETCH = 'EXPO_PUSH_FETCH'

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
