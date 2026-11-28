'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ArrowRight } from 'lucide-react'

const SUBJECTS_PAGE_SIZE = 9
import { api, requestUserLogout } from '@/lib/api-client'
import type { User, Subject } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { FilterBar, FilterChipGroup, FilterField, FilterSelect } from '@/components/FilterBar'
import { Input } from '@/components/ui/input'
import { ArchivedSubjectDialog } from '@/components/subjects/ArchivedSubjectDialog'
import { useUrlFilters } from '@/lib/hooks/use-url-filters'
import { matchesQuery } from '@/lib/list-search'
import { archiveEvidencePurgeAt, courseShortLabel } from '@polycheck/shared'

const FILTER_SCHEMA = {
  view: { defaultValue: '', allowed: ['archived'] },
  q: { defaultValue: '' },
  course: { defaultValue: '' },
  sort: { defaultValue: '', allowed: ['name', 'newest'] },
} as const

function daysUntilErasure(archivedAt: string, now = Date.now()) {
  return Math.max(0, Math.ceil((archiveEvidencePurgeAt(archivedAt).getTime() - now) / 86_400_000))
}

function SubjectsContent() {
  const router = useRouter()
  const filters = useUrlFilters(FILTER_SCHEMA)
  const { view, q, course, sort } = filters.values
  const showArchived = view === 'archived'
  const [archivedSubjects, setArchivedSubjects] = useState<Subject[]>([])
  const [openArchived, setOpenArchived] = useState<Subject | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({})
  const [sectionCourses, setSectionCourses] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const init = async () => {
      const cu = api.getCurrentUser()
      if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
        router.push('/')
        return
      }
      setUser(cu)
      const allSections = await api.getSections()
      const counts: Record<string, number> = {}
      const courses: Record<string, Set<string>> = {}
      for (const sec of allSections) {
        counts[sec.subjectId] = (counts[sec.subjectId] || 0) + 1
        const course = sec.course?.trim()
        if (course) (courses[sec.subjectId] ??= new Set()).add(course)
      }
      setSectionCounts(counts)
      setSectionCourses(
        Object.fromEntries(
          Object.entries(courses).map(([subjectId, set]) => [subjectId, [...set].sort()]),
        ),
      )
      const [current, archived] = await Promise.all([
        api.getSubjects(),
        // A failure here (or an older server) must not hide the current subjects.
        api.getArchivedSubjects().catch(() => []),
      ])
      setSubjects(current)
      setArchivedSubjects(archived.filter((subject) => subject.archivedAt))
    }
    init()
  }, [router, reloadKey])

  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [view, q, course, sort])

  const listed = showArchived ? archivedSubjects : subjects
  const visible = useMemo(() => {
    const matched = listed.filter(
      (subject) =>
        matchesQuery(q, [subject.name, subject.code, subject.description]) &&
        (!course || (sectionCourses[subject.id] ?? []).includes(course)),
    )
    if (sort === 'name') return [...matched].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'newest') return [...matched].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return matched
  }, [listed, q, course, sort, sectionCourses])
  const courseOptions = useMemo(
    () =>
      [...new Set(Object.values(sectionCourses).flat())]
        .sort()
        .map((code) => ({ value: code, label: courseShortLabel(code) || code })),
    [sectionCourses],
  )
  const totalPages = Math.max(1, Math.ceil(visible.length / SUBJECTS_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedSubjects = useMemo(
    () => visible.slice((safePage - 1) * SUBJECTS_PAGE_SIZE, safePage * SUBJECTS_PAGE_SIZE),
    [visible, safePage]
  )

  if (!user) return null

  const isSuper = user.role === 'super_admin'

  const handleLogout = () => {
    void requestUserLogout().then((outcome) => {
      if (outcome.loggedOut) router.push('/')
    })
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background selection:bg-golden selection:text-maroon">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 md:p-12 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 border-b border-zinc-200 dark:border-zinc-800 pb-8">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
                {isSuper ? 'Global Directory' : 'Faculty Management'}
              </p>
              <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground tracking-tight">
                {isSuper ? 'All Subjects' : 'My Subjects'}
              </h1>
              <p className="text-sm font-medium text-zinc-500 mt-4 uppercase tracking-widest">
                {subjects.length} Subject{subjects.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="mt-6 md:mt-0">
              {!isSuper && (
                <Button asChild className="rounded-none bg-maroon text-white hover:bg-maroon-dark uppercase tracking-widest font-bold text-xs h-12 px-6">
                  <Link href="/faculty/subjects/create">
                    <Plus className="w-4 h-4 mr-2" />
                    Initialize Subject
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <FilterBar
            className="mb-8"
            onClear={() => filters.setFilters({ q: '', course: '', sort: '' })}
            activeCount={[q, course, sort].filter(Boolean).length}
            label="Subject filters"
          >
            <FilterChipGroup
              label="Show"
              value={view}
              onChange={(value) => filters.setFilter('view', value)}
              options={[
                { value: '', label: `Current (${subjects.length})` },
                { value: 'archived', label: `Archived (${archivedSubjects.length})` },
              ]}
            />
            <FilterField id="subject-search" label="Search" className="min-w-[12rem] flex-1">
              <Input
                id="subject-search"
                type="search"
                value={q}
                onChange={(event) => filters.setFilter('q', event.target.value)}
                placeholder="Name or code"
                className="h-9 rounded-none"
              />
            </FilterField>
            {!showArchived && courseOptions.length > 0 ? (
              <FilterSelect
                id="subject-course"
                label="Course"
                value={course}
                onChange={(value) => filters.setFilter('course', value)}
                options={courseOptions}
                allLabel="All courses"
              />
            ) : null}
            <FilterSelect
              id="subject-sort"
              label="Sort by"
              value={sort}
              onChange={(value) => filters.setFilter('sort', value)}
              options={[
                { value: '', label: showArchived ? 'Recently archived' : 'Subject code' },
                { value: 'name', label: 'Name (A to Z)' },
                { value: 'newest', label: 'Newest first' },
              ]}
            />
          </FilterBar>

          {/* Subjects Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pagedSubjects.map((subject) => {
              const sectionCount = sectionCounts[subject.id] ?? 0
              const courses = sectionCourses[subject.id] ?? []
              return (
              <div
                key={subject.id}
                onClick={() =>
                  subject.archivedAt ? setOpenArchived(subject) : router.push(`/faculty/subjects/${subject.id}`)
                }
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  if (subject.archivedAt) setOpenArchived(subject)
                  else router.push(`/faculty/subjects/${subject.id}`)
                }}
                role="button"
                tabIndex={0}
                aria-label={subject.archivedAt ? `${subject.name}, archived` : `Open ${subject.name}`}
                className="block group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon dark:focus-visible:ring-golden"
              >
                <Card className="rounded-none border-zinc-300/80 dark:border-zinc-800 border-l-4 border-l-maroon dark:border-l-golden hover:border-maroon dark:hover:border-golden transition-colors bg-zinc-50 dark:bg-zinc-900/50 flex flex-col h-full">
                  <CardHeader className="pb-4 pt-6 px-6">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-1">
                        {subject.code}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        {subject.archivedAt ? 'Archived' : `${sectionCount} Section${sectionCount !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                    {subject.archivedAt && (
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-maroon dark:text-golden">
                        {subject.evidencePurgedAt
                          ? 'Evidence erased, results kept'
                          : `Evidence erased in ${daysUntilErasure(subject.archivedAt)} days`}
                      </p>
                    )}
                    {courses.length > 0 && (
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        Courses: {courses.join(', ')}
                      </p>
                    )}
                    <CardTitle className="text-xl font-heading font-bold text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors line-clamp-2 leading-tight">
                      {subject.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 flex-1 flex flex-col">
                    {subject.description && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 flex-1 leading-relaxed line-clamp-3">
                        {subject.description}
                      </p>
                    )}

                    <div className="mt-auto">
                      <span className="w-full h-10 text-xs font-bold uppercase tracking-widest border border-zinc-300 dark:border-zinc-700 group-hover:bg-maroon group-hover:text-white group-hover:border-maroon dark:group-hover:bg-golden dark:group-hover:text-maroon dark:group-hover:border-golden transition-all flex items-center justify-center gap-2 rounded-none">
                        {subject.archivedAt ? 'Archive options' : 'View Sections'} <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )})}

            {listed.length > 0 && visible.length === 0 && (
              <p className="col-span-full border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
                No subject matches these filters.
              </p>
            )}

            {showArchived && archivedSubjects.length === 0 && (
              <p className="col-span-full border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
                Nothing is archived. Open a subject to archive it at the end of a semester.
              </p>
            )}

            {!showArchived && subjects.length === 0 && (
              <div className="col-span-full border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50/50 dark:bg-zinc-900/20">
                <p className="text-xl font-heading font-bold text-zinc-400 mb-2">NO RECORDS FOUND</p>
                {!isSuper && <p className="text-xs uppercase tracking-widest text-zinc-500">Initialize a subject to begin monitoring attendance.</p>}
              </div>
            )}
          </div>

          {visible.length > 0 && (
            <PaginationBar
              page={safePage}
              totalPages={totalPages}
              totalItems={visible.length}
              pageSize={SUBJECTS_PAGE_SIZE}
              itemName="subjects"
              onPageChange={setPage}
              showNumbers
              className="mt-6 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            />
          )}
        </div>
      </main>
      <ArchivedSubjectDialog
        subject={openArchived}
        canManage={user.role === 'teacher'}
        onClose={() => setOpenArchived(null)}
        onRestored={() => {
          setOpenArchived(null)
          filters.setFilter('view', '')
          setReloadKey((key) => key + 1)
        }}
        onDeleted={() => {
          setOpenArchived(null)
          setReloadKey((key) => key + 1)
        }}
      />
    </div>
  )
}

export default function SubjectsPage() {
  return (
    <Suspense fallback={null}>
      <SubjectsContent />
    </Suspense>
  )
}
