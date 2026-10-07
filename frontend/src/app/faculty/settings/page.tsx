'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SuperAdmin } from '@polycheck/shared'
import { Save, Settings } from 'lucide-react'
import { Sidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api-client'

const fields = [
  { key: 'institution_name', label: 'Institution name', defaultValue: 'Polytechnic University of the Philippines', type: 'text', min: undefined, max: undefined },
  { key: 'default_geofence_radius_meters', label: 'Default geofence radius (meters)', defaultValue: '40', type: 'number', min: 10, max: 500 },
  { key: 'default_qr_validity_minutes', label: 'Default QR validity (minutes)', defaultValue: '5', type: 'number', min: 1, max: 15 },
  { key: 'default_grace_period_minutes', label: 'Default grace period (minutes)', defaultValue: '15', type: 'number', min: 0, max: 60 },
  { key: 'enrollment_code_expiry_days', label: 'Enrollment code expiry (days)', defaultValue: '14', type: 'number', min: 1, max: 90 },
] as const

export default function InstitutionSettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<SuperAdmin | null>(null)
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.key, field.defaultValue])))
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const current = api.getCurrentUser()
    if (!current || current.role !== 'super_admin') {
      router.replace('/faculty')
      return
    }
    setUser(current as SuperAdmin)
    void api.getSettings().then((settings) => {
      setValues((currentValues) => ({
        ...currentValues,
        ...Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
      }))
    }).catch((error) => setFeedback(error instanceof Error ? error.message : 'Unable to load settings'))
  }, [router])

  const handleSave = async () => {
    setSaving(true)
    setFeedback('')
    try {
      await Promise.all(fields.map((field) => api.setSetting(field.key, values[field.key])))
      setFeedback('Institution settings saved.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null
  const canEdit = user.scope === 'institution'

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={() => { api.logout(); router.push('/') }} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-3xl mx-auto">
          <div className="mb-8 flex items-center gap-3">
            <Settings className="h-7 w-7 text-maroon dark:text-golden" />
            <div>
              <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white">Institution Settings</h1>
              <p className="mt-1 text-sm text-zinc-500">Defaults used when faculty configure attendance sessions.</p>
              {!canEdit && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Department administrators can view these institution-wide defaults but only an institution administrator can change them.</p>}
            </div>
          </div>
          <Card>
            <CardContent className="space-y-6 p-6">
              {fields.map((field) => (
                <div className="space-y-2" key={field.key}>
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type={field.type}
                    min={field.min}
                    max={field.max}
                    disabled={!canEdit}
                    value={values[field.key]}
                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                </div>
              ))}
              {feedback && <p role="status" className="text-sm text-zinc-600 dark:text-zinc-300">{feedback}</p>}
              <div className="flex justify-end">
                <Button onClick={() => void handleSave()} disabled={!canEdit || saving || fields.some((field) => !values[field.key].trim())}>
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
