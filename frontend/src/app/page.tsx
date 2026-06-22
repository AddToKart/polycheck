'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { GraduationCap, BookOpen, ArrowRight, Sparkles } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

function PupStar({ className }: { className?: string }) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[20px] border-b-golden relative">
        <div className="absolute -top-[6px] -left-[12px] w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-golden"></div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background selection:bg-golden selection:text-maroon overflow-hidden">
      {/* Left Branding Panel */}
      <div className="relative w-full md:w-5/12 lg:w-1/2 bg-maroon flex flex-col justify-between p-8 md:p-12 lg:p-16 text-white border-b border-maroon-dark md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div className="w-full h-full" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, #F5A800 1px, transparent 1px), radial-gradient(circle at 75% 75%, #F5A800 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />
        </div>

        {/* Top section: Logo + PUP Identity */}
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-5">
              <div className="relative w-[72px] h-[72px] shrink-0 bg-white p-1.5 shadow-lg">
                <Image
                  src="/pup-logo.png"
                  alt="PUP Logo"
                  width={72}
                  height={72}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="pt-1">
                <p className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-golden/80 leading-tight">
                  Republic of the Philippines
                </p>
                <h2 className="text-sm font-sans font-bold uppercase tracking-[0.15em] text-white leading-tight mt-1">
                  Polytechnic University<br/>of the Philippines
                </h2>
              </div>
            </div>
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Center: Polycheck branding */}
        <div className="relative z-10 my-20 md:my-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-[2px] bg-golden" />
            <PupStar className="scale-[0.6] origin-left" />
          </div>

          <h1 className="text-6xl md:text-7xl lg:text-8xl font-heading font-bold text-golden leading-[0.9] tracking-tighter mb-6">
            Polycheck.
          </h1>

          <p className="text-base md:text-lg font-sans text-white/80 max-w-md leading-relaxed mb-8">
            Attendance Management System
          </p>

          <div className="flex items-center gap-3">
            <div className="w-8 h-[2px] bg-golden/40" />
            <span className="text-sm font-sans font-semibold text-golden tracking-[0.25em] uppercase italic">
              Iskolar ng Bayan
            </span>
            <div className="w-8 h-[2px] bg-golden/40" />
          </div>
        </div>

        {/* Bottom: Tagline + Year */}
        <div className="relative z-10 flex items-center justify-between text-sm font-sans uppercase tracking-widest">
          <span className="text-white/40">PUP System</span>
          <div className="flex items-center gap-3">
            <span className="text-white/40">&#9679;</span>
            <span className="text-white/60">Est. 1904</span>
            <span className="text-white/40">&#9679;</span>
            <span className="text-white/40">v1.0</span>
          </div>
        </div>

        {/* Mobile theme toggle */}
        <div className="absolute top-6 right-6 md:hidden z-20">
          <ThemeToggle />
        </div>
      </div>

      {/* Right Interaction Panel */}
      <div className="relative w-full md:w-7/12 lg:w-1/2 flex flex-col h-full min-h-[60vh] md:min-h-screen bg-background">
        <div className="absolute top-6 right-6 hidden md:block z-10">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex flex-col justify-center relative">
          {/* Subtle PUP watermark */}
          <div className="absolute right-0 bottom-0 w-64 h-64 opacity-[0.02] pointer-events-none dark:opacity-[0.04]">
            <PupStar className="scale-[3] origin-bottom-right" />
          </div>

          <div className="px-8 md:px-12 lg:px-16">
            <div className="mb-12">
              <p className="text-[10px] font-sans font-bold uppercase tracking-[0.25em] text-zinc-400 mb-3">
                SELECT YOUR PORTAL
              </p>
              <div className="w-12 h-[2px] bg-maroon dark:bg-golden" />
            </div>
          </div>

          <div className="w-full flex flex-col border-t border-zinc-200 dark:border-zinc-800">
            {/* Student Portal Option */}
            <button
              onClick={() => router.push('/login/student')}
              className="group relative w-full text-left px-8 md:px-12 lg:px-16 py-8 md:py-10 lg:py-12 border-b border-zinc-200 dark:border-zinc-800 bg-background hover:bg-zinc-100 dark:hover:bg-zinc-900/70 transition-all duration-300 overflow-hidden"
            >
              <div className="relative z-10 flex items-center gap-6">
                <div className="w-14 h-14 bg-maroon/10 dark:bg-golden/10 flex items-center justify-center shrink-0 group-hover:bg-maroon dark:group-hover:bg-golden transition-colors duration-300">
                  <GraduationCap className="w-7 h-7 text-maroon dark:text-golden group-hover:text-white dark:group-hover:text-maroon-dark transition-colors duration-300" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors">
                      Student Portal
                    </h2>
                    <ArrowRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-maroon dark:group-hover:text-golden group-hover:translate-x-1 transition-all duration-300 shrink-0" />
                  </div>
                  <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 font-sans mt-2 max-w-lg leading-relaxed">
                    View your enrolled sections, scan QR codes for attendance, and track your class standing.
                  </p>
                </div>
              </div>
            </button>

            {/* Faculty Portal Option */}
            <button
              onClick={() => router.push('/login/faculty')}
              className="group relative w-full text-left px-8 md:px-12 lg:px-16 py-8 md:py-10 lg:py-12 bg-background hover:bg-zinc-100 dark:hover:bg-zinc-900/70 transition-all duration-300 overflow-hidden"
            >
              <div className="relative z-10 flex items-center gap-6">
                <div className="w-14 h-14 bg-maroon/10 dark:bg-golden/10 flex items-center justify-center shrink-0 group-hover:bg-maroon dark:group-hover:bg-golden transition-colors duration-300">
                  <BookOpen className="w-7 h-7 text-maroon dark:text-golden group-hover:text-white dark:group-hover:text-maroon-dark transition-colors duration-300" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors">
                      Faculty Portal
                    </h2>
                    <ArrowRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-maroon dark:group-hover:text-golden group-hover:translate-x-1 transition-all duration-300 shrink-0" />
                  </div>
                  <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 font-sans mt-2 max-w-lg leading-relaxed">
                    Manage subject sections, monitor live session attendance in real time, and generate reports.
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div className="px-8 md:px-12 lg:px-16 mt-8">
            <p className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-zinc-400/60">
              Polytechnic University of the Philippines &mdash; Attendance Management System
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
