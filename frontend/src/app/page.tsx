'use client'

import { useRouter } from 'next/navigation'
import { GraduationCap, BookOpen, ArrowRight } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background selection:bg-golden selection:text-maroon">
      {/* Left Branding Panel */}
      <div className="relative w-full md:w-5/12 lg:w-1/2 bg-maroon flex flex-col justify-between p-8 md:p-12 lg:p-16 text-white border-b border-maroon-dark md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            {/* Minimalist Logo Representation */}
            <div className="w-8 h-8 bg-golden flex items-center justify-center shrink-0 shadow-[2px_2px_0px_rgba(0,0,0,0.5)]">
              <div className="w-3 h-3 bg-maroon rounded-none" />
            </div>
            <span className="font-heading font-bold text-xl tracking-wide uppercase">PUP</span>
          </div>
          <div className="absolute top-6 right-6 md:hidden">
            <ThemeToggle />
          </div>
        </div>

        <div className="my-24 md:my-auto">
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-heading font-bold text-golden leading-[0.9] tracking-tighter mb-6">
            Polycheck.
          </h1>
          <p className="text-lg md:text-xl font-sans text-white/90 max-w-md leading-relaxed">
            Attendance Management System. <br/>
            Polytechnic University of the Philippines.
          </p>
        </div>

        <div className="text-sm font-sans text-white/50 uppercase tracking-widest">
          Est. 1904
        </div>
      </div>

      {/* Right Interaction Panel */}
      <div className="relative w-full md:w-7/12 lg:w-1/2 flex flex-col h-full min-h-[60vh] md:min-h-screen bg-background">
        <div className="absolute top-6 right-6 hidden md:block z-10">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <div className="w-full flex flex-col border-y border-zinc-200 dark:border-zinc-800">
            
            {/* Student Portal Option */}
            <button
              onClick={() => router.push('/login/student')}
              className="group relative w-full text-left p-8 md:p-12 lg:p-16 border-b border-zinc-200 dark:border-zinc-800 bg-background hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <GraduationCap className="w-10 h-10 text-maroon dark:text-golden" strokeWidth={1.5} />
                <ArrowRight className="w-6 h-6 text-zinc-400 group-hover:text-maroon group-hover:translate-x-2 transition-all duration-300" />
              </div>
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3 text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors">
                Student Portal
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 font-sans max-w-md">
                View your subjects, verify attendance records, and track your overall status.
              </p>
            </button>

            {/* Faculty Portal Option */}
            <button
              onClick={() => router.push('/login/faculty')}
              className="group relative w-full text-left p-8 md:p-12 lg:p-16 bg-background hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <BookOpen className="w-10 h-10 text-maroon dark:text-golden" strokeWidth={1.5} />
                <ArrowRight className="w-6 h-6 text-zinc-400 group-hover:text-maroon group-hover:translate-x-2 transition-all duration-300" />
              </div>
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3 text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors">
                Faculty Portal
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 font-sans max-w-md">
                Manage subject sections, monitor live session attendance, and generate reports.
              </p>
            </button>
            
          </div>
        </div>
      </div>
    </div>
  )
}
