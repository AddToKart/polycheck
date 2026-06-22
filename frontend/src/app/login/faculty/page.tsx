'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, Lock, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/mock-api'
import ThemeToggle from '@/components/ThemeToggle'

function PupStar({ className }: { className?: string }) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[16px] border-b-golden relative">
        <div className="absolute -top-[5px] -left-[10px] w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-golden"></div>
      </div>
    </div>
  )
}

export default function FacultyLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    const user = api.loginFaculty(email, password)
    if (user) {
      router.push('/faculty')
    } else {
      setError('Invalid email or password.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background selection:bg-golden selection:text-maroon">
      {/* Left Context Panel */}
      <div className="relative w-full lg:w-5/12 bg-maroon flex flex-col justify-between p-8 md:p-12 lg:p-16 text-white border-b lg:border-b-0 lg:border-r border-maroon-dark overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div className="w-full h-full" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, #F5A800 1px, transparent 1px), radial-gradient(circle at 75% 75%, #F5A800 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />
        </div>

        <div className="relative z-10">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-golden hover:text-white transition-colors uppercase tracking-widest font-semibold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Index
          </Link>
        </div>

        <div className="relative z-10 my-16 lg:my-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-[56px] h-[56px] shrink-0 bg-white p-1 shadow-lg">
              <Image src="/pup-logo.png" alt="PUP" width={56} height={56} className="object-contain" />
            </div>
            <div>
              <p className="text-[9px] font-sans font-bold uppercase tracking-[0.15em] text-white/70">PUP</p>
              <p className="text-xs font-sans font-semibold uppercase tracking-[0.1em] text-golden">Faculty Portal</p>
            </div>
          </div>

          <div className="w-12 h-[2px] bg-golden mb-6" />

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold text-golden leading-tight tracking-tighter mb-4">
            Welcome<br/>back.
          </h1>
          <p className="text-base md:text-lg font-sans text-white/80 max-w-sm leading-relaxed">
            Manage your classes, track attendance, and handle course administration.
          </p>

          <div className="flex items-center gap-2 mt-6">
            <PupStar className="scale-[0.5] origin-left" />
            <span className="text-xs font-sans text-golden/60 uppercase tracking-[0.2em] italic">Iskolar ng Bayan</span>
          </div>
        </div>

        <div className="relative z-10 hidden lg:block text-sm font-sans text-white/50 uppercase tracking-widest">
          Polycheck \ 1904
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="relative w-full lg:w-7/12 flex flex-col h-full min-h-[60vh] lg:min-h-screen bg-background">
        <div className="absolute top-6 right-6 z-10">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center p-8 md:p-12 lg:p-16">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-[10px] font-sans font-bold uppercase tracking-[0.25em] text-zinc-400 mb-2">Authentication Required</p>
              <h2 className="text-3xl font-heading font-bold text-foreground">Sign In</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 rounded-none bg-red-50 dark:bg-red-900/20 border-l-4 border-red-600 text-red-700 dark:text-red-400 text-sm font-medium">
                  {error}
                </div>
              )}
              
              <div className="space-y-3">
                <Label htmlFor="email" className="uppercase tracking-widest text-xs text-zinc-500">Email Address</Label>
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-r-0 border-zinc-200 dark:border-zinc-700">
                    <Mail className="w-5 h-5 text-zinc-500" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="faculty@pup.edu.ph"
                    className="pl-16 h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-lg rounded-none focus-visible:ring-maroon dark:focus-visible:ring-golden"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="password" className="uppercase tracking-widest text-xs text-zinc-500">Password</Label>
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-r-0 border-zinc-200 dark:border-zinc-700">
                    <Lock className="w-5 h-5 text-zinc-500" />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-16 h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-lg rounded-none focus-visible:ring-maroon dark:focus-visible:ring-golden"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full h-12 text-base font-bold tracking-wide uppercase bg-maroon hover:bg-maroon-dark text-white rounded-none transition-all duration-300 relative overflow-hidden group"
                >
                  <span className="relative z-10">{loading ? 'Verifying...' : 'Authenticate'}</span>
                  <div className="absolute inset-0 bg-black/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                </Button>
              </div>
            </form>
            
            <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Demo Credentials: Use any email (e.g.{' '}
                <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 text-foreground">admin@pup.edu.ph</span>)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
