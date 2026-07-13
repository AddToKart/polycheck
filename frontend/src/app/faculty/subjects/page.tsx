'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ArrowRight } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User, Subject } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SubjectsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({})

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
      for (const sec of allSections) {
        counts[sec.subjectId] = (counts[sec.subjectId] || 0) + 1
      }
      setSectionCounts(counts)
      setSubjects(await api.getSubjects())
    }
    init()
  }, [router])

  if (!user) return null

  const isSuper = user.role === 'super_admin'

  const handleLogout = () => {
    api.logout()
    router.push('/')
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => {
              const sectionCount = sectionCounts[subject.id] ?? 0
              return (
              <div
                key={subject.id}
                onClick={() => router.push(`/faculty/subjects/${subject.id}`)}
                className="block group cursor-pointer"
              >
                <Card className="rounded-none border-zinc-300/80 dark:border-zinc-800 border-l-4 border-l-maroon dark:border-l-golden hover:border-maroon dark:hover:border-golden transition-colors bg-zinc-50 dark:bg-zinc-900/50 flex flex-col h-full">
                  <CardHeader className="pb-4 pt-6 px-6">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-1">
                        {subject.code}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        {sectionCount} Section{sectionCount !== 1 ? 's' : ''}
                      </span>
                    </div>
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
        </div>
      </main>
    </div>
  )
}
