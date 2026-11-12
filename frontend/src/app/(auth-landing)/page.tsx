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
    }, 280) // Snappy 280ms delay
  }

  return (
    <div className={`relative z-10 max-w-xl w-full mx-auto flex-1 flex flex-col justify-center px-4 sm:px-8 md:px-12 lg:px-16 py-4 md:py-0 transition-all duration-300 ease-in-out ${
      exitingRoute ? 'opacity-0 translate-y-8 scale-[0.97]' : 'opacity-100 translate-y-0 scale-100'
    }`}>
      
      <div className="mb-3 sm:mb-6 md:mb-10 animate-fade-in-up">
        <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500 mb-2 sm:mb-3">
          SELECT YOUR PORTAL
        </p>
        <div className={`h-[3px] bg-maroon dark:bg-golden rounded-none transition-all duration-300 ${
          hoveredIndex === 0 ? 'w-24 bg-maroon' : hoveredIndex === 1 ? 'w-32 bg-golden' : 'w-12'
        }`} />
      </div>

      <div className="relative grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 w-full animate-fade-in-up delay-100">
        {/* Student Portal Card */}
        <button
          onMouseEnter={() => setHoveredIndex(0)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={() => handleNavigate('/login/student')}
          className={`group relative w-full text-left rounded-none border border-l-4 p-3.5 sm:p-6 md:p-8 transition-all duration-200 overflow-hidden cursor-pointer ${
            hoveredIndex === 0 && !exitingRoute
              ? 'border-maroon dark:border-golden border-l-maroon dark:border-l-golden -translate-y-1 bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgba(123,17,19,0.08)] z-10' 
              : hoveredIndex === 1 && !exitingRoute
                ? 'border-zinc-300 dark:border-zinc-800 border-l-zinc-300 dark:border-l-zinc-700 opacity-40 bg-white/70 dark:bg-zinc-900/40'
                : 'border-zinc-300 dark:border-zinc-800 border-l-maroon dark:border-l-golden bg-white dark:bg-zinc-900/60 shadow-none'
          }`}
        >
          {/* Subtle hover background highlight */}
          <div className="absolute inset-0 bg-maroon/[0.02] dark:bg-golden/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
          
          <div className="relative z-10 flex flex-row items-center gap-3 sm:gap-4 md:gap-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-none bg-maroon/5 dark:bg-golden/5 flex items-center justify-center shrink-0 border border-maroon/20 dark:border-golden/20 group-hover:bg-maroon dark:group-hover:bg-golden group-hover:scale-105 transition-all duration-200">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-maroon dark:text-golden group-hover:text-white dark:group-hover:text-maroon-dark transition-colors duration-200" strokeWidth={1.5} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                <h2 className="text-base sm:text-xl md:text-2xl font-heading font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-maroon dark:group-hover:text-golden transition-colors duration-200">
                  Student Portal
                </h2>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-none border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center group-hover:bg-maroon group-hover:border-maroon dark:group-hover:bg-golden dark:group-hover:border-golden transition-colors duration-200 shrink-0">
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-white dark:group-hover:text-maroon-dark group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-sans mt-1 sm:mt-2 leading-relaxed line-clamp-2 md:line-clamp-none">
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
          className={`group relative w-full text-left rounded-none border border-l-4 p-3.5 sm:p-6 md:p-8 transition-all duration-200 overflow-hidden cursor-pointer ${
            hoveredIndex === 1 && !exitingRoute
              ? 'border-maroon dark:border-golden border-l-maroon dark:border-l-golden -translate-y-1 bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgba(123,17,19,0.08)] z-10' 
              : hoveredIndex === 0 && !exitingRoute
                ? 'border-zinc-300 dark:border-zinc-800 border-l-zinc-300 dark:border-l-zinc-700 opacity-40 bg-white/70 dark:bg-zinc-900/40'
                : 'border-zinc-300 dark:border-zinc-800 border-l-maroon dark:border-l-golden bg-white dark:bg-zinc-900/60 shadow-none'
          }`}
        >
          {/* Subtle hover background highlight */}
          <div className="absolute inset-0 bg-maroon/[0.02] dark:bg-golden/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
          
          <div className="relative z-10 flex flex-row items-center gap-3 sm:gap-4 md:gap-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-none bg-maroon/5 dark:bg-golden/5 flex items-center justify-center shrink-0 border border-maroon/20 dark:border-golden/20 group-hover:bg-maroon dark:group-hover:bg-golden group-hover:scale-105 transition-all duration-200">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-maroon dark:text-golden group-hover:text-white dark:group-hover:text-maroon-dark transition-colors duration-200" strokeWidth={1.5} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                <h2 className="text-base sm:text-xl md:text-2xl font-heading font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-maroon dark:group-hover:text-golden transition-colors duration-200">
                  Faculty Portal
                </h2>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-none border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center group-hover:bg-maroon group-hover:border-maroon dark:group-hover:bg-golden dark:group-hover:border-golden transition-colors duration-200 shrink-0">
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-white dark:group-hover:text-maroon-dark group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-sans mt-1 sm:mt-2 leading-relaxed line-clamp-2 md:line-clamp-none">
                Configure sections, activate live QR check-ins, resolve disputed statuses, and extract detailed attendance analytics.
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="mt-4 sm:mt-8 md:mt-12 text-center md:text-left animate-fade-in-up delay-300">
        <p className="text-[10px] font-sans font-bold uppercase tracking-[0.25em] text-zinc-400/75 dark:text-zinc-500/75 leading-relaxed">
          Polytechnic University of the Philippines &bull; Attendance System
        </p>
      </div>
      
    </div>
  )
}
