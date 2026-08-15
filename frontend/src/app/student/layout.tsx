import { SessionGuard } from '@/components/auth/SessionGuard'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <SessionGuard area="student">{children}</SessionGuard>
}
