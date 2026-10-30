import { useEffect, useState } from 'react'
import { Image, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { router, usePathname } from 'expo-router'
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  REPORT_SEVERITIES,
  REPORT_SEVERITY_LABELS,
  type CreateSystemReportInput,
  type ReportCategory,
  type ReportSeverity,
} from '@polycheck/shared'
import { api } from '../services/api-client'
import { useAuthGate } from '../hooks/use-auth-gate'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import { CampusHeader } from '../components/CampusHeader'
import { CampusButton, CampusCard } from '../components/CampusPrimitives'
import { CampusFormField } from '../components/CampusFormField'
import { useCampusToast } from '../components/CampusToast'
import { buildMobileAppVersion, buildMobileDeviceLabel, MOBILE_NETWORK_TYPE } from '../lib/report-telemetry'

const CATEGORY_HINTS: Record<ReportCategory, string> = {
  scanner_camera: 'QR camera not opening, unreadable codes, black screen.',
  geofence_gps: 'False outside-geofence, poor location accuracy, GPS timeout.',
  ui_display: 'Layout glitch, cut-off text, dark mode contrast.',
  enrollment_roster: 'Invalid section code, missing from the class list.',
  account_login: 'Session dropped, device binding / cooldown.',
  feedback_suggestion: 'Feature ideas and general feedback.',
}

const MAX_SCREENSHOT_BASE64 = 6_700_000 // ≈5 MB raw bytes

/**
 * Frictionless issue intake for students and teachers. Diagnostics
 * (device, app version, screen, install identity) are attached automatically.
 */
export default function ReportIssueScreen() {
  const user = useAuthGate(['student', 'teacher'])
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const pathname = usePathname()

  const [category, setCategory] = useState<ReportCategory>('scanner_camera')
  const [severity, setSeverity] = useState<ReportSeverity>('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [screenshot, setScreenshot] = useState<{ dataUrl: string; label: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user && (user.role !== 'student' && user.role !== 'teacher')) {
      router.replace(user.role === 'super_admin' ? '/(faculty)/system-reports' : '/(faculty)/dashboard')
    }
  }, [user])

  if (!user || (user.role !== 'student' && user.role !== 'teacher')) return null

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      })
      if (result.canceled) return
      const asset = result.assets[0]
      const base64 = asset.base64
      if (!base64) {
        showToast('warning', 'Attachment skipped', 'The selected image could not be read.')
        return
      }
      if (base64.length > MAX_SCREENSHOT_BASE64) {
        showToast('warning', 'Image too large', 'Screenshots must be 5 MB or smaller.')
        return
      }
      setScreenshot({
        dataUrl: `data:${asset.mimeType ?? 'image/jpeg'};base64,${base64}`,
        label: asset.fileName ?? 'photo.png',
      })
      showToast('success', 'Screenshot attached', 'It will be uploaded with your report.')
    } catch {
      showToast('error', 'Attachment failed', 'Try a different photo.')
    }
  }

  const submit = async () => {
    if (submitting) return
    if (title.trim().length < 5 || title.trim().length > 120) {
      showToast('warning', 'Check the title', 'Summarize the issue in 5-120 characters.')
      return
    }
    if (description.trim().length < 10) {
      showToast('warning', 'Add detail', 'Describe the issue in at least 10 characters.')
      return
    }
    setSubmitting(true)
    try {
      const input: CreateSystemReportInput = {
        category,
        severity,
        title: title.trim(),
        description: description.trim(),
        deviceInfo: buildMobileDeviceLabel(),
        appVersion: buildMobileAppVersion(),
        route: pathname ?? '(root)',
        networkType: MOBILE_NETWORK_TYPE,
        ...(screenshot ? { screenshotData: screenshot.dataUrl } : {}),
      }
      await api.createSystemReport(input)
      showToast('success', 'Report submitted', 'Track the status under Profile → My reports.')
      router.back()
    } catch (error) {
      showToast('error', 'Unable to submit', error instanceof Error ? error.message : 'Try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark" testID="report-issue-screen">
      <CampusHeader
        eyebrow="Feedback"
        title="Report an issue"
        subtitle="Bugs, GPS quirks, or ideas — super admins triage every report."
        onBack={() => router.back()}
        actions={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle color theme"
            onPress={toggle}
            className="h-10 w-10 items-center justify-center"
          >
            <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={20} color={pupColors.golden} />
          </Pressable>
        }
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-16 pt-2 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <CampusCard className="p-5">
          <Text className="font-sans-bold text-[10px] uppercase tracking-[1.5px] text-muted dark:text-zinc-500">
            Category
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2" testID="report-category-options">
            {REPORT_CATEGORIES.map((item) => {
              const selected = category === item
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setCategory(item)}
                  className={
                    selected
                      ? 'bg-maroon px-3 py-2 dark:bg-golden'
                      : 'border border-line px-3 py-2 dark:border-line-dark'
                  }
                >
                  <Text
                    className={
                      selected
                        ? 'font-sans-bold text-[11px] text-white dark:text-maroon-ink'
                        : 'font-sans-bold text-[11px] text-muted dark:text-zinc-300'
                    }
                  >
                    {REPORT_CATEGORY_LABELS[item]}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <Text className="mt-2 font-sans text-[11px] leading-4 text-muted dark:text-zinc-500">
            {CATEGORY_HINTS[category]}
          </Text>
        </CampusCard>

        <CampusCard className="p-5">
          <Text className="font-sans-bold text-[10px] uppercase tracking-[1.5px] text-muted dark:text-zinc-500">
            Severity
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2" testID="report-severity-options">
            {REPORT_SEVERITIES.map((item) => {
              const selected = severity === item
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSeverity(item)}
                  className={
                    selected
                      ? 'bg-maroon px-3 py-2 dark:bg-golden'
                      : 'border border-line px-3 py-2 dark:border-line-dark'
                  }
                >
                  <Text
                    className={
                      selected
                        ? 'font-sans-bold text-[11px] text-white dark:text-maroon-ink'
                        : 'font-sans-bold text-[11px] text-muted dark:text-zinc-300'
                    }
                  >
                    {REPORT_SEVERITY_LABELS[item]}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </CampusCard>

        <CampusCard className="p-5">
          <View className="gap-4">
            <CampusFormField
              label="Title"
              testID="report-title"
              icon="title"
              hint="5-120 characters summarizing the issue."
              value={title}
              onChangeText={setTitle}
              autoCapitalize="none"
            />
            <CampusFormField
              label="Description"
              testID="report-description"
              icon="notes"
              hint="What happened? Steps to reproduce help a lot."
              value={description}
              onChangeText={setDescription}
              multiline
              autoCapitalize="none"
            />
          </View>

          <View className="mt-4">
            <CampusButton
              label={screenshot ? 'Replace screenshot' : 'Attach screenshot (optional)'}
              icon="image"
              variant="secondary"
              onPress={() => void pickImage()}
              testID="report-attach"
            />
            {screenshot ? (
              <View className="mt-3 flex-row items-center gap-3">
                <Image
                  source={{ uri: screenshot.dataUrl }}
                  className="h-14 w-14 border border-line"
                  testID="report-attachment-preview"
                  accessibilityLabel={`Selected screenshot ${screenshot.label}`}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove screenshot"
                  onPress={() => setScreenshot(null)}
                  className="h-10 w-10 items-center justify-center border border-line dark:border-line-dark"
                >
                  <MaterialIcons name="close" size={16} color={isDark ? '#FFFFFF' : '#181113'} />
                </Pressable>
              </View>
            ) : null}
          </View>

          <Text className="mt-4 font-sans text-[10px] leading-4 text-muted dark:text-zinc-500">
            Diagnostics are attached automatically: {buildMobileDeviceLabel()} on {Platform.OS}, {buildMobileAppVersion() ?? 'unknown version'}, screen {pathname}.
          </Text>

          <CampusButton
            testID="report-submit"
            label={submitting ? 'Submitting…' : 'Submit report'}
            icon="send"
            disabled={submitting}
            onPress={() => void submit()}
            className="mt-5"
          />
        </CampusCard>
      </ScrollView>
    </SafeAreaView>
  )
}
