import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import {
  createToast,
  dismissToast as removeToastFromQueue,
  enqueueToast,
  scheduleToastExpiry,
  type ToastItem,
  type ToastType,
} from './toast-state'

type ShowToast = (type: ToastType, title: string, message?: string) => void

interface CampusToastContextValue {
  showToast: ShowToast
  dismissToast: (id: string) => void
}

const CampusToastContext = createContext<CampusToastContextValue | null>(null)

const variantStyles: Record<ToastType, { icon: keyof typeof MaterialIcons.glyphMap; iconColor: string; iconBg: string; accent: string }> = {
  success: { icon: 'check-circle', iconColor: '#047857', iconBg: 'bg-emerald-50 dark:bg-emerald-950/40', accent: 'border-l-emerald-500' },
  error: { icon: 'error', iconColor: '#DC2626', iconBg: 'bg-red-50 dark:bg-red-950/40', accent: 'border-l-red-500' },
  info: { icon: 'info', iconColor: pupColors.maroon, iconBg: 'bg-maroon/5 dark:bg-golden/10', accent: 'border-l-maroon dark:border-l-golden' },
  warning: { icon: 'warning', iconColor: '#B45309', iconBg: 'bg-amber-50 dark:bg-amber-950/40', accent: 'border-l-amber-500' },
}

const ToastCard = ({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) => {
  const { isDark } = useTheme()
  const variant = variantStyles[toast.type]
  const iconColor = toast.type === 'info' && isDark ? pupColors.golden : variant.iconColor

  return (
    <Pressable
      testID={`campus-toast-${toast.type}`}
      accessibilityRole="alert"
      accessibilityLiveRegion={toast.type === 'error' ? 'assertive' : 'polite'}
      onPress={onDismiss}
      className={`flex-row items-start gap-3 border border-l-4 border-line bg-white p-3 dark:border-line-dark dark:bg-surface-dark ${variant.accent}`}
    >
      <View className={`mt-0.5 h-9 w-9 items-center justify-center ${variant.iconBg}`}>
        <MaterialIcons name={variant.icon} size={19} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="font-sans-bold text-sm text-ink dark:text-white">{toast.title}</Text>
        {toast.message ? <Text className="mt-1 font-sans text-xs leading-5 text-muted dark:text-zinc-400">{toast.message}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        hitSlop={8}
        onPress={onDismiss}
        className="h-9 w-9 items-center justify-center"
      >
        <MaterialIcons name="close" size={16} color={isDark ? pupColors.mutedLight : pupColors.muted} />
      </Pressable>
    </Pressable>
  )
}

/**
 * App-wide toast host. Mount once, above the navigator. Replaces
 * feedback-style Alert dialogs; destructive confirmations stay as alerts.
 */
export function CampusToastProvider({ children }: { children: ReactNode }) {
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  // Mirrors state synchronously so queue updates never depend on a render.
  const toastsRef = useRef<ToastItem[]>([])
  const timersRef = useRef(new Map<string, () => void>())

  const commit = useCallback((next: ToastItem[]) => {
    toastsRef.current = next
    setToasts(next)
  }, [])

  const clearTimer = useCallback((id: string) => {
    const cancel = timersRef.current.get(id)
    if (cancel) {
      cancel()
      timersRef.current.delete(id)
    }
  }, [])

  const dismissToast = useCallback((id: string) => {
    clearTimer(id)
    commit(removeToastFromQueue({ visible: toastsRef.current }, id).visible)
  }, [clearTimer, commit])

  const showToast = useCallback<ShowToast>((type, title, message) => {
    const toast = createToast(type, title, message)
    const { state, evicted } = enqueueToast({ visible: toastsRef.current }, toast)
    evicted.forEach((item) => clearTimer(item.id))
    commit(state.visible)
    timersRef.current.set(toast.id, scheduleToastExpiry(toast, dismissToast))
  }, [clearTimer, commit, dismissToast])

  useEffect(() => () => {
    timersRef.current.forEach((cancel) => cancel())
    timersRef.current.clear()
  }, [])

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast])

  return (
    <CampusToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.overlay, { top: insets.top + 8 }]}>
        <View pointerEvents="box-none" className={`gap-2 px-3 ${isDark ? 'dark' : ''}`}>
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
          ))}
        </View>
      </View>
    </CampusToastContext.Provider>
  )
}

export function useCampusToast(): CampusToastContextValue {
  const context = useContext(CampusToastContext)
  if (!context) throw new Error('useCampusToast must be used within CampusToastProvider')
  return context
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, zIndex: 1000, elevation: 1000 },
})
