'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { AiCapabilities, SuperAdmin } from '@polycheck/shared'
import { KeyRound, Save, Settings, Sparkles, Trash2 } from 'lucide-react'
import { Sidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { SettingSwitch } from './SettingSwitch'
import {
  SETTINGS_TABS,
  SETTING_FIELDS,
  SETTING_DEFAULTS,
  SETTING_SWITCHES,
  TAB_SETTING_KEYS,
  describeAssistantStatus,
  isTabDirty,
  isTabSaveable,
  mergeSettingValues,
  resolveSettingsTab,
  type AssistantStatusTone,
  type SettingFieldDefinition,
  type SettingsTabId,
} from './settings-config'

interface TabFeedback {
  tone: 'success' | 'error'
  message: string
}

const SAVE_SUCCESS: Record<SettingsTabId, string> = {
  institution: 'Institution settings saved.',
  sessions: 'Session and attendance defaults saved.',
  accounts: 'Account access settings saved.',
  ai: 'AI assistant settings saved.',
}

const STATUS_TONE_CLASSES: Record<AssistantStatusTone, string> = {
  ready:
    'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  warning:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
  neutral:
    'border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

function settingByKey(key: string) {
  return SETTING_SWITCHES.find((item) => item.key === key)
}

function SettingFieldRow({
  field,
  value,
  disabled,
  onChange,
}: {
  field: SettingFieldDefinition
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.key}>{field.label}</Label>
      <Input
        id={field.key}
        type={field.type}
        inputMode={field.type === 'number' ? 'numeric' : undefined}
        min={field.min}
        max={field.max}
        step={field.type === 'number' ? 1 : undefined}
        placeholder={field.placeholder}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{field.caption}</p>
    </div>
  )
}

function InstitutionSettingsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const tabFromUrl = resolveSettingsTab(searchParams.get('tab'))
  const [activeTab, setActiveTab] = useState<SettingsTabId>(tabFromUrl)
  const [user, setUser] = useState<SuperAdmin | null>(null)
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...SETTING_DEFAULTS }))
  const [saved, setSaved] = useState<Record<string, string>>(() => ({ ...SETTING_DEFAULTS }))
  const [loading, setLoading] = useState(true)
  const [savingTab, setSavingTab] = useState<SettingsTabId | null>(null)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState<Partial<Record<SettingsTabId, TabFeedback>>>({})
  const [apiKey, setApiKey] = useState('')
  const [keySaving, setKeySaving] = useState(false)
  const [keyFeedback, setKeyFeedback] = useState('')
  const [capabilities, setCapabilities] = useState<AiCapabilities | null>(null)
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    setActiveTab(tabFromUrl)
  }, [tabFromUrl])

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

  useEffect(() => {
    const current = api.getCurrentUser()
    if (!current || current.role !== 'super_admin') {
      router.replace('/faculty')
      return
    }
    setUser(current as SuperAdmin)
    void api
      .getSettings()
      .then((settings) => {
        const merged = mergeSettingValues(settings)
        setValues(merged)
        setSaved(merged)
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : 'Unable to load settings')
      })
      .finally(() => setLoading(false))
    void refreshCapabilities()
  }, [refreshCapabilities, router])

  const selectTab = useCallback(
    (tab: SettingsTabId) => {
      setActiveTab(tab)
      router.replace(`/faculty/settings?tab=${tab}`, { scroll: false })
    },
    [router],
  )

  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const index = SETTINGS_TABS.findIndex((tab) => tab.id === activeTab)
      let next = -1
      if (event.key === 'ArrowRight') next = (index + 1) % SETTINGS_TABS.length
      else if (event.key === 'ArrowLeft')
        next = (index - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = SETTINGS_TABS.length - 1
      if (next === -1) return
      event.preventDefault()
      selectTab(SETTINGS_TABS[next].id)
      tabRefs.current[next]?.focus()
    },
    [activeTab, selectTab],
  )

  const updateValue = useCallback(
    (key: string, value: string) => {
      setValues((current) => ({ ...current, [key]: value }))
      setFeedback((current) => {
        if (!current[activeTab]) return current
        const next = { ...current }
        delete next[activeTab]
        return next
      })
    },
    [activeTab],
  )

  const updateSwitch = useCallback(
    (key: string, checked: boolean) => {
      updateValue(key, checked ? 'true' : 'false')
    },
    [updateValue],
  )

  const handleSave = async () => {
    if (!user) return
    const tab = activeTab
    const keys = TAB_SETTING_KEYS[tab]
    setSavingTab(tab)
    setFeedback((current) => {
      if (!current[tab]) return current
      const next = { ...current }
      delete next[tab]
      return next
    })

    try {
      const results = await Promise.all(
        keys.map((key) => api.setSetting(key, (values[key] ?? '').trim())),
      )
      const normalized = Object.fromEntries(results.map((result) => [result.key, result.value]))
      setValues((current) => ({ ...current, ...normalized }))
      setSaved((current) => ({ ...current, ...normalized }))
      setFeedback((current) => ({
        ...current,
        [tab]: { tone: 'success', message: SAVE_SUCCESS[tab] },
      }))
      if (tab === 'ai') await refreshCapabilities()
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        [tab]: {
          tone: 'error',
          message: error instanceof Error ? error.message : 'Unable to save settings',
        },
      }))
    } finally {
      setSavingTab(null)
    }
  }

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      setKeyFeedback('Paste an API key first.')
      return
    }
    setKeySaving(true)
    setKeyFeedback('')
    try {
      await api.setSetting('ai_api_key', apiKey.trim())
      setApiKey('')
      setKeyFeedback('API key saved — stored encrypted and never shown again.')
      await refreshCapabilities()
    } catch (error) {
      setKeyFeedback(error instanceof Error ? error.message : 'Unable to save the API key')
    } finally {
      setKeySaving(false)
    }
  }

  const handleClearKey = async () => {
    setKeySaving(true)
    setKeyFeedback('')
    try {
      await api.setSetting('ai_api_key', '')
      setApiKey('')
      setKeyFeedback('API key cleared.')
      await refreshCapabilities()
    } catch (error) {
      setKeyFeedback(error instanceof Error ? error.message : 'Unable to clear the API key')
    } finally {
      setKeySaving(false)
    }
  }

  if (!user) return null

  const canEdit = user.scope === 'institution'
  const tabDirty = isTabDirty(activeTab, values, saved)
  const tabFeedback = feedback[activeTab]
  const status = describeAssistantStatus({
    values,
    saved,
    capabilities,
    capabilitiesLoading,
  })
  const masterEnabled = values.ai_assistant_enabled !== 'false'
  const missing = capabilities?.missing ?? []
  const keyConfigured =
    capabilities && !capabilities.policyBlocked ? !missing.includes('api_key') : null

  const masterSwitch = settingByKey('ai_assistant_enabled')
  const teacherSwitch = settingByKey('ai_assistant_teacher_enabled')
  const studentSwitch = settingByKey('ai_assistant_student_enabled')
  const accountsSwitches = SETTING_SWITCHES.filter((item) => item.tab === 'accounts')
  const accountsFields = SETTING_FIELDS.filter((field) => field.tab === 'accounts')

  const aiFields = SETTING_FIELDS.filter((field) => field.tab === 'ai')
  const institutionField = SETTING_FIELDS.find((field) => field.key === 'institution_name')

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar
        user={user}
        onLogout={() => {
          void api.logout()
          router.push('/')
        }}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-3xl mx-auto">
          <div className="mb-8 flex items-center gap-3">
            <Settings className="h-7 w-7 text-maroon dark:text-golden" />
            <div>
              <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white">
                Institution Settings
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Institution-wide defaults for sessions, attendance policy, accounts, and the AI
                assistant.
              </p>
              {!canEdit && (
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                  Department administrators can view these institution-wide defaults but only an
                  institution administrator can change them.
                </p>
              )}
            </div>
          </div>

          {loadError ? (
            <p
              role="alert"
              className="mb-4 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
            >
              {loadError}
            </p>
          ) : null}

          <div
            role="tablist"
            aria-label="Institution settings categories"
            onKeyDown={handleTabKeyDown}
            className="mb-6 flex flex-wrap gap-2"
          >
            {SETTINGS_TABS.map((tab, index) => {
              const selected = tab.id === activeTab
              const dirty = isTabDirty(tab.id, values, saved)
              return (
                <button
                  key={tab.id}
                  ref={(node) => {
                    tabRefs.current[index] = node
                  }}
                  id={`settings-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={selected ? `settings-panel-${tab.id}` : undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectTab(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-2 border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-golden focus-visible:ring-offset-2',
                    selected
                      ? 'border-maroon bg-maroon text-white shadow-sm dark:border-golden dark:bg-golden dark:text-maroon-dark'
                      : 'border-zinc-300 bg-white text-zinc-600 hover:border-maroon hover:text-maroon dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-golden dark:hover:text-golden',
                  )}
                >
                  {tab.label}
                  {dirty ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        selected ? 'bg-golden dark:bg-maroon-dark' : 'bg-maroon dark:bg-golden',
                      )}
                    />
                  ) : null}
                  {dirty ? <span className="sr-only">Unsaved changes</span> : null}
                </button>
              )
            })}
          </div>

          <Card>
            <CardContent className="p-6">
              <div
                id={`settings-panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`settings-tab-${activeTab}`}
                className="space-y-6"
              >
                {activeTab === 'institution' && institutionField ? (
                  <SettingFieldRow
                    field={institutionField}
                    value={values.institution_name}
                    disabled={!canEdit || loading}
                    onChange={(value) => updateValue('institution_name', value)}
                  />
                ) : null}

                {activeTab === 'sessions' ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {SETTING_FIELDS.filter((field) => field.tab === 'sessions').map((field) => (
                      <SettingFieldRow
                        key={field.key}
                        field={field}
                        value={values[field.key] ?? ''}
                        disabled={!canEdit || loading}
                        onChange={(value) => updateValue(field.key, value)}
                      />
                    ))}
                  </div>
                ) : null}

                {activeTab === 'accounts' ? (
                  <div className="space-y-6">
                    {accountsSwitches.map((item) => (
                      <SettingSwitch
                        key={item.key}
                        id={item.key}
                        label={item.label}
                        caption={item.caption}
                        checked={values[item.key] === 'true'}
                        disabled={!canEdit || loading}
                        onCheckedChange={(checked) => updateSwitch(item.key, checked)}
                      />
                    ))}
                    {accountsFields.length > 0 ? (
                      <div className="grid gap-6 sm:grid-cols-2">
                        {accountsFields.map((field) => (
                          <SettingFieldRow
                            key={field.key}
                            field={field}
                            value={values[field.key] ?? ''}
                            disabled={!canEdit || loading}
                            onChange={(value) => updateValue(field.key, value)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {activeTab === 'ai' ? (
                  <div className="space-y-6">
                    <section className="space-y-4">
                      <div>
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-maroon dark:text-golden">
                          Availability
                        </h2>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Hide the assistant without deleting its configuration. Hidden roles
                          cannot open the assistant.
                        </p>
                      </div>

                      {masterSwitch ? (
                        <SettingSwitch
                          id={masterSwitch.key}
                          label={masterSwitch.label}
                          caption={masterSwitch.caption}
                          checked={masterEnabled}
                          disabled={!canEdit || loading}
                          onCheckedChange={(checked) => updateSwitch(masterSwitch.key, checked)}
                        />
                      ) : null}

                      <div
                        className={cn(
                          'space-y-5 border-l-2 pl-4',
                          masterEnabled
                            ? 'border-golden/70'
                            : 'border-zinc-200 dark:border-zinc-800',
                        )}
                      >
                        {teacherSwitch ? (
                          <SettingSwitch
                            id={teacherSwitch.key}
                            label={teacherSwitch.label}
                            caption={teacherSwitch.caption}
                            checked={values[teacherSwitch.key] !== 'false'}
                            disabled={!canEdit || loading || !masterEnabled}
                            onCheckedChange={(checked) => updateSwitch(teacherSwitch.key, checked)}
                          />
                        ) : null}
                        {studentSwitch ? (
                          <SettingSwitch
                            id={studentSwitch.key}
                            label={studentSwitch.label}
                            caption={studentSwitch.caption}
                            checked={values[studentSwitch.key] !== 'false'}
                            disabled={!canEdit || loading || !masterEnabled}
                            onCheckedChange={(checked) => updateSwitch(studentSwitch.key, checked)}
                          />
                        ) : null}
                      </div>

                      {!masterEnabled ? (
                        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          Role switches keep their saved values while the master switch is off.
                        </p>
                      ) : null}
                    </section>

                    <div
                      role="status"
                      className={cn(
                        'border px-4 py-3 text-sm',
                        STATUS_TONE_CLASSES[status.tone],
                      )}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        Assistant status
                      </span>
                      <p className="mt-1 leading-relaxed">{status.message}</p>
                    </div>

                    <section className="space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                      <div>
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-maroon dark:text-golden">
                          Configuration
                        </h2>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Provider endpoint and credentials. Only super admins can reach the
                          assistant until every required piece is configured.
                        </p>
                      </div>

                      {aiFields.map((field) => (
                        <SettingFieldRow
                          key={field.key}
                          field={field}
                          value={values[field.key] ?? ''}
                          disabled={!canEdit || loading}
                          onChange={(value) => updateValue(field.key, value)}
                        />
                      ))}

                      <div className="space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <Sparkles
                            className="h-4 w-4 text-maroon dark:text-golden"
                            aria-hidden="true"
                          />
                          <Label htmlFor="ai_api_key">AI API key</Label>
                        </div>
                        {keyConfigured !== null ? (
                          <p
                            className={cn(
                              'text-xs',
                              keyConfigured
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : 'text-zinc-500 dark:text-zinc-400',
                            )}
                          >
                            {keyConfigured
                              ? 'A key is stored encrypted on the server.'
                              : 'No key stored yet.'}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Key status is hidden while the assistant is disabled by policy.
                          </p>
                        )}
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            id="ai_api_key"
                            type="password"
                            autoComplete="new-password"
                            spellCheck={false}
                            disabled={!canEdit || loading || keySaving}
                            value={apiKey}
                            onChange={(event) => setApiKey(event.target.value)}
                            placeholder={
                              keyConfigured
                                ? 'Configured — paste a new key to replace it'
                                : 'Paste the provider API key'
                            }
                          />
                          <Button
                            type="button"
                            onClick={() => void handleSaveKey()}
                            disabled={!canEdit || loading || keySaving}
                            className="shrink-0"
                          >
                            <KeyRound className="h-4 w-4" />
                            {keySaving ? 'Saving…' : 'Save key'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleClearKey()}
                            disabled={!canEdit || loading || keySaving || keyConfigured === false}
                            className="shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                            Clear
                          </Button>
                        </div>
                        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          Stored encrypted on the server and never shown again. Environment{' '}
                          <code>AI_API_KEY</code> remains supported as a fallback.
                        </p>
                        {keyFeedback ? (
                          <p
                            role="status"
                            className="text-sm text-zinc-600 dark:text-zinc-300"
                          >
                            {keyFeedback}
                          </p>
                        ) : null}
                      </div>
                    </section>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-h-5">
                    {tabFeedback ? (
                      <p
                        role={tabFeedback.tone === 'error' ? 'alert' : 'status'}
                        className={cn(
                          'text-sm',
                          tabFeedback.tone === 'error'
                            ? 'text-red-700 dark:text-red-300'
                            : 'text-emerald-700 dark:text-emerald-300',
                        )}
                      >
                        {tabFeedback.message}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={
                      !canEdit ||
                      loading ||
                      Boolean(loadError) ||
                      savingTab !== null ||
                      !tabDirty ||
                      !isTabSaveable(activeTab, values)
                    }
                    className="shrink-0"
                  >
                    <Save className="h-4 w-4" />
                    {savingTab === activeTab ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function InstitutionSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-pup-black">
          <p role="status" className="text-sm font-semibold text-maroon dark:text-golden">
            Loading settings…
          </p>
        </div>
      }
    >
      <InstitutionSettingsPageInner />
    </Suspense>
  )
}
