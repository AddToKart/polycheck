import type { AiCapabilities, User } from '@polycheck/shared'

export type AssistantEntryRole = User['role']

/**
 * Entry-point visibility for the assistant (institution-settings IS4, plan
 * Decision 5). Mirrors the web surface rules:
 *
 * - unknown capabilities (request failed / not loaded) → hidden
 * - policy-blocked (master off, or role toggle off) → hidden for everyone
 * - enabled → visible
 * - unconfigured → visible only to super admins (who can fix it)
 *
 * Teachers/students never see a setup affordance they cannot act on.
 */
export function shouldShowAssistantEntry(
  role: AssistantEntryRole | null | undefined,
  capabilities: AiCapabilities | null | undefined,
): boolean {
  if (!role || !capabilities) return false
  if (capabilities.policyBlocked) return false
  if (capabilities.enabled) return true
  return role === 'super_admin'
}
