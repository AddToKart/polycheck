import { SessionGuard } from '@/components/auth/SessionGuard'
import { AssistantLauncher } from '@/components/Assistant/AssistantLauncher'

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard area="faculty">
      {children}
      <AssistantLauncher />
    </SessionGuard>
  )
}
