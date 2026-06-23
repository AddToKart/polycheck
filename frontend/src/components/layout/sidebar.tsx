'use client'

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
  const isSuper = user.role === 'super_admin'
  const items = backHref
    ? []
    : isSuper
      ? superAdminNav
      : teacherNav

  return (
    <aside className="w-64 bg-background border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0 h-dvh sticky top-0 overflow-hidden">
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-maroon dark:bg-golden text-white dark:text-maroon-dark">
        <div>
          <Link href="/faculty">
            <h1 className="text-2xl font-heading font-bold tracking-tight text-golden dark:text-maroon-dark">
              Polycheck
            </h1>
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-white/70 dark:text-maroon-dark/80 mt-1">Faculty</p>
        </div>
        {/* Minimal Star motif from PUP logo */}
        <div className="w-8 h-8 flex items-center justify-center shrink-0">
           <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-golden dark:border-b-maroon-dark relative before:content-[''] before:absolute before:-top-[4px] before:-left-[8px] before:w-0 before:h-0 before:border-l-[8px] before:border-l-transparent before:border-r-[8px] before:border-r-transparent before:border-t-[14px] before:border-t-golden dark:before:border-t-maroon-dark"></div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {backHref && backLabel && (
          <div className="px-4 mb-4">
            <Button variant="outline" className="w-full justify-start gap-3 border-zinc-300 dark:border-zinc-700" asChild>
              <Link href={backHref}>
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
    </aside>
  )
}
