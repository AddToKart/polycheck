'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/mock-api'
import type { User, Student, Section, Session } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Input } from '@/components/ui/input'
import { Search, Users, BookOpen, CalendarCheck, X } from 'lucide-react'

type SearchResult = {
  students: Student[]
  sections: Section[]
  sessions: Session[]
}

function SearchPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''

  const [user, setUser] = useState<User | null>(null)
  const [query, setQuery] = useState(initialQ)
  const [results, setResults] = useState<SearchResult>({ students: [], sections: [], sessions: [] })
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu) { router.push('/'); return }
    setUser(cu)
  }, [router])

  useEffect(() => {
    if (initialQ) {
      const r = api.search(initialQ)
      setResults(r)
      setSearched(true)
    }
  }, [initialQ])

  const handleSearch = (q: string) => {
    setQuery(q)
    if (q.trim().length > 0) {
      const r = api.search(q)
      setResults(r)
      setSearched(true)
      router.replace(`/faculty/search?q=${encodeURIComponent(q)}`, { scroll: false })
    } else {
      setResults({ students: [], sections: [], sessions: [] })
      setSearched(false)
    }
  }

  const subjects = useMemo(() => api.getSubjects(), [])

  const totalResults = results.students.length + results.sections.length + results.sessions.length

  const handleLogout = () => { api.logout(); router.push('/') }

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Search</p>
            <h1 className="text-3xl font-heading font-bold text-foreground mb-6">Global Search</h1>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <Input
                id="global-search-input"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search students, subjects, sections, sessions…"
                className="pl-12 pr-10 h-12 rounded-none text-sm border-zinc-300 dark:border-zinc-700 focus-visible:ring-maroon/30 focus-visible:border-maroon"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Results summary */}
          {searched && query && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-6">
              {totalResults === 0 ? `No results for "${query}"` : `${totalResults} result${totalResults !== 1 ? 's' : ''} for "${query}"`}
            </p>
          )}

          {!searched && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center mb-4">
                <Search className="w-5 h-5 text-zinc-400" />
              </div>
              <p className="text-sm text-zinc-400">Start typing to search across students, subjects, sections, and sessions.</p>
            </div>
          )}

          {/* Students */}
          {results.students.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <Users className="w-4 h-4 text-maroon dark:text-golden" />
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Students ({results.students.length})</h2>
              </div>
              <div className="space-y-1">
                {results.students.map((s) => (
                  <Link
                    key={s.id}
                    href={`/faculty/students/${s.id}`}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-maroon/30 dark:hover:border-golden/30 transition-colors group"
                  >
                    <div className="w-9 h-9 bg-maroon dark:bg-golden flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-white dark:text-maroon-dark">
                        {s.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors truncate">{s.fullName}</p>
                      <p className="text-xs text-zinc-400">{s.studentId} · {s.program}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Sections */}
          {results.sections.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <BookOpen className="w-4 h-4 text-maroon dark:text-golden" />
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Sections ({results.sections.length})</h2>
              </div>
              <div className="space-y-1">
                {results.sections.map((sec) => {
                  const subj = subjects.find(s => s.id === sec.subjectId)
                  return (
                    <Link
                      key={sec.id}
                      href={`/faculty/sections/${sec.id}`}
                      className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-maroon/30 dark:hover:border-golden/30 transition-colors group"
                    >
                      <div className="w-9 h-9 border-2 border-maroon dark:border-golden flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4 text-maroon dark:text-golden" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors truncate">
                          {subj?.name ?? 'Unknown Subject'}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {subj?.code} · Section {sec.section}{sec.room ? ` · ${sec.room}` : ''}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* Sessions */}
          {results.sessions.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <CalendarCheck className="w-4 h-4 text-maroon dark:text-golden" />
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Sessions ({results.sessions.length})</h2>
              </div>
              <div className="space-y-1">
                {results.sessions.map((sess) => (
                  <Link
                    key={sess.id}
                    href={`/faculty/sessions/${sess.id}`}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-maroon/30 dark:hover:border-golden/30 transition-colors group"
                  >
                    <div className="w-9 h-9 border-2 border-maroon dark:border-golden flex items-center justify-center shrink-0">
                      <CalendarCheck className="w-4 h-4 text-maroon dark:text-golden" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors truncate">
                        {sess.subjectName}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {sess.date} · {sess.startTime}–{sess.endTime}{sess.room ? ` · ${sess.room}` : ''}
                        {sess.isActive && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                            Active
                          </span>
                        )}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {searched && totalResults === 0 && query && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center mb-4">
                <Search className="w-5 h-5 text-zinc-300 dark:text-zinc-600" />
              </div>
              <p className="text-sm font-semibold text-zinc-400 mb-1">No results found</p>
              <p className="text-xs text-zinc-400">Try a different name, student ID, subject code, or date.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  )
}
