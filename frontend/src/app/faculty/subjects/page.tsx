'use client'

import { useEffect, useMemo, useState } from 'react'
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

export default function SubjectsPage() {
  const router = useRouter()
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
      setSubjects(await api.getSubjects())
    }
    init()
  }, [router])

  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(subjects.length / SUBJECTS_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedSubjects = useMemo(
    () => subjects.slice((safePage - 1) * SUBJECTS_PAGE_SIZE, safePage * SUBJECTS_PAGE_SIZE),
    [subjects, safePage]
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

          {/* Subjects Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pagedSubjects.map((subject) => {
              const sectionCount = sectionCounts[subject.id] ?? 0
              const courses = sectionCourses[subject.id] ?? []
              return (
              <div
                key={subject.id}
                onClick={() => router.push(`/faculty/subjects/${subject.id}`)}
                className="block group cursor-pointer"
              >
                <Card className="rounded-none border-zinc-300/80 dark:border-zinc-800 border-l-4 border-l-maroon dark:border-l-golden hover:border-maroon dark:hover:border-golden transition-colors bg-zinc-50 dark:bg-zinc-900/50 flex flex-col h-full">
                  <CardHeader className="pb-4 pt-6 px-6">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-1">
                        {subject.code}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        {sectionCount} Section{sectionCount !== 1 ? 's' : ''}
                      </span>
                    </div>
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
                        View Sections <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )})}

            {subjects.length === 0 && (
              <div className="col-span-full border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50/50 dark:bg-zinc-900/20">
                <p className="text-xl font-heading font-bold text-zinc-400 mb-2">NO RECORDS FOUND</p>
                {!isSuper && <p className="text-xs uppercase tracking-widest text-zinc-500">Initialize a subject to begin monitoring attendance.</p>}
              </div>
            )}
          </div>

          {subjects.length > 0 && (
            <PaginationBar
              page={safePage}
              totalPages={totalPages}
              totalItems={subjects.length}
              pageSize={SUBJECTS_PAGE_SIZE}
              itemName="subjects"
              onPageChange={setPage}
              showNumbers
              className="mt-6 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            />
          )}
        </div>
      </main>
    </div>
  )
}
