'use client'

import Image from 'next/image'
import { User, X } from 'lucide-react'
import type { Student } from '@polycheck/shared'
import { Card, CardContent } from '@/components/ui/card'
import { pupColors } from '@/lib/colors'

interface StudentDigitalIdProps {
  user: Student
  isOpen: boolean
  isFlipped: boolean
  onOpen: () => void
  onClose: () => void
  onFlip: () => void
}

export function StudentDigitalId({ user, isOpen, isFlipped, onOpen, onClose, onFlip }: StudentDigitalIdProps) {
  return (
    <>
      <Card className="lg:col-span-1 lg:sticky lg:top-8 rounded-none border-zinc-300 dark:border-zinc-800 shadow-none overflow-hidden flex flex-col relative bg-zinc-50 dark:bg-zinc-900/50">
        <div className="h-24 bg-maroon flex items-center justify-center relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: `radial-gradient(circle at center, ${pupColors.golden} 2px, transparent 2px)`, backgroundSize: '16px 16px' }}
          />
          <Image src="/pup-logo.png" width={64} height={64} alt="PUP Logo" className="w-16 h-16 absolute right-4 bottom-4 opacity-20 filter grayscale contrast-200" />
        </div>
        <div className="absolute top-12 left-6 w-24 h-24 bg-zinc-200 dark:bg-zinc-800 border-4 border-background flex items-center justify-center overflow-hidden">
          <User className="w-12 h-12 text-zinc-400" />
        </div>
        <CardContent className="pt-16 pb-6 px-6 flex-1 flex flex-col">
          <div className="mb-6">
            <h2 className="text-2xl font-heading font-bold text-foreground leading-tight">{user.fullName}</h2>
            <p className="text-xs font-mono font-bold text-maroon dark:text-golden uppercase tracking-widest mt-1">{user.studentId}</p>
          </div>
          <div className="space-y-4 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex-1">
            <div>
              <p className="text-[10px] text-zinc-400 mb-1">Academic Program</p>
              <p className="text-foreground">{user.program}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 mb-1">Year Level</p>
              <p className="text-foreground">Year {user.yearLevel}</p>
            </div>
          </div>
          <div className="mt-8 pt-4 border-t border-dashed border-zinc-300 dark:border-zinc-700 flex justify-between items-center">
            <button onClick={onOpen} className="group flex items-center gap-3 hover:opacity-80 transition-opacity w-full justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-maroon dark:group-hover:text-golden transition-colors">View Valid ID</span>
              <div className="w-8 h-8 rounded-none border-2 border-foreground flex items-center justify-center group-hover:border-maroon dark:group-hover:border-golden transition-colors">
                <div className="w-4 h-4 bg-foreground group-hover:bg-maroon dark:group-hover:bg-golden transition-colors" />
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm">
          <div className="relative w-full max-w-xl">
            <button onClick={onClose} className="absolute -top-12 right-0 p-2 text-zinc-500 hover:text-foreground transition-colors" aria-label="Close student ID">
              <X className="w-6 h-6" />
            </button>
            <div className="relative w-full aspect-[1.586/1] cursor-pointer group perspective-[2000px]" onClick={onFlip}>
              <div className={`w-full h-full relative transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] bg-white border-2 border-zinc-300 dark:border-zinc-700 shadow-2xl overflow-hidden flex flex-col">
                  <div className="bg-maroon p-3 flex justify-between items-center border-b-2 border-zinc-300 dark:border-zinc-700">
                    <div className="flex items-center gap-3">
                      <Image src="/pup-logo.png" width={32} height={32} alt="PUP Logo" className="w-8 h-8" />
                      <div>
                        <h3 className="text-[9px] font-heading font-bold text-golden uppercase tracking-widest leading-none mb-1">Republic of the Philippines</h3>
                        <h2 className="text-xs sm:text-sm font-heading font-bold text-white uppercase tracking-wider leading-none">Polytechnic University of the Philippines</h2>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex relative bg-[#fdfbf7] dark:bg-[#1a1a1a]">
                    <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'url(/pup-logo.png)', backgroundPosition: 'center', backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }} />
                    <div className="w-1/3 border-r-2 border-zinc-300 dark:border-zinc-700 p-4 flex flex-col items-center justify-center">
                      <div className="w-full aspect-[3/4] bg-white dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-700 mb-4 flex items-center justify-center relative overflow-hidden">
                        <User className="w-16 h-16 text-zinc-300 dark:text-zinc-600" />
                      </div>
                      <div className="text-center w-full mt-auto">
                        <div className="border-b-2 border-zinc-800 dark:border-zinc-400 mb-1 h-6 flex items-end justify-center"><span className="text-[8px] font-mono opacity-50 text-black dark:text-white">SIGNATURE</span></div>
                      </div>
                    </div>
                    <div className="w-2/3 p-5 relative z-10 flex flex-col justify-center">
                      <div className="mb-5"><p className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Student Number</p><p className="text-xl sm:text-2xl font-mono font-bold text-maroon dark:text-golden">{user.studentId}</p></div>
                      <div className="mb-5"><p className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Full Name</p><p className="text-lg sm:text-xl font-heading font-bold text-zinc-900 dark:text-white leading-tight uppercase">{user.fullName}</p></div>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div><p className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Program</p><p className="text-xs font-bold text-zinc-900 dark:text-white">{user.program}</p></div>
                        <div><p className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Validity</p><p className="text-xs font-bold text-zinc-900 dark:text-white">2026-2027</p></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white border-2 border-zinc-300 dark:border-zinc-700 shadow-2xl flex flex-col">
                  <div className="bg-zinc-900 h-14 w-full mt-6" />
                  <div className="p-6 flex-1 flex text-zinc-900">
                    <div className="w-2/3 pr-6 flex flex-col justify-between">
                      <div><h4 className="text-[10px] font-bold uppercase tracking-widest mb-2 text-maroon">Conditions of Use</h4><p className="text-[9px] leading-relaxed text-zinc-600 mb-4 text-justify">This card is non-transferable and must be presented upon entry to the university premises. The finder of this lost card is requested to surrender it to the Office of Student Affairs.</p></div>
                      <div className="mt-auto"><p className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">In case of emergency, contact:</p><div className="border-b border-zinc-400 h-6" /><div className="border-b border-zinc-400 h-6 mt-2" /></div>
                    </div>
                    <div className="w-1/3 flex flex-col items-center justify-center border-l-2 border-dashed border-zinc-300 pl-6">
                      <div className="w-full aspect-square bg-zinc-100 border-2 border-zinc-300 flex items-center justify-center p-2">
                        <div className="grid grid-cols-5 grid-rows-5 w-full h-full gap-[1px]">
                          {Array.from({ length: 25 }).map((_, index) => <div key={index} className={`bg-zinc-900 ${(index * 17 + 5) % 3 === 0 ? 'opacity-100' : 'opacity-0'}`} />)}
                        </div>
                      </div>
                      <p className="text-[7px] font-mono mt-3 text-zinc-500 text-center tracking-widest">SCAN TO VERIFY</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-zinc-500 font-bold uppercase tracking-widest mt-8 animate-pulse">Click card to flip</p>
          </div>
        </div>
      ) : null}
    </>
  )
}
