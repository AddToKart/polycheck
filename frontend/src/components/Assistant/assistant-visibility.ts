import type { AiCapabilities, UserRole } from '@polycheck/shared'

/**
 * Whether the assistant entry point (floating bubble, tab, More-sheet item)
 * should be rendered for a role.
 *
 * - Unknown capabilities → hide (never advertise a surface we cannot confirm).
 * - Policy-blocked → hide, including super admins when the master switch is off.
 * - Ready → show.
 * - Unconfigured → only super admins see it, so they can reach Institution
 *   Settings; teachers and students cannot fix missing configuration.
 */
export function shouldShowAssistantEntry(
  role: UserRole,
  capabilities: AiCapabilities | null,
): boolean {
  if (!capabilities) return false
  if (capabilities.policyBlocked) return false
  if (capabilities.enabled) return true
  return role === 'super_admin'
}
