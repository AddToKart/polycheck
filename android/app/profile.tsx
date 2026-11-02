import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { cooldownRemainingMinutes, formatCooldownRemaining } from '@polycheck/shared/utils'
import { REPORT_CATEGORY_LABELS, REPORT_STATUS_LABELS, type SystemReport } from '@polycheck/shared'
import { api } from '../services/api-client'
import { useAuthGate } from '../hooks/use-auth-gate'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import { CampusHeader } from '../components/CampusHeader'
import {
  CampusButton,
  CampusCard,
  CampusIconButton,
  SectionHeading,
} from '../components/CampusPrimitives'
import { CampusFormField } from '../components/CampusFormField'
import { useCampusToast } from '../components/CampusToast'

const MIN_PASSWORD_LENGTH = 12

const roleLabel = (role: string) =>
  role === 'super_admin' ? 'Super Admin' : role === 'teacher' ? 'Teacher' : 'Student'

/**
 * Universal profile screen for all roles: read-only institutional identity,
 * self-service password change, secondary contacts, and (students only) the
 * bound mobile device + cooldown controls.
 */
export default function ProfileScreen() {
  const user = useAuthGate(['student', 'teacher', 'super_admin'])
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()

  const [current, setCurrent] = useState(user)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [contactEmail, setContactEmail] = useState(user?.contactEmail ?? '')
  const [contactPhone, setContactPhone] = useState(user?.contactPhone ?? '')
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingContacts, setSavingContacts] = useState(false)
  const [cooldownNow, setCooldownNow] = useState(() => Date.now())
  const [myReports, setMyReports] = useState<SystemReport[]>([])

  const cooldownMinutes = cooldownRemainingMinutes(current?.deviceCooldownUntil ?? null, cooldownNow)

  useEffect(() => {
    if (cooldownMinutes === null) return
    const timer = setInterval(() => setCooldownNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [cooldownMinutes])

  useEffect(() => {
    if (!current || (current.role !== 'student' && current.role !== 'teacher')) return
    let active = true
    api
      .getMySystemReports()
      .then((rows) => {
        if (active) setMyReports(rows)
      })
      .catch(() => {
        /* Best-effort: the section falls back to its empty state. */
      })
    return () => {
      active = false
    }
  }, [current])

  const identity = useMemo(() => {
    if (!current) return []
    const rows: { label: string; value: string }[] = [
      { label: 'PUP ID / Student number', value: current.studentId ?? '—' },
      { label: 'Role', value: roleLabel(current.role) },
      { label: 'Department', value: current.department ?? '—' },
      { label: 'PUP email', value: current.email ?? '—' },
    ]
    if (current.role === 'student') {
      rows.push({ label: 'Program', value: current.program ?? '—' })
      rows.push({ label: 'Year level', value: current.yearLevel ? String(current.yearLevel) : '—' })
    }
    return rows
  }, [current])

  if (!current) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-campus dark:bg-campus-dark">
        <ActivityIndicator size="large" color={isDark ? pupColors.golden : pupColors.maroon} />
      </SafeAreaView>
    )
  }

  const submitPassword = async () => {
    if (savingPassword) return
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      showToast('warning', 'Password too short', `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('warning', 'Passwords do not match', 'Re-enter the same new password in both fields.')
      return
    }
    if (!currentPassword) {
      showToast('warning', 'Current password required', 'Enter your current password to rotate it.')
      return
    }
    setSavingPassword(true)
    try {
      const updated = await api.changePassword(currentPassword, newPassword)
      setCurrent(updated)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showToast('success', 'Password changed', 'Other signed-in devices were signed out.')
    } catch (error) {
      showToast('error', 'Unable to change password', error instanceof Error ? error.message : 'Try again.')
    } finally {
      setSavingPassword(false)
    }
  }

  const submitContacts = async () => {
    if (savingContacts) return
    setSavingContacts(true)
    try {
      const updated = await api.updateContacts({
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
      })
      setCurrent(updated)
      showToast('success', 'Contacts updated', 'Your secondary contact details were saved.')
    } catch (error) {
      showToast('error', 'Unable to save contacts', error instanceof Error ? error.message : 'Try again.')
    } finally {
      setSavingContacts(false)
    }
  }

  const confirmUnregister = () => {
    Alert.alert(
      'Unregister this device?',
      'Unregistering will lock your account from logging into another device for the cooldown window (default 2 hours). Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unregister',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const result = await api.unregisterDevice(current.boundDeviceId ?? '')
                showToast('success', 'Device unregistered', result.message)
                await api.logout()
                router.replace('/')
              } catch (error) {
                showToast('error', 'Unable to unregister', error instanceof Error ? error.message : 'Try again.')
              }
            })()
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark" testID="profile-screen">
      <CampusHeader
        eyebrow="Account"
        title="My Profile"
        subtitle="Institutional identity, security, and device status."
        onBack={() => router.back()}
        actions={
          <CampusIconButton
            icon={isDark ? 'light-mode' : 'dark-mode'}
            label="Toggle color theme"
            onPress={toggle}
            inverse
          />
        }
      />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-16 pt-2">
        <CampusCard className="p-5">
          <View className="flex-row items-center gap-3">
            <View className="h-14 w-14 items-center justify-center bg-maroon">
              <Text className="font-heading text-xl font-bold text-golden">
                {current.fullName
                  .split(' ')
                  .map((part) => part.charAt(0))
                  .slice(0, 2)
                  .join('')}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="font-heading text-xl text-ink dark:text-white">{current.fullName}</Text>
              <Text className="mt-0.5 font-sans text-xs text-muted dark:text-zinc-400">
                {roleLabel(current.role)}
                {current.department ? ` · ${current.department}` : ''}
              </Text>
            </View>
          </View>

          <View className="mt-5 gap-3 border-t border-line pt-4 dark:border-line-dark">
            {identity.map((row) => (
              <View key={row.label} className="flex-row items-start justify-between gap-4">
                <Text className="flex-1 font-sans text-[10px] uppercase tracking-[1.5px] text-muted dark:text-zinc-500">
                  {row.label}
                </Text>
                <Text className="flex-1 text-right font-sans-medium text-sm text-ink dark:text-white">
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
          <Text className="mt-4 font-sans text-[10px] leading-4 text-muted dark:text-zinc-500">
            Institutional identity fields are read-only. Contact the registrar or an administrator to correct them.
          </Text>
        </CampusCard>

        <SectionHeading title="Password & security" eyebrow="Credentials" />
        <CampusCard className="p-5">
          <View className="gap-4">
            <CampusFormField
              label="Current password"
              testID="profile-current-password"
              icon="lock"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
            />
            <CampusFormField
              label="New password"
              testID="profile-new-password"
              icon="lock-reset"
              hint={`At least ${MIN_PASSWORD_LENGTH} characters with uppercase, lowercase, a number, and a symbol.`}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <CampusFormField
              label="Confirm new password"
              testID="profile-confirm-password"
              icon="lock-outline"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              onSubmitEditing={() => void submitPassword()}
            />
          </View>
          <CampusButton
            testID="profile-save-password"
            label={savingPassword ? 'Saving…' : 'Change password'}
            icon="check"
            disabled={savingPassword}
            onPress={() => void submitPassword()}
            className="mt-5"
          />
          <Text className="mt-3 font-sans text-[10px] leading-4 text-muted dark:text-zinc-500">
            Changing your password signs out every other device; this session stays signed in.
          </Text>
        </CampusCard>

        <SectionHeading title="Contact information" eyebrow="Reachability" />
        <CampusCard className="p-5">
          <View className="gap-4">
            <CampusFormField
              label="Personal email"
              testID="profile-contact-email"
              icon="mail"
              value={contactEmail}
              onChangeText={setContactEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <CampusFormField
              label="Emergency mobile number"
              testID="profile-contact-phone"
              icon="phone"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
            />
          </View>
          <CampusButton
            testID="profile-save-contacts"
            label={savingContacts ? 'Saving…' : 'Save contacts'}
            icon="save"
            variant="secondary"
            disabled={savingContacts}
            onPress={() => void submitContacts()}
            className="mt-5"
          />
        </CampusCard>

        {current.role === 'student' ? (
          <>
            <SectionHeading title="Device & anti-cheat" eyebrow="Mobile binding" />
            <CampusCard className="p-5">
              <Text className="font-sans-bold text-[10px] uppercase tracking-[1.5px] text-muted dark:text-zinc-500">
                Bound mobile device
              </Text>
              {current.boundDeviceId ? (
                <>
                  <Text className="mt-1 font-mono text-sm text-ink dark:text-white">
                    Android device · …{current.boundDeviceId.slice(-6)}
                  </Text>
                  <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">
                    Bound{' '}
                    {current.deviceBoundAt
                      ? new Date(current.deviceBoundAt).toLocaleString('en-PH')
                      : 'recently'}
                  </Text>
                </>
              ) : (
                <Text className="mt-1 font-sans text-sm text-muted dark:text-zinc-300">
                  No device is bound. Sign in on the Polycheck Android app to bind this account to a device.
                </Text>
              )}
              {cooldownMinutes !== null ? (
                <View className="mt-3 self-start border border-amber-400 bg-amber-50 px-3 py-1 dark:bg-amber-950">
                  <Text className="font-sans-bold text-[10px] text-amber-800 dark:text-amber-300">
                    Mobile sign-ins locked · {formatCooldownRemaining(cooldownMinutes)} left
                  </Text>
                </View>
              ) : null}

              <Text className="mt-4 font-sans text-xs leading-5 text-muted dark:text-zinc-400">
                Unregister when switching to a new phone. Mobile sessions end immediately and new sign-ins stay
                locked for the institution cooldown window. Your instructor can release you sooner.
              </Text>
              <CampusButton
                testID="profile-unregister-device"
                label="Unregister this device"
                icon="phonelink-erase"
                variant="secondary"
                onPress={confirmUnregister}
                className="mt-4"
              />
            </CampusCard>
          </>
        ) : null}

        {(current.role === 'student' || current.role === 'teacher') ? (
          <>
            <SectionHeading title="Feedback & reports" eyebrow="Help improve Polycheck" />
            <CampusCard className="p-5">
              <Text className="font-sans text-xs leading-5 text-muted dark:text-zinc-400">
                Bug, GPS quirk, or idea? Report it and follow the status here. Super admins triage every submission.
              </Text>
              <CampusButton
                testID="profile-report-issue"
                label="Report an issue"
                icon="flag"
                onPress={() => router.push('/report-issue')}
                className="mt-4"
              />
              <View className="mt-5 gap-3" testID="profile-my-reports">
                {myReports.map((report) => (
                  <View key={report.id} className="border border-line p-3 dark:border-line-dark">
                    <View className="flex-row items-center gap-2">
                      <View className="rounded-full bg-maroon px-2 py-0.5 dark:bg-golden">
                        <Text className="font-sans-bold text-[8px] uppercase tracking-widest text-white dark:text-maroon-ink">
                          {REPORT_STATUS_LABELS[report.status]}
                        </Text>
                      </View>
                      <Text className="font-sans-bold text-[8px] uppercase tracking-widest text-muted dark:text-zinc-500">
                        {REPORT_CATEGORY_LABELS[report.category]}
                      </Text>
                      <Text className="flex-1 text-right font-sans text-[9px] text-muted dark:text-zinc-500">
                        {new Date(report.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    <Text className="mt-1.5 font-sans-bold text-xs text-ink dark:text-white" numberOfLines={1}>
                      {report.title}
                    </Text>
                    {report.adminNotes ? (
                      <Text className="mt-1 font-sans text-[10px] leading-4 text-muted dark:text-zinc-400" numberOfLines={2}>
                        Admin: {report.adminNotes}
                      </Text>
                    ) : null}
                  </View>
                ))}
                {myReports.length === 0 ? (
                  <Text className="font-sans text-[10px] text-muted dark:text-zinc-500">
                    No reports yet — the first one starts the conversation.
                  </Text>
                ) : null}
              </View>
            </CampusCard>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}
