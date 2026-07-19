import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { AttendanceRecord, StudentDisputeReason } from '@polycheck/shared'
import { useTheme } from '../theme/ThemeContext'
import { AttendanceStatusPill, CampusButton } from './CampusPrimitives'

type DetailModalProps = {
  visible: boolean
  record: AttendanceRecord | null
  subjectName: string
  onClose: () => void
  onDispute: () => void
}

const ModalHeading = ({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) => {
  const { isDark } = useTheme()
  return (
    <View className="mb-5 flex-row items-start justify-between gap-4">
      <View className="flex-1">
        <Text className="font-sans-bold text-[10px] uppercase tracking-[2px] text-maroon dark:text-golden">{eyebrow}</Text>
        <Text className="mt-1 font-heading text-2xl text-ink dark:text-white">{title}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} className="h-10 w-10 items-center justify-center rounded-none border border-line bg-zinc-100 dark:border-line-dark dark:bg-white/5">
        <MaterialIcons name="close" size={20} color={isDark ? '#FFFFFF' : '#4A0A0B'} />
      </Pressable>
    </View>
  )
}

const DetailField = ({ label, value }: { label: string; value: string }) => (
  <View className="border-b border-line py-3 dark:border-line-dark">
    <Text className="font-sans-bold text-[10px] uppercase tracking-[1.5px] text-muted dark:text-zinc-500">{label}</Text>
    <Text className="mt-1 font-sans-semibold text-sm text-ink dark:text-white">{value}</Text>
  </View>
)

export const AttendanceRecordDetailModal = ({ visible, record, subjectName, onClose, onDispute }: DetailModalProps) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View className="flex-1 justify-center bg-black/65 p-5">
      <View className="rounded-none border border-line border-t-4 border-t-golden bg-white p-5 dark:border-line-dark dark:bg-surface-dark">
        <ModalHeading eyebrow="Attendance Record" title="Record Details" onClose={onClose} />
        {record ? (
          <>
            <DetailField label="Subject" value={subjectName} />
            <DetailField label="Date" value={new Date(record.timestamp).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} />
            <DetailField label="Time" value={new Date(record.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })} />
            <View className="py-3">
              <Text className="mb-2 font-sans-bold text-[10px] uppercase tracking-[1.5px] text-muted dark:text-zinc-500">Status</Text>
              <AttendanceStatusPill status={record.status} />
            </View>
            {record.status === 'disputed' && record.notes ? <DetailField label="Dispute Note" value={record.notes} /> : null}
            <View className="mt-5 flex-row gap-3">
              <CampusButton label="Close" variant="secondary" onPress={onClose} className="flex-1" />
              <CampusButton
                label={record.status === 'disputed' ? 'Dispute Sent' : 'Report Issue'}
                icon="flag"
                disabled={record.status === 'disputed'}
                onPress={onDispute}
                className="flex-1"
              />
            </View>
          </>
        ) : null}
      </View>
    </View>
  </Modal>
)

const disputeReasons: Array<{ value: StudentDisputeReason; label: string; description: string }> = [
  { value: 'outside_geofence', label: 'Location was incorrect', description: 'You were in class but the location check failed.' },
  { value: 'expired_token', label: 'Time was incorrect', description: 'The QR code or attendance window was still valid.' },
  { value: 'duplicate_submission', label: 'I was present', description: 'Your valid check-in was treated as a duplicate.' },
  { value: 'invalid_signature', label: 'QR technical issue', description: 'The class QR code could not be verified.' },
  { value: 'device_mismatch', label: 'Account or device issue', description: 'The device check did not match your account.' },
]

type DisputeModalProps = {
  visible: boolean
  submitting: boolean
  onClose: () => void
  onSubmit: (reason: StudentDisputeReason, description: string) => void
}

export const AttendanceDisputeModal = ({ visible, submitting, onClose, onSubmit }: DisputeModalProps) => {
  const { isDark } = useTheme()
  const [reason, setReason] = useState<StudentDisputeReason | null>(null)
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!visible) return
    setReason(null)
    setDescription('')
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 justify-center bg-black/65 p-5" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="max-h-[88%] rounded-none border border-line border-t-4 border-t-golden bg-white p-5 dark:border-line-dark dark:bg-surface-dark">
          <ModalHeading eyebrow="Attendance Correction" title="Report an Issue" onClose={onClose} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text className="mb-3 font-sans-bold text-xs uppercase tracking-wider text-ink dark:text-zinc-200">What went wrong?</Text>
            <View className="gap-2">
              {disputeReasons.map((option) => {
                const selected = reason === option.value
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setReason(option.value)}
                    className={`flex-row items-center gap-3 rounded-none border p-3 ${selected ? 'border-maroon border-l-4 border-l-maroon bg-maroon/5 dark:border-golden dark:border-l-golden dark:bg-golden/10' : 'border-line dark:border-line-dark'}`}
                  >
                    <View className={`h-4 w-4 items-center justify-center rounded-none border ${selected ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-muted'}`}>
                      {selected ? <View className="h-1.5 w-1.5 bg-white dark:bg-maroon-dark" /> : null}
                    </View>
                    <View className="flex-1">
                      <Text className="font-sans-bold text-xs uppercase tracking-wider text-ink dark:text-white">{option.label}</Text>
                      <Text className="mt-0.5 font-sans text-xs leading-4 text-muted dark:text-zinc-400">{option.description}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>

            <Text className="mb-2 mt-5 font-sans-bold text-xs uppercase tracking-wider text-ink dark:text-zinc-200">Additional details</Text>
            <TextInput
              accessibilityLabel="Additional dispute details"
              className="min-h-24 rounded-none border border-line bg-zinc-50 p-4 font-sans text-xs text-ink dark:border-line-dark dark:bg-campus-dark dark:text-white"
              style={{ textAlignVertical: 'top' }}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what happened so your instructor can review it."
              placeholderTextColor={isDark ? '#777177' : '#A39B9D'}
              multiline
              maxLength={500}
            />
            <Text className="mt-1 text-right font-sans text-[10px] text-muted dark:text-zinc-500">{description.length}/500</Text>

            <View className="mt-5 flex-row gap-3">
              <CampusButton label="Cancel" variant="secondary" onPress={onClose} className="flex-1" />
              <CampusButton
                label={submitting ? 'Sending…' : 'Send Report'}
                icon="send"
                disabled={!reason || submitting}
                onPress={() => { if (reason) onSubmit(reason, description.trim()) }}
                className="flex-1"
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
