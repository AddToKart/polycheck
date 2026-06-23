'use client'

import { useRouter } from 'next/navigation'
import { GraduationCap, BookOpen, ArrowRight } from 'lucide-react'
import { useLanding } from './layout'

export default function HomePage() {
  const router = useRouter()
  const { hoveredIndex, setHoveredIndex, exitingRoute, setExitingRoute } = useLanding()

  const handleNavigate = (route: string) => {
    setExitingRoute(route)
    setTimeout(() => {
      router.push(route)
      setExitingRoute(null)
    }, 280) // Snappy 280ms delay
  }

  return (
    <div className={`relative z-10 max-w-xl w-full mx-auto flex-1 flex flex-col justify-center px-8 md:px-12 lg:px-16 transition-all duration-300 ease-in-out ${
      exitingRoute ? 'opacity-0 translate-y-8 scale-[0.97]' : 'opacity-100 translate-y-0 scale-100'
    }`}>
      
      <div className="mb-10 animate-fade-in-up">
        <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500 mb-3">
          SELECT YOUR PORTAL
        </p>
        <div className={`h-[3px] bg-maroon dark:bg-golden rounded-full transition-all duration-300 ${
          hoveredIndex === 0 ? 'w-24 bg-maroon' : hoveredIndex === 1 ? 'w-32 bg-golden' : 'w-12'
        }`} />
      </div>

      <div className="relative grid grid-cols-1 gap-6 w-full animate-fade-in-up delay-100">
        {/* Sliding Highlight Background */}
        <div 
          className="absolute left-0 right-0 h-[calc(50%-12px)] bg-white dark:bg-zinc-900/90 border border-maroon/20 dark:border-golden/30 rounded-xl shadow-md transition-all duration-300 ease-out pointer-events-none"
          style={{
            opacity: hoveredIndex !== null && !exitingRoute ? 1 : 0,
            transform: hoveredIndex === 1 
              ? 'translateY(calc(100% + 24px))' 
              : 'translateY(0)',
          }}
        />

        {/* Student Portal Card */}
        <button
          onMouseEnter={() => setHoveredIndex(0)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={() => handleNavigate('/login/student')}
          className={`group relative w-full text-left rounded-xl border p-8 transition-all duration-300 overflow-hidden cursor-pointer ${
            hoveredIndex === 0 && !exitingRoute
              ? 'border-transparent -translate-y-1 scale-[1.01] z-10 shadow-sm' 
              : hoveredIndex === 1 && !exitingRoute
                ? 'border-zinc-200/50 dark:border-zinc-800/50 opacity-40 scale-[0.98]'
                : 'border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/40 backdrop-blur-sm'
          }`}
        >
          {/* Subtle hover background */}
          <div className="absolute -inset-px bg-maroon/[0.02] dark:bg-golden/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-14 h-14 rounded-lg bg-maroon/5 dark:bg-golden/5 flex items-center justify-center shrink-0 border border-maroon/10 dark:border-golden/10 group-hover:bg-maroon dark:group-hover:bg-golden group-hover:scale-105 group-hover:shadow-md transition-all duration-300">
              <GraduationCap className="w-7 h-7 text-maroon dark:text-golden group-hover:text-white dark:group-hover:text-maroon-dark transition-colors duration-305" strokeWidth={1.5} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl md:text-2xl font-heading font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-maroon dark:group-hover:text-golden transition-colors duration-300">
                  Student Portal
                </h2>
                <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center group-hover:bg-maroon/10 dark:group-hover:bg-golden/10 transition-colors duration-300 shrink-0">
                  <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-maroon dark:group-hover:text-golden group-hover:translate-x-0.5 transition-all duration-300" />
                </div>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-sans mt-2 leading-relaxed">
                View enrolled sections, scan active session QR codes for attendance, and monitor your class standings.
              </p>
            </div>
          </div>
        </button>

        {/* Faculty Portal Card */}
        <button
          onMouseEnter={() => setHoveredIndex(1)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={() => handleNavigate('/login/faculty')}
          className={`group relative w-full text-left rounded-xl border p-8 transition-all duration-300 overflow-hidden cursor-pointer ${
            hoveredIndex === 1 && !exitingRoute
              ? 'border-transparent -translate-y-1 scale-[1.01] z-10 shadow-sm' 
              : hoveredIndex === 0 && !exitingRoute
                ? 'border-zinc-200/50 dark:border-zinc-800/50 opacity-40 scale-[0.98]'
                : 'border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/40 backdrop-blur-sm'
          }`}
        >
          {/* Subtle hover background */}
          <div className="absolute -inset-px bg-maroon/[0.02] dark:bg-golden/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-14 h-14 rounded-lg bg-maroon/5 dark:bg-golden/5 flex items-center justify-center shrink-0 border border-maroon/10 dark:border-golden/10 group-hover:bg-maroon dark:group-hover:bg-golden group-hover:scale-105 group-hover:shadow-md transition-all duration-300">
              <BookOpen className="w-7 h-7 text-maroon dark:text-golden group-hover:text-white dark:group-hover:text-maroon-dark transition-colors duration-305" strokeWidth={1.5} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl md:text-2xl font-heading font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-maroon dark:group-hover:text-golden transition-colors duration-300">
                  Faculty Portal
                </h2>
                <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center group-hover:bg-maroon/10 dark:group-hover:bg-golden/10 transition-colors duration-300 shrink-0">
                  <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-maroon dark:group-hover:text-golden group-hover:translate-x-0.5 transition-all duration-300" />
                </div>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-sans mt-2 leading-relaxed">
                Configure sections, activate live QR check-ins, resolve disputed statuses, and extract detailed attendance analytics.
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="mt-12 text-center md:text-left animate-fade-in-up delay-300">
        <p className="text-[10px] font-sans font-bold uppercase tracking-[0.25em] text-zinc-400/75 dark:text-zinc-500/75 leading-relaxed">
          Polytechnic University of the Philippines &bull; Attendance System
        </p>
      </div>
      
    </div>
  )
}
