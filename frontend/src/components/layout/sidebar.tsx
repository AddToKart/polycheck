'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@polycheck/shared'
import {
  LayoutDashboard,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Gavel,
  Users,
  BarChart3,
  ArrowLeft,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ThemeToggle'

type NavItem = { label: string; href: string; icon: typeof LayoutDashboard }

// Navigation for standard teachers
const teacherNav: NavItem[] = [
  { label: 'Dashboard', href: '/faculty', icon: LayoutDashboard },
  { label: 'My Subjects', href: '/faculty/subjects', icon: BookOpen },
  { label: 'Class Sessions', href: '/faculty/sessions', icon: CalendarCheck },
  { label: 'Attendance Log', href: '/faculty/attendance', icon: ClipboardList },
  { label: 'Disputes', href: '/faculty/disputes', icon: Gavel },
]

// Navigation for super admins
const superAdminNav: NavItem[] = [
  { label: 'Dashboard', href: '/faculty', icon: LayoutDashboard },
  { label: 'User Management', href: '/faculty/users', icon: Users },
  { label: 'Subject Management', href: '/faculty/subjects', icon: BookOpen },
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
  const [isOpen, setIsOpen] = useState(false)
  const isSuper = user.role === 'super_admin'
  const items = backHref
    ? []
    : isSuper
      ? superAdminNav
      : teacherNav

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-maroon dark:bg-golden text-white dark:text-maroon-dark">
        <div>
          <Link href="/faculty" onClick={() => setIsOpen(false)}>
            <h1 className="text-2xl font-heading font-bold tracking-tight text-golden dark:text-maroon-dark">
              Polycheck
            </h1>
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-white/70 dark:text-maroon-dark/80 mt-1">
            {isSuper ? 'Super Admin' : 'Faculty'}
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
            const isActive =
              item.href === '/faculty'
                ? pathname === '/faculty'
                : pathname.startsWith(item.href)
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
