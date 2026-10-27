import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Keyboard, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import type { AiCapabilities, SuperAdmin } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useAuthGate } from '../../hooks/use-auth-gate'
import { useTheme } from '../../theme/ThemeContext'
import { pupColors } from '../../theme/colors'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusButton, CampusCard, CampusIconButton } from '../../components/CampusPrimitives'
import { CampusFormField } from '../../components/CampusFormField'
import { CampusSwitchRow } from '../../components/CampusSwitchRow'
import { useCampusToast } from '../../components/CampusToast'
import {
  SETTINGS_TABS,
  SETTING_DEFAULTS,
  TAB_SETTING_KEYS,
  areAiRoleSwitchesDisabled,
  describeAssistantStatus,
  fieldsForTab,
  isTabDirty,
  isTabSaveable,
  mergeSettingValues,
  settingIsOn,
  switchesForTab,
  type AssistantStatusTone,
  type SettingFieldDefinition,
  type SettingsTabId,
} from '../../lib/institution-settings'

const TAB_INTROS: Record<SettingsTabId, string> = {
  institution: 'Institution-wide defaults for sessions, attendance policy, and the AI assistant.',
  sessions: 'Defaults applied when faculty create new attendance sessions. Existing records are never altered.',
  accounts: 'Control what teachers can do when managing student accounts.',
  ai: 'Availability, provider configuration, and the encrypted API key for the assistant.',
}

const STATUS_TONE_CLASSES: Record<AssistantStatusTone, string> = {
  ready: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
  warning: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20',
  neutral: 'border-line bg-zinc-50 dark:border-line-dark dark:bg-white/5',
}

const STATUS_TEXT_CLASSES: Record<AssistantStatusTone, string> = {
  ready: 'text-emerald-800 dark:text-emerald-300',
  warning: 'text-amber-800 dark:text-amber-300',
  neutral: 'text-muted dark:text-zinc-300',
}

const STATUS_ICONS: Record<AssistantStatusTone, keyof typeof MaterialIcons.glyphMap> = {
  ready: 'check-circle',
  warning: 'error-outline',
  neutral: 'info-outline',
}

export default function InstitutionSettingsScreen() {
  const currentUser = useAuthGate(['super_admin'])
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const [activeTab, setActiveTab] = useState<SettingsTabId>('institution')
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...SETTING_DEFAULTS }))
  const [savedValues, setSavedValues] = useState<Record<string, string>>(() => ({ ...SETTING_DEFAULTS }))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingTab, setSavingTab] = useState<SettingsTabId | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [keySaving, setKeySaving] = useState(false)
  const [capabilities, setCapabilities] = useState<AiCapabilities | null>(null)
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true)
  const [keyMessage, setKeyMessage] = useState('')
  const scrollRef = useRef<ScrollView>(null)

  const refreshCapabilities = useCallback(async () => {
    setCapabilitiesLoading(true)
    try {
      setCapabilities(await api.getAiCapabilities())
    } catch {
      setCapabilities(null)
    } finally {
      setCapabilitiesLoading(false)
    }
  }, [])

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const merged = mergeSettingValues(await api.getSettings())
      setValues(merged)
      setSavedValues(merged)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load institution settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!currentUser) return
    setCanEdit((currentUser as SuperAdmin).scope === 'institution')
    void loadSettings()
    void refreshCapabilities()
  }, [currentUser, loadSettings, refreshCapabilities])

  const setValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const retryLoad = () => {
    void loadSettings()
    void refreshCapabilities()
  }

  const selectTab = (tab: SettingsTabId) => {
    Keyboard.dismiss()
    setActiveTab(tab)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }

  const saveSection = async (tab: SettingsTabId) => {
    if (!canEdit) return
    if (!isTabSaveable(tab, values)) {
      showToast('warning', 'Missing value', 'Complete every required setting in this section before saving.')
      return
    }

    const keys = TAB_SETTING_KEYS[tab]
    const payload = Object.fromEntries(keys.map((key) => [key, (values[key] ?? '').trim()]))
    setSavingTab(tab)
    try {
      const results = await Promise.all(keys.map((key) => api.setSetting(key, payload[key] ?? '')))
      const normalized = Object.fromEntries(results.map((result) => [result.key, result.value]))
      setValues((current) => ({ ...current, ...normalized }))
      setSavedValues((current) => ({ ...current, ...normalized }))
      const title = SETTINGS_TABS.find((item) => item.id === tab)?.label ?? tab
      showToast('success', 'Settings saved', `${title} settings have been updated.`)
      if (tab === 'ai') await refreshCapabilities()
    } catch (error) {
      showToast('error', 'Unable to save settings', error instanceof Error ? error.message : 'Try again.')
    } finally {
      setSavingTab(null)
    }
  }

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      setKeyMessage('Paste an API key first.')
      return
    }
    setKeySaving(true)
    setKeyMessage('')
    try {
      await api.setSetting('ai_api_key', apiKey.trim())
      setApiKey('')
      setKeyMessage('API key saved — stored encrypted and never shown again.')
      await refreshCapabilities()
    } catch (error) {
      setKeyMessage(error instanceof Error ? error.message : 'Unable to save the API key')
    } finally {
      setKeySaving(false)
    }
  }

  const clearApiKey = async () => {
    setKeySaving(true)
    setKeyMessage('')
    try {
      await api.setSetting('ai_api_key', '')
      setApiKey('')
      setKeyMessage('API key cleared.')
      await refreshCapabilities()
    } catch (error) {
      setKeyMessage(error instanceof Error ? error.message : 'Unable to clear the API key')
    } finally {
      setKeySaving(false)
    }
  }

  if (!currentUser) return null

  const keyConfigured = capabilities && !capabilities.policyBlocked
    ? !(capabilities.missing ?? []).includes('api_key')
    : null
  const assistantStatus = describeAssistantStatus({
    values,
    saved: savedValues,
    capabilities,
    capabilitiesLoading,
  })
  const activeTabMeta = SETTINGS_TABS.find((tab) => tab.id === activeTab) ?? SETTINGS_TABS[0]
  const activeFields = fieldsForTab(activeTab)
  const activeSwitches = switchesForTab(activeTab)
  const roleSwitchesDisabled = areAiRoleSwitchesDisabled(values)
  const activeTabSaveable = isTabSaveable(activeTab, values)
  const statusIconColor = assistantStatus.tone === 'ready'
    ? isDark ? '#34D399' : '#047857'
    : assistantStatus.tone === 'warning'
      ? isDark ? '#FCD34D' : '#B45309'
      : isDark ? pupColors.mutedLight : pupColors.muted

  const renderField = (field: SettingFieldDefinition) => (
    <CampusFormField
      key={field.key}
      label={field.label}
      hint={field.caption}
      icon={field.icon}
      keyboardType={field.keyboardType}
      placeholder={field.placeholder}
      autoCapitalize={field.key === 'institution_name' ? 'words' : 'none'}
      autoCorrect={field.key === 'institution_name'}
      value={values[field.key] ?? ''}
      editable={canEdit}
      onChangeText={(value) => setValue(field.key, value)}
      testID={`settings-field-${field.key}`}
    />
  )

  const renderSaveButton = () => (
    <CampusButton
      label={savingTab === activeTab ? 'Saving.' : activeTab === 'ai' ? 'Save AI settings' : 'Save changes'}
      icon="save"
      disabled={!canEdit || savingTab !== null || !activeTabSaveable}
      onPress={() => void saveSection(activeTab)}
      className="mt-7"
      testID={`settings-save-${activeTab}`}
    />
  )

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow="Super administrator"
        title="Institution settings"
        subtitle="Campus-wide defaults, access policy, and the AI assistant."
        onBack={() => router.back()}
        actions={<CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={pupColors.maroon} />
        </View>
      ) : loadError ? (
        <View className="flex-1 justify-center px-4">
          <CampusCard>
            <View className="mb-4 h-12 w-12 items-center justify-center bg-red-50 dark:bg-red-950/30">
              <MaterialIcons name="cloud-off" size={24} color={isDark ? '#FCA5A5' : '#B91C1C'} />
            </View>
            <Text className="font-sans-bold text-lg text-ink dark:text-white">Unable to load settings</Text>
            <Text accessibilityLiveRegion="polite" className="mt-2 font-sans text-sm leading-5 text-muted dark:text-zinc-400">
              {loadError}
            </Text>
            <CampusButton label="Try again" icon="refresh" variant="secondary" onPress={retryLoad} className="mt-5" testID="settings-retry" />
          </CampusCard>
        </View>
      ) : (
        <>
          <View className="mx-4 mt-2 flex-row rounded-2xl bg-zinc-200/70 p-1 dark:bg-white/5" accessibilityRole="tablist">
            {SETTINGS_TABS.map((tab) => {
              const active = activeTab === tab.id
              const dirty = isTabDirty(tab.id, values, savedValues)
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="tab"
                  accessibilityLabel={`${tab.accessibilityLabel}${dirty ? ', unsaved changes' : ''}`}
                  accessibilityState={{ selected: active }}
                  testID={`settings-tab-${tab.id}`}
                  onPress={() => selectTab(tab.id)}
                  className={`relative min-h-12 flex-1 items-center justify-center rounded-xl px-1 ${active ? 'bg-maroon dark:bg-golden' : ''}`}
                >
                  <Text
                    numberOfLines={1}
                    className={`font-sans-bold text-[10px] uppercase ${active ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-400'}`}
                  >
                    {tab.shortLabel}
                  </Text>
                  {dirty ? (
                    <View className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 ${active ? 'bg-golden dark:bg-maroon-dark' : 'bg-maroon dark:bg-golden'}`} />
                  ) : null}
                </Pressable>
              )
            })}
          </View>

          {!canEdit ? (
            <View className="mx-4 mt-3 flex-row items-start gap-2 border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/20">
              <MaterialIcons name="lock-outline" size={15} color={isDark ? '#FCD34D' : '#B45309'} style={{ marginTop: 2 }} />
              <Text className="flex-1 font-sans text-[11px] leading-5 text-amber-800 dark:text-amber-300">
                Department administrators have read-only access. An institution administrator must change campus-wide defaults.
              </Text>
            </View>
          ) : null}

          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 110 }}
            keyboardShouldPersistTaps="handled"
          >
            <CampusCard>
              <Text className="font-heading text-xl text-ink dark:text-white">{activeTabMeta.label}</Text>
              <Text className="mt-2 font-sans text-sm leading-5 text-muted dark:text-zinc-400">{TAB_INTROS[activeTab]}</Text>

              {activeTab !== 'ai' && activeFields.length > 0 ? (
                <View className="mt-5 gap-4">
                  {activeFields.map(renderField)}
                </View>
              ) : null}

              {activeSwitches.length > 0 ? (
                activeTab === 'ai' ? (
                  <View className="mt-5">
                    <Text className="font-sans-bold text-sm text-ink dark:text-white">Availability</Text>
                    <Text className="mt-1 font-sans text-[11px] leading-5 text-muted dark:text-zinc-400">
                      Master switch → teachers → students. Super administrators keep access while the master switch is on.
                    </Text>
                    <Text className="mb-3 mt-1 font-sans text-[11px] leading-5 text-muted dark:text-zinc-400">
                      Hide the assistant without deleting its configuration. Chat requests are rejected while an entry point is hidden.
                    </Text>
                    <View className="gap-3">
                      {activeSwitches.map((item) => {
                        const isMaster = item.key === 'ai_assistant_enabled'
                        return (
                          <CampusSwitchRow
                            key={item.key}
                            testID={`settings-switch-${item.key}`}
                            label={item.label}
                            description={item.caption}
                            value={settingIsOn(values, item.key, true)}
                            disabled={!canEdit || (!isMaster && roleSwitchesDisabled)}
                            onValueChange={(next) => setValue(item.key, next ? 'true' : 'false')}
                          />
                        )
                      })}
                    </View>
                    {roleSwitchesDisabled ? (
                      <Text className="mt-2 font-sans text-[11px] leading-5 text-muted dark:text-zinc-400">
                        Role switches keep their saved values while the master switch is off.
                      </Text>
                    ) : null}

                    <View
                      testID="settings-ai-status"
                      accessibilityLiveRegion="polite"
                      accessibilityLabel={`Assistant status: ${assistantStatus.message}`}
                      className={`mt-5 flex-row items-start gap-2 border px-3 py-2.5 ${STATUS_TONE_CLASSES[assistantStatus.tone]}`}
                    >
                      <MaterialIcons
                        name={STATUS_ICONS[assistantStatus.tone]}
                        size={16}
                        color={statusIconColor}
                        style={{ marginTop: 1 }}
                      />
                      <View className="flex-1">
                        <Text className={`font-sans-bold text-[9px] uppercase tracking-widest ${STATUS_TEXT_CLASSES[assistantStatus.tone]}`}>
                          Assistant status
                        </Text>
                        <Text className={`mt-0.5 font-sans text-xs leading-5 ${STATUS_TEXT_CLASSES[assistantStatus.tone]}`}>
                          {assistantStatus.message}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className="mt-5">
                    {activeSwitches.map((item) => (
                      <CampusSwitchRow
                        key={item.key}
                        testID={`settings-switch-${item.key}`}
                        label={item.label}
                        description={item.caption}
                        value={settingIsOn(values, item.key, false)}
                        disabled={!canEdit}
                        onValueChange={(next) => setValue(item.key, next ? 'true' : 'false')}
                      />
                    ))}
                  </View>
                )
              ) : null}

              {activeTab === 'ai' ? (
                <>
                  <View className="mt-6 gap-4 border-t border-line pt-5 dark:border-line-dark">
                    <Text className="font-sans-bold text-sm text-ink dark:text-white">Configuration</Text>
                    {fieldsForTab('ai').map(renderField)}
                  </View>

                  <View className="mt-6 gap-3 border-t border-line pt-5 dark:border-line-dark">
                    <Text className="font-sans-bold text-sm text-ink dark:text-white">API key</Text>
                    {keyConfigured !== null ? (
                      <Text className={`font-sans text-xs leading-5 ${keyConfigured ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted dark:text-zinc-400'}`}>
                        {keyConfigured ? 'A key is stored encrypted on the server.' : 'No key stored yet.'}
                      </Text>
                    ) : (
                      <Text className="font-sans text-xs leading-5 text-muted dark:text-zinc-400">
                        Key status is hidden while the assistant is disabled by policy.
                      </Text>
                    )}
                    <CampusFormField
                      label="AI API key"
                      icon="key"
                      hint="Stored encrypted on the server and never shown again. AI_API_KEY env remains a fallback."
                      value={apiKey}
                      onChangeText={setApiKey}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={canEdit && !keySaving}
                      placeholder={keyConfigured ? 'Configured — paste a new key to replace it' : 'Paste the provider API key'}
                      testID="settings-field-ai_api_key"
                    />
                    <View className="flex-row gap-3">
                      <CampusButton
                        label={keySaving ? 'Saving.' : 'Save key'}
                        icon="save"
                        onPress={() => void saveApiKey()}
                        disabled={!canEdit || keySaving}
                        className="flex-1"
                        testID="settings-save-ai-key"
                      />
                      <CampusButton
                        label="Clear"
                        icon="delete-outline"
                        variant="secondary"
                        onPress={() => void clearApiKey()}
                        disabled={!canEdit || keySaving || keyConfigured === false}
                        className="flex-1"
                        testID="settings-clear-ai-key"
                      />
                    </View>
                    {keyMessage ? (
                      <Text accessibilityLiveRegion="polite" className="font-sans text-xs leading-5 text-muted dark:text-zinc-400">
                        {keyMessage}
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : null}

              {renderSaveButton()}
              {activeTab === 'ai' ? (
                <Text className="mt-2 font-sans text-[11px] leading-4 text-muted dark:text-zinc-500">
                  The API key saves separately from availability and configuration.
                </Text>
              ) : null}
            </CampusCard>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  )
}
