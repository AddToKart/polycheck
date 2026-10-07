'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileClock, RefreshCw, Search } from 'lucide-react'
import { getRecentCampusDateRange, type AuditLogPage, type AuditOutcome, type User } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { Sidebar } from '@/components/layout/sidebar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingSpinner } from '@/lib/hooks'

const initialRange = getRecentCampusDateRange(30)
const emptyPage: AuditLogPage = { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }

const outcomeStyle: Record<AuditOutcome, string> = {
  succeeded: 'border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300',
  failed: 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
  initiated: 'border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

export default function AuditLogsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [logs, setLogs] = useState<AuditLogPage>(emptyPage)
  const [search, setSearch] = useState('')
  const [outcome, setOutcome] = useState<AuditOutcome | ''>('')
  const [startDate, setStartDate] = useState(initialRange.startDate)
  const [endDate, setEndDate] = useState(initialRange.endDate)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const current = api.getCurrentUser()
    if (!current || current.role !== 'super_admin') {
      router.replace('/faculty')
      return
    }
    setUser(current)
  }, [router])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      setLogs(await api.getAuditLogs({
        page,
        pageSize: 25,
        search: search.trim() || undefined,
        outcome: outcome || undefined,
        startDate,
        endDate,
      }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the audit log')
    } finally {
      setLoading(false)
    }
  }, [endDate, outcome, page, search, startDate, user])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setPage(1) }, [search, outcome, startDate, endDate])

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={() => { void api.logout(); router.push('/') }} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6 md:p-10">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Governance & accountability</p>
              <h1 className="flex items-center gap-3 text-3xl font-heading font-bold text-maroon dark:text-white"><FileClock className="h-7 w-7" /> Audit Log</h1>
              <p className="mt-2 text-sm text-zinc-500">Trace account, classroom, and settings changes within your administrative scope.</p>
            </div>
            <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
          </div>

          <Card className="mb-6">
            <CardContent className="grid gap-4 p-5 md:grid-cols-5">
              <div className="relative md:col-span-2">
                <Label htmlFor="audit-search">Search</Label>
                <Search className="absolute bottom-3 left-3 h-4 w-4 text-zinc-400" />
                <Input id="audit-search" className="mt-2 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Actor, action, or record ID" />
              </div>
              <div>
                <Label htmlFor="audit-outcome">Outcome</Label>
                <select id="audit-outcome" className="mt-2 h-10 w-full border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" value={outcome} onChange={(event) => setOutcome(event.target.value as AuditOutcome | '')}>
                  <option value="">All outcomes</option>
                  <option value="succeeded">Succeeded</option>
                  <option value="failed">Failed</option>
                  <option value="initiated">Incomplete</option>
                </select>
              </div>
              <div><Label htmlFor="audit-from">From</Label><Input id="audit-from" className="mt-2" type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></div>
              <div><Label htmlFor="audit-to">To</Label><Input id="audit-to" className="mt-2" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></div>
            </CardContent>
          </Card>

          {error ? <div role="alert" className="mb-5 border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div> : null}
          <Card>
            <CardContent className="p-0">
              {loading ? <div className="flex min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div> : logs.items.length === 0 ? (
                <div className="p-12 text-center text-sm text-zinc-500">No audited changes match these filters.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead><tr className="border-b bg-zinc-100/80 text-left text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900"><th className="px-5 py-3">Date & time</th><th className="px-5 py-3">Actor</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Resource</th><th className="px-5 py-3">Outcome</th><th className="px-5 py-3">Source</th></tr></thead>
                    <tbody>{logs.items.map((entry) => (
                      <tr key={entry.id} className="border-b border-zinc-100 align-top dark:border-zinc-800">
                        <td className="whitespace-nowrap px-5 py-4 text-zinc-600 dark:text-zinc-300">{new Date(entry.createdAt).toLocaleString('en-PH')}</td>
                        <td className="px-5 py-4"><p className="font-semibold text-zinc-900 dark:text-white">{entry.actorName}</p><p className="mt-1 text-xs uppercase tracking-wider text-zinc-400">{entry.actorRole.replace('_', ' ')}</p></td>
                        <td className="px-5 py-4 font-mono text-xs text-zinc-700 dark:text-zinc-200">{entry.action}</td>
                        <td className="px-5 py-4"><p className="capitalize text-zinc-700 dark:text-zinc-200">{entry.entityType.replaceAll('-', ' ')}</p><p className="mt-1 max-w-48 truncate font-mono text-xs text-zinc-400" title={entry.entityId}>{entry.entityId ?? '—'}</p></td>
                        <td className="px-5 py-4"><Badge variant="outline" className={outcomeStyle[entry.outcome]}>{entry.outcome === 'initiated' ? 'Incomplete' : entry.outcome}</Badge></td>
                        <td className="px-5 py-4 font-mono text-xs text-zinc-500">{entry.ipAddress ?? '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-4 text-sm dark:border-zinc-800">
                <span className="text-zinc-500">{logs.total.toLocaleString()} audited change{logs.total === 1 ? '' : 's'}</span>
                <div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button><span className="text-xs text-zinc-500">Page {logs.totalPages ? logs.page : 0} of {logs.totalPages}</span><Button variant="outline" size="sm" disabled={page >= logs.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
