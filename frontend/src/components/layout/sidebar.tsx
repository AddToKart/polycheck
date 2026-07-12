'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { User } from '@polycheck/shared'
import {
  LayoutDashboard,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Calendar,
  Gavel,
  Users,
  BarChart3,
  ArrowLeft,
  LogOut,
  Menu,
  X,
  Clock,
  Search,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ThemeToggle'

type NavItem = { label: string; href: string; icon: any }

// Navigation for students
const studentNav: NavItem[] = [
  { label: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
  { label: 'My Subjects', href: '/student/dashboard?tab=subjects', icon: BookOpen },
  { label: 'Schedule', href: '/student/schedule', icon: Calendar },
  { label: 'Attendance History', href: '/student/dashboard?tab=attendance', icon: Clock },
]

// Navigation for standard teachers
const teacherNav: NavItem[] = [
  { label: 'Dashboard', href: '/faculty', icon: LayoutDashboard },
  { label: 'My Subjects', href: '/faculty/subjects', icon: BookOpen },
  { label: 'Class Sessions', href: '/faculty/sessions', icon: CalendarCheck },
  { label: 'Attendance Log', href: '/faculty/attendance', icon: ClipboardList },
  { label: 'Schedule', href: '/faculty/schedule', icon: Calendar },
  { label: 'Disputes', href: '/faculty/disputes', icon: Gavel },
  { label: 'Search', href: '/faculty/search', icon: Search },
]

// Navigation for super admins
const superAdminNav: NavItem[] = [
  { label: 'Dashboard', href: '/faculty', icon: LayoutDashboard },
  { label: 'My Subjects', href: '/faculty/subjects', icon: BookOpen },
  { label: 'Class Sessions', href: '/faculty/sessions', icon: CalendarCheck },
  { label: 'Attendance Log', href: '/faculty/attendance', icon: ClipboardList },
  { label: 'Schedule', href: '/faculty/schedule', icon: Calendar },
  { label: 'Disputes', href: '/faculty/disputes', icon: Gavel },
  { label: 'Search', href: '/faculty/search', icon: Search },
  { label: 'User Management', href: '/faculty/users', icon: Users },
  { label: 'System Reports', href: '/faculty/reports', icon: BarChart3 },
]

interface SidebarProps {
  user: User
  onLogout: () => void
  backHref?: string
  backLabel?: string
}

export function Sidebar({ user, onLogout, backHref, backLabel }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTabQuery = searchParams.get('tab')
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const isSuper = user.role === 'super_admin'
  const showSearch = !backHref && (user.role === 'teacher' || user.role === 'super_admin')
  
  const items = backHref
    ? []
    : user.role === 'student'
      ? studentNav
      : isSuper
        ? superAdminNav
        : teacherNav

  const homeHref = user.role === 'student' ? '/student/dashboard' : '/faculty'

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-maroon dark:bg-golden text-white dark:text-maroon-dark">
        <div>
          <Link href={homeHref} onClick={() => setIsOpen(false)}>
            <h1 className="text-2xl font-heading font-bold tracking-tight text-golden dark:text-maroon-dark">
              Polycheck
            </h1>
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-white/70 dark:text-maroon-dark/80 mt-1">
            {user.role === 'student' ? 'Student' : isSuper ? 'Super Admin' : 'Faculty'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <img src="/pup-logo.png" alt="PUP Logo" className="w-8 h-8 shrink-0 object-contain" />
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden p-1 rounded-none hover:bg-white/10 text-white dark:text-maroon-dark transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {/* Global Search — faculty only */}
        {showSearch && (
          <div className="px-4 mb-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (searchQuery.trim()) {
                  router.push(`/faculty/search?q=${encodeURIComponent(searchQuery.trim())}`)
                  setIsOpen(false)
                }
              }}
              className="relative"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students, sections…"
                className="w-full h-8 pl-8 pr-3 text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-foreground placeholder:text-zinc-400 focus:outline-none focus:border-maroon dark:focus:border-golden transition-colors"
                aria-label="Global search"
              />
            </form>
          </div>
        )}
        {backHref && backLabel && (
          <div className="px-4 mb-4">
            <Button variant="outline" className="w-full justify-start gap-3 border-zinc-300 dark:border-zinc-700" asChild>
              <Link href={backHref} onClick={() => setIsOpen(false)}>
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span className="uppercase tracking-widest text-xs font-bold">{backLabel}</span>
              </Link>
            </Button>
          </div>
        )}
        <div className="flex flex-col">
          {items.map((item) => {
            const Icon = item.icon
            let isActive = false
            if (item.href.includes('?tab=')) {
              const tabValue = item.href.split('?tab=')[1]
              isActive = pathname === '/student/dashboard' && activeTabQuery === tabValue
            } else if (item.href === '/student/dashboard') {
              isActive = pathname === '/student/dashboard' && !activeTabQuery
            } else if (item.href === '/faculty') {
              isActive = pathname === '/faculty'
            } else {
              isActive = pathname.startsWith(item.href)
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-4 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-all border-l-4 ${
                  isActive
                    ? 'border-maroon dark:border-golden bg-zinc-100 dark:bg-zinc-900 text-maroon dark:text-golden'
                    : 'border-transparent text-zinc-500 hover:text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-maroon dark:text-golden' : ''}`} strokeWidth={isActive ? 2.5 : 1.5} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between mb-6">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            Appearance
          </p>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-maroon flex items-center justify-center text-golden font-heading font-bold text-sm shrink-0 border border-maroon-dark">
            {user.fullName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground truncate">
              {user.fullName}
            </p>
            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 hover:text-white hover:bg-maroon hover:border-maroon transition-colors"
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4" />
          Disconnect
        </Button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Top Navigation Header */}
      <div className="md:hidden sticky top-0 z-30 w-full h-16 bg-maroon dark:bg-zinc-950 text-white dark:text-golden border-b border-zinc-300 dark:border-zinc-800 flex items-center justify-between px-6 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <img src="/pup-logo.png" alt="PUP Logo" className="w-6 h-6 shrink-0 object-contain" />
          <span className="font-heading font-bold text-lg tracking-tight">Polycheck</span>
        </div>
        <button 
          onClick={() => setIsOpen(true)}
          className="p-2 hover:bg-white/10 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-6 h-6 text-white dark:text-golden" />
        </button>
      </div>

      {/* Mobile Slide-Out Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsOpen(false)}
          />
          {/* Slide-out Menu Panel */}
          <aside className="relative w-64 bg-background border-r border-zinc-300 dark:border-zinc-800 flex flex-col h-full z-50 overflow-hidden animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-background border-r border-zinc-300 dark:border-zinc-800 flex flex-col shrink-0 h-dvh sticky top-0 overflow-hidden">
        {sidebarContent}
      </aside>
    </>
  )
}
