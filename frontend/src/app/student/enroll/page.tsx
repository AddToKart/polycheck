'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap, LogOut, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { Student } from '@polycheck/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function StudentEnrollPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<Student | null>(null)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'student') {
      router.push('/')
      return
    }
    setUser(cu as Student)
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const trimmed = code.trim()
    if (!trimmed) {
      setError('Please enter an enrollment code.')
      return
    }

    setLoading(true)

    const sections = api.getSections()
    const section = sections.find((s) => s.enrollmentCode === trimmed)
    if (!section) {
      setError('Invalid enrollment code. Please check and try again.')
      setLoading(false)
      return
    }

    if (new Date(section.enrollmentCodeExpiry) < new Date()) {
      setError('This enrollment code has expired.')
      setLoading(false)
      return
    }

    const result = api.enrollStudent({
      sectionId: section.id,
      studentId: user!.id,
      studentName: user!.fullName,
    })

    if (!result) {
      setError('You are already enrolled in this section.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setCode('')
    setLoading(false)
  }

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-pup-black">
      <div className="p-8 max-w-xl mx-auto w-full flex flex-col min-h-screen">
        {/* Logout */}
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-zinc-500"
            onClick={() => { api.logout(); router.push('/') }}
          >
            <LogOut className="w-3 h-3 mr-1" />
            Disconnect
          </Button>
        </div>

        {/* Back link */}
        <Link href="/student/dashboard" className="inline-flex items-center gap-1 text-sm text-maroon dark:text-golden hover:underline mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <Card className="border-t-4 border-t-maroon dark:border-t-golden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <GraduationCap className="w-5 h-5 text-maroon dark:text-golden" />
              Enroll in a Subject
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Enter the enrollment code provided by your instructor.
            </p>

            {success ? (
              <div className="border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4 mb-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-green-700 dark:text-green-300">Successfully enrolled!</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">You can now access your new subject from the dashboard.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter enrollment code"
                    className="text-lg text-center tracking-widest font-mono uppercase"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3 mb-4 flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Enrolling...' : 'Enroll'}
                </Button>
              </form>
            )}

            {success && (
              <div className="mt-4 text-center">
                <Button variant="outline" asChild>
                  <Link href="/student/dashboard">Return to Dashboard</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
