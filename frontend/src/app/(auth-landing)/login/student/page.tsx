'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IdCard, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/mock-api'
import { useLanding } from '../../layout'

export default function StudentLoginPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { exitingRoute } = useLanding()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await api.loginStudent(studentId, password)
      if (user) {
        router.push('/student/dashboard')
      } else {
        setError('Invalid student ID or password.')
      }
    } catch (err: any) {
      setError(err.message || 'Invalid student ID or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8 md:p-12 lg:p-16">
      <div className={`w-full max-w-md transition-all duration-300 ease-in-out ${
        exitingRoute ? 'opacity-0 translate-y-8 scale-[0.97]' : 'opacity-100 translate-y-0 animate-fade-in-up'
      }`}>
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
            <Label htmlFor="studentId" className="uppercase tracking-widest text-xs text-zinc-500">Student Number</Label>
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-r-0 border-zinc-200 dark:border-zinc-700">
                <IdCard className="w-5 h-5 text-zinc-500" />
              </div>
              <Input
                id="studentId"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="2024-00123-MN-0"
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
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-16 pr-12 h-12 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-lg rounded-none focus-visible:ring-maroon dark:focus-visible:ring-golden"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
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
            Demo Credentials: Use any ID (e.g.{' '}
            <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 text-foreground">2024-00123-MN-0</span>)
          </p>
        </div>
      </div>
    </div>
  )
}
