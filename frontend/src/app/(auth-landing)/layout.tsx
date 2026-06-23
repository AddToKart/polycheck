'use client'

import { createContext, useContext, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

// Shared Landing Layout Context
const LandingContext = createContext<{
  hoveredIndex: number | null
  setHoveredIndex: (idx: number | null) => void
  exitingRoute: string | null
  setExitingRoute: (route: string | null) => void
}>({
  hoveredIndex: null,
  setHoveredIndex: () => {},
  exitingRoute: null,
  setExitingRoute: () => {}
})

export const useLanding = () => useContext(LandingContext)

function PupStar({ className, darkColor }: { className?: string; darkColor?: boolean }) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <div className={`w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[20px] relative ${
        darkColor ? 'border-b-golden dark:border-b-maroon-dark' : 'border-b-golden'
      }`}>
        <div className={`absolute -top-[6px] -left-[12px] w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] ${
          darkColor ? 'border-t-golden dark:border-t-maroon-dark' : 'border-t-golden'
        }`}></div>
      </div>
    </div>
  )
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [exitingRoute, setExitingRoute] = useState<string | null>(null)

  const isStudentLogin = pathname === '/login/student'
  const isFacultyLogin = pathname === '/login/faculty'
  const isLogin = isStudentLogin || isFacultyLogin

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault()
    setExitingRoute('/')
    setTimeout(() => {
      router.push('/')
      setExitingRoute(null)
    }, 280) // Snappy 280ms delay
  }

  return (
    <LandingContext.Provider value={{ hoveredIndex, setHoveredIndex, exitingRoute, setExitingRoute }}>
      <div className="min-h-screen flex flex-col md:flex-row bg-background selection:bg-golden selection:text-maroon overflow-y-auto md:overflow-hidden relative">
        
        {/* Global Floating Theme Toggle */}
        <div className="absolute top-6 right-6 z-30">
          <ThemeToggle />
        </div>
        
        {/* Left Branding Panel */}
        <div className={`relative flex flex-col justify-between p-8 md:p-12 lg:p-16 text-white border-b md:border-b-0 overflow-hidden transition-all duration-300 ease-in-out bg-maroon dark:bg-golden shrink-0 ${
          isLogin 
            ? 'left-panel-login border-zinc-800/50' 
            : 'left-panel-home border-zinc-200 dark:border-zinc-800/50'
        }`}>
          
          {/* Responsive Divider Slide Glows */}
          {/* Mobile Horizontal Divider */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-zinc-200/50 dark:bg-zinc-800/30 md:hidden overflow-hidden">
            <div 
              className="absolute top-0 h-[2px] w-24 bg-golden dark:bg-maroon-dark transition-all duration-300 ease-out"
              style={{
                left: hoveredIndex === 0 ? '25%' : hoveredIndex === 1 ? '75%' : '50%',
                transform: 'translateX(-50%)',
                opacity: hoveredIndex !== null && !exitingRoute ? 1 : 0
              }}
            />
          </div>
          
          {/* Desktop Vertical Divider */}
          <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-zinc-200/50 dark:bg-zinc-800/30 hidden md:block overflow-hidden">
            <div 
              className="absolute left-0 w-[2px] h-40 bg-golden dark:bg-maroon-dark transition-all duration-300 ease-out"
              style={{
                top: hoveredIndex === 0 ? '30%' : hoveredIndex === 1 ? '70%' : '50%',
                transform: 'translateY(-50%)',
                opacity: hoveredIndex !== null && !exitingRoute ? 1 : 0
              }}
            />
          </div>

          {/* Persistent Sliding PUP Logo */}
          <div className={`absolute rounded-full bg-white dark:bg-maroon-dark border shadow-md flex items-center justify-center p-1.5 transition-all duration-300 ease-in-out hover:scale-105 z-20 ${
            isLogin ? 'logo-login border-golden/50 dark:border-maroon/20 shadow-golden/10' : 'logo-home border-zinc-200/50 dark:border-maroon/20'
          }`}>
            <div className="relative w-full h-full">
              <Image
                src="/pup-logo.png"
                alt="PUP Logo"
                fill
                className="object-contain p-0.5"
                priority
              />
            </div>
          </div>

          {/* Persistent Sliding Header Text Container */}
          <div className={`absolute right-16 md:right-4 transition-all duration-300 ease-in-out h-16 flex items-center ${
            isLogin ? 'header-text-login' : 'header-text-home'
          }`}>
            <div className="relative w-full h-full flex items-center">
              {/* Home Header Text */}
              <div className={`absolute left-0 transition-all duration-300 flex flex-col justify-center whitespace-nowrap ${
                !isLogin ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'
              }`}>
                <p className="text-[10px] font-sans font-bold uppercase tracking-[0.25em] text-golden/90 dark:text-maroon/80 leading-tight">
                  Republic of the Philippines
                </p>
                <h2 className="text-xs md:text-sm font-sans font-bold uppercase tracking-[0.18em] text-white dark:text-maroon-dark leading-tight mt-1">
                  Polytechnic University<br/>of the Philippines
                </h2>
              </div>

              {/* Login Header Text */}
              <div className={`absolute left-0 transition-all duration-300 flex flex-col justify-center whitespace-nowrap ${
                isLogin ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
              }`}>
                <p className="text-[9px] font-sans font-bold uppercase tracking-[0.15em] text-white/70 dark:text-maroon/60">PUP</p>
                <p className="text-xs font-sans font-semibold uppercase tracking-[0.1em] text-golden dark:text-maroon-dark">
                  {isFacultyLogin ? 'Faculty Portal' : 'Student Access'}
                </p>
              </div>
            </div>
          </div>

          {/* Top: Back Link (only in Login mode) */}
          <div className="h-16 flex items-center relative z-10">
            <div className={`transition-all duration-300 ${
              isLogin ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 pointer-events-none'
            }`}>
              <a
                href="/"
                onClick={handleBack}
                className="inline-flex items-center text-sm text-golden dark:text-maroon-dark hover:text-white dark:hover:text-black transition-colors uppercase tracking-widest font-semibold cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Index
              </a>
            </div>
          </div>

          {/* Center: Branding Content (Transitions between Home & Login text) */}
          <div className={`relative z-10 flex flex-col justify-center mt-24 mb-12 md:my-0 md:h-80 lg:h-96 shrink-0 transition-all duration-300 ${
            isLogin ? 'h-40' : 'h-64'
          }`}>
            
            {/* Home Branding Content */}
            <div className={`absolute inset-0 flex flex-col justify-center transition-all duration-300 ease-in-out ${
              !isLogin ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'
            }`}>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-[2px] bg-golden/70 dark:bg-maroon-dark/30" />
                <PupStar className={`origin-left animate-float transition-all duration-300 ${
                  hoveredIndex === 0 ? 'scale-[0.65]' : hoveredIndex === 1 ? 'scale-[0.45] opacity-50' : 'scale-[0.55]'
                }`} darkColor />
              </div>
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-heading font-bold text-golden dark:text-maroon-dark leading-[0.95] tracking-tighter mb-6">
                Polycheck.
              </h1>
              <p className="text-base md:text-lg font-sans text-zinc-100/80 dark:text-maroon-dark/90 max-w-md leading-relaxed mb-8">
                A premium, unified attendance system built for PUP. Digitized class tracking with secure geolocation and offline-first capabilities.
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-[1px] bg-golden/30 dark:bg-maroon-dark/20" />
                <span className="text-xs font-sans font-semibold text-golden dark:text-maroon-dark tracking-[0.3em] uppercase italic">
                  Iskolar ng Bayan
                </span>
                <div className="w-8 h-[1px] bg-golden/30 dark:bg-maroon-dark/20" />
              </div>
            </div>

            {/* Faculty Login Branding Content */}
            <div className={`absolute inset-0 flex flex-col justify-center transition-all duration-300 ease-in-out ${
              isFacultyLogin ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
            }`}>
              <div className="w-12 h-[2px] bg-golden dark:bg-maroon-dark/30 mb-6" />
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold text-golden dark:text-maroon-dark leading-tight tracking-tighter mb-4">
                Welcome<br/>back.
              </h1>
              <p className="text-base md:text-lg font-sans text-white/80 dark:text-maroon-dark/90 max-w-sm leading-relaxed mb-6 hidden md:block">
                Manage your classes, track attendance, and handle course administration.
              </p>
              <div className="flex items-center gap-2">
                <PupStar className="scale-[0.5] origin-left" darkColor />
                <span className="text-xs font-sans text-golden/60 dark:text-maroon-dark/70 uppercase tracking-[0.2em] italic">Iskolar ng Bayan</span>
              </div>
            </div>

            {/* Student Login Branding Content */}
            <div className={`absolute inset-0 flex flex-col justify-center transition-all duration-300 ease-in-out ${
              isStudentLogin ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
            }`}>
              <div className="w-12 h-[2px] bg-golden dark:bg-maroon-dark/30 mb-6" />
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold text-golden dark:text-maroon-dark leading-tight tracking-tighter mb-4">
                Student<br/>Access.
              </h1>
              <p className="text-base md:text-lg font-sans text-white/80 dark:text-maroon-dark/90 max-w-sm leading-relaxed mb-6 hidden md:block">
                Enter your credentials to view your attendance records and course status.
              </p>
              <div className="flex items-center gap-2">
                <PupStar className="scale-[0.5] origin-left" darkColor />
                <span className="text-xs font-sans text-golden/60 dark:text-maroon-dark/70 uppercase tracking-[0.2em] italic">Iskolar ng Bayan</span>
              </div>
            </div>

          </div>

          {/* Bottom: Tagline + Year */}
          <div className={`relative z-10 flex items-center justify-between text-xs font-sans uppercase tracking-[0.2em] text-white/50 dark:text-maroon-dark/60 animate-fade-in-up delay-500 ${
            isLogin ? 'hidden md:flex' : 'flex'
          }`}>
            <span>PUP System</span>
            <div className="flex items-center gap-3">
              <span>&#9679;</span>
              <span className="text-white/60 dark:text-maroon-dark/75">Est. 1904</span>
              <span>&#9679;</span>
              <span>v1.0</span>
            </div>
          </div>
        </div>

        {/* Right Interaction Panel wrapper */}
        <div className={`relative flex flex-col justify-center h-auto min-h-[60vh] md:min-h-screen bg-background transition-all duration-300 ease-in-out ${
          isLogin ? 'right-panel-login' : 'right-panel-home'
        }`}>
          {children}
        </div>
      </div>
    </LandingContext.Provider>
  )
}
