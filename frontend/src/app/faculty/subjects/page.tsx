'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Copy, ArrowRight } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User, Subject } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SubjectsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [copiedId, setCopiedId] = useState('')

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
    
    // Super admins see all subjects; teachers see only their own
    if (cu.role === 'super_admin') {
      setSubjects(api.getSubjects())
    } else {
      setSubjects(api.getSubjects(cu.id))
    }
  }, [router])

  if (!user) return null
  
  const isSuper = user.role === 'super_admin'

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(''), 2000)
  }

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex bg-background selection:bg-golden selection:text-maroon">
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
                {subjects.length} Total Record{subjects.length !== 1 ? 's' : ''}
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
            {subjects.map((subject) => (
              <Card key={subject.id} className="rounded-none border-zinc-200 dark:border-zinc-800 shadow-none hover:border-maroon dark:hover:border-golden transition-colors group bg-zinc-50 dark:bg-zinc-900/50">
                <div className="border-l-4 border-maroon dark:border-golden h-full flex flex-col">
                  <CardHeader className="pb-4 pt-6 px-6">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-1">
                        {subject.code}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        Sec {subject.section}
                      </span>
                    </div>
                    <CardTitle className="text-xl font-heading font-bold text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors line-clamp-2 leading-tight">
                      {subject.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 flex-1 flex flex-col">
                    <div className="space-y-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-6 flex-1 uppercase tracking-wider">
                      <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                        <span className="text-zinc-400">Instructor</span>
                        <span className="text-foreground text-right">{subject.teacherName}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                        <span className="text-zinc-400">Room</span>
                        <span className="text-foreground text-right">{subject.room}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                        <span className="text-zinc-400">Schedule</span>
                        <span className="text-foreground text-right">
                          {subject.schedule.map((s) => `${s.day} ${s.startTime}-${s.endTime}`).join(', ')}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                        <span className="text-zinc-400">Enrolled</span>
                        <span className="text-foreground text-right">{subject.studentCount}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-zinc-400">Join Code</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono bg-zinc-200 dark:bg-zinc-800 px-2 py-1 text-foreground">{subject.enrollmentCode}</span>
                          <button 
                            onClick={() => handleCopy(subject.enrollmentCode, subject.id)}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
                            title="Copy Code"
                          >
                            {copiedId === subject.id ? <span className="text-[10px] text-maroon dark:text-golden font-bold">COPIED</span> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-auto">
                      <Button asChild variant="outline" className="w-full rounded-none border-zinc-300 dark:border-zinc-700 font-bold uppercase tracking-widest text-xs h-10 group-hover:bg-maroon group-hover:text-white group-hover:border-maroon dark:group-hover:bg-golden dark:group-hover:text-maroon dark:group-hover:border-golden transition-all">
                        <Link href={`/faculty/sessions?subjectId=${subject.id}`}>
                          View Sessions <ArrowRight className="w-3 h-3 ml-2" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
            
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
