import { SessionGuard } from '@/components/auth/SessionGuard'

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return <SessionGuard area="faculty">{children}</SessionGuard>
}
