import { SessionGuard } from '@/components/auth/SessionGuard'
import { AssistantLauncher } from '@/components/Assistant/AssistantLauncher'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard area="student">
      {children}
      <AssistantLauncher />
    </SessionGuard>
  )
}
