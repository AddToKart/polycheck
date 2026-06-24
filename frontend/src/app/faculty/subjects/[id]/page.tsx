'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, CalendarDays, Key, Copy, ArrowRight, Plus } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User, Subject, Section } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SubjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [user, setUser] = useState<User | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [copiedId, setCopiedId] = useState('')

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
  }, [router])

  useEffect(() => {
    if (!id) return
    const subj = api.getSubject(id)
    if (!subj) { router.push('/faculty/subjects'); return }
    setSubject(subj)
    let secs = api.getSections().filter((s) => s.subjectId === id)
    if (user && user.role === 'teacher') {
      secs = secs.filter((s) => s.teacherId === user.id)
    }
    setSections(secs)
  }, [id, router, user])

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(''), 2000)
  }

  if (!user || !subject) return null

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} backHref="/faculty/subjects" backLabel="Back to Subjects" />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/faculty/subjects" className="text-maroon dark:text-golden hover:underline text-sm flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Subjects
            </Link>
            <div>
              <h1 className="text-2xl font-heading font-bold text-maroon-dark dark:text-white">{subject.name}</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{subject.code}</p>
            </div>
          </div>

          {/* Subject Info */}
          <Card className="mb-8 border-t-4 border-t-maroon dark:border-t-golden">
            <CardContent className="pt-6">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Code</p>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{subject.code}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Sections</p>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{sections.length}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{subject.description || '\u2014'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-maroon dark:text-golden" />
              Sections
            </h2>
            <Button variant="default" size="sm" className="text-[10px] font-bold uppercase tracking-widest rounded-none h-9" asChild>
              <Link href={`/faculty/sections/create?subjectId=${id}`}>
                <Plus className="w-4 h-4 mr-1" /> Add Section
              </Link>
            </Button>
          </div>

          {sections.length === 0 ? (
            <div className="border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50/50 dark:bg-zinc-900/20">
              <p className="text-xl font-heading font-bold text-zinc-400 mb-2">NO SECTIONS FOUND</p>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Create a section to get started.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sections.map((section) => (
                <Card key={section.id} className="rounded-none border-zinc-300/80 dark:border-zinc-800 border-l-4 border-l-maroon dark:border-l-golden hover:border-maroon dark:hover:border-golden transition-colors bg-zinc-50 dark:bg-zinc-900/50 flex flex-col h-full">
                  <CardHeader className="pb-4 pt-6 px-6">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-1">
                        Section {section.section}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        {section.studentCount} enrolled
                      </span>
                    </div>
                    <CardTitle className="text-xl font-heading font-bold text-foreground leading-tight">
                      {section.room}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 flex-1 flex flex-col">
                    <div className="space-y-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-6 flex-1 uppercase tracking-wider">
                      <div className="flex justify-between border-b border-zinc-300/60 dark:border-zinc-800 pb-2">
                        <span className="text-zinc-400">Instructor</span>
                        <span className="text-foreground text-right">{section.teacherName}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-300/60 dark:border-zinc-800 pb-2">
                        <span className="text-zinc-400">Schedule</span>
                        <span className="text-foreground text-right">
                          {section.schedule.map((s) => `${s.day} ${s.startTime}-${s.endTime}${s.room ? ` (${s.room})` : ''}`).join(', ')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-zinc-400">Join Code</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono bg-zinc-200 dark:bg-zinc-800 px-2 py-1 text-foreground">{section.enrollmentCode}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(section.enrollmentCode, section.id) }}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
                            title="Copy Code"
                          >
                            {copiedId === section.id ? <span className="text-[10px] text-maroon dark:text-golden font-bold">COPIED</span> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-auto">
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 text-[10px] font-bold uppercase tracking-widest rounded-none h-10"
                        asChild
                      >
                        <Link href={`/faculty/sections/${section.id}`}>
                          View
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-[10px] font-bold uppercase tracking-widest rounded-none h-10"
                        asChild
                      >
                        <Link href={`/faculty/subjects/${id}/sessions?sectionId=${section.id}`}>
                          <CalendarDays className="w-3 h-3 mr-1" />
                          Sessions
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
