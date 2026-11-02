import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Modal, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  armOutage,
  disarmOutage,
  formatOutageReceipt,
  isOutageArmed,
  subscribeToOutage,
} from '@polycheck/shared'
import { api } from '../services/api-client'
import {
  getOfflineQueueSequence,
  getPendingSyncCount,
  type OfflineQueueSequence,
} from '../services/offline-store'
import { outageRestoreOutcome } from '../lib/outage-simulator-ui'
import { CampusButton } from './CampusPrimitives'
import { useCampusToast } from './CampusToast'
import { pupColors } from '../theme/colors'

/**
 * F7 (WF-LD9) — "Drop-the-mic" outage simulator sheet.
 *
 * A demo killswitch, not a dev toy: arming flips the shared flag store so the
 * API client rejects every request with a network-shaped failure, and writes
 * flow into the existing encrypted SQLite queue. Restore disarms, drains
 * through the real `preSyncOfflineData()` pipeline, and reports the
 * reconciled count computed from pending counts before/after — never faked.
 * Visual language matches the faculty More sheet.
 */
export function OutageSimulatorSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { showToast } = useCampusToast()
  const insets = useSafeAreaInsets()
  const [armed, setArmed] = useState(() => isOutageArmed())
  const [sequence, setSequence] = useState<OfflineQueueSequence>({ count: 0, lastId: null })
  const [restoring, setRestoring] = useState(false)
  const slideAnim = useRef(new Animated.Value(320)).current
  // Static until the OS answer arrives so reduce-motion users never see motion.
  const [reduceMotion, setReduceMotion] = useState(true)

  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion) }, [])

  useEffect(() => {
    if (visible) {
      if (reduceMotion) slideAnim.setValue(0)
      else Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }).start()
    } else {
      Animated.timing(slideAnim, { toValue: 320, duration: reduceMotion ? 0 : 200, useNativeDriver: true }).start()
    }
  }, [reduceMotion, slideAnim, visible])

  // Seed from the flag store and follow arm/disarm transitions — the state is
  // shared with the floating pill and the More-sheet entry point.
  useEffect(() => {
    setArmed(isOutageArmed())
    return subscribeToOutage(setArmed)
  }, [])

  const refreshSequence = useCallback(() => {
    void getOfflineQueueSequence().then(setSequence).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!visible) return
    refreshSequence()
    const timer = setInterval(refreshSequence, 2_000)
    return () => clearInterval(timer)
  }, [visible, armed, refreshSequence])

  const toggleArmed = () => {
    if (restoring) return
    if (armed) {
      disarmOutage()
      refreshSequence()
    } else {
      armOutage()
    }
  }

  const restoreAndReplay = async () => {
    if (restoring || !armed) return
    setRestoring(true)
    try {
      const before = await getPendingSyncCount()
      disarmOutage()
      // The existing pipeline: /health clock offset → queue drain → cache refresh.
      await api.preSyncOfflineData()
      const after = await getPendingSyncCount()
      refreshSequence()
      const outcome = outageRestoreOutcome(before, after)
      if (outcome.kind === 'reconciled') showToast('success', 'Back online', outcome.message)
      else if (outcome.kind === 'still-pending') showToast('warning', 'Queue not drained', outcome.message)
      else showToast('info', 'Nothing to replay', outcome.message)
    } catch {
      showToast('error', 'Restore failed', 'The queue is still saved on this device — try again.')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50" onPress={onClose}>
        <View className="flex-1" />
        <Animated.View
          testID="outage-simulator-sheet"
          className="rounded-t-[36px] border-t-2 border-golden/60 bg-white px-5 pt-4 shadow-2xl dark:border-golden/25 dark:bg-surface-dark"
          style={{ transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 24 }}
          onStartShouldSetResponder={() => true}
        >
          <View className="items-center pb-3 pt-1">
            <View className="h-1.5 w-14 self-center rounded-full bg-maroon/30 dark:bg-golden/40" />
          </View>
          <View className="mb-4 flex-row items-start gap-4">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-golden">
              <MaterialIcons name="bolt" size={23} color={pupColors.maroonDark} />
            </View>
            <View className="flex-1">
              <Text className="font-heading text-2xl text-ink dark:text-white">Outage simulator</Text>
              <Text className="mt-1 font-sans text-xs leading-5 text-muted dark:text-zinc-400">
                Demo killswitch: cut the network and prove attendance keeps working offline.
              </Text>
            </View>
          </View>

          {armed ? (
            <View
              testID="outage-armed-banner"
              accessibilityLiveRegion="polite"
              className="mb-3 gap-1 rounded-2xl border border-amber-500 bg-amber-50 px-4 py-3 dark:bg-amber-950/30"
            >
              <Text className="font-sans-bold text-[11px] uppercase tracking-widest text-amber-700 dark:text-amber-300">
                Offline mode — local encrypted queue
              </Text>
              <Text className="font-sans text-[11px] leading-4 text-ink dark:text-zinc-200">
                Every request is rejected before the network. Scans, QR activations and edits are saved to the encrypted on-device queue.
              </Text>
            </View>
          ) : null}

          {sequence.count > 0 ? (
            <View
              testID="outage-receipt-chip"
              className="mb-3 flex-row items-center gap-2 self-start rounded-2xl border border-golden bg-maroon px-4 py-2 dark:bg-maroon-deep"
            >
              <MaterialIcons name="receipt-long" size={15} color={pupColors.golden} />
              <Text className="font-sans-bold text-xs text-golden">
                {formatOutageReceipt(sequence.count, sequence.lastId)}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: armed }}
            accessibilityLabel="Simulate campus outage"
            disabled={restoring}
            onPress={toggleArmed}
            className="mb-3 min-h-12 flex-row items-center justify-between rounded-2xl border border-zinc-300 px-4 dark:border-zinc-700"
          >
            <Text className="font-sans-bold text-xs text-ink dark:text-zinc-200">Simulate campus outage</Text>
            <View className={`h-6 w-11 justify-center rounded-full px-0.5 ${armed ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
              <View className={`h-5 w-5 rounded-full bg-white ${armed ? 'self-end' : 'self-start'}`} />
            </View>
          </Pressable>

          {armed ? (
            <CampusButton
              testID="outage-restore"
              label={restoring ? 'Syncing…' : 'Restore & replay'}
              icon="cloud-upload"
              disabled={restoring}
              onPress={() => { void restoreAndReplay() }}
            />
          ) : (
            <Text className="font-sans text-[11px] leading-4 text-muted dark:text-zinc-500">
              Arm the switch, run a scan, then restore to watch the encrypted queue drain through the real sync engine.
            </Text>
          )}
          <Text className="mt-3 font-sans text-[10px] leading-4 text-muted dark:text-zinc-500">
            The sync engine is untouched — receipts, retries and reconciliation are the production pipeline.
          </Text>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}
