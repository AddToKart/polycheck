import type { AssistantRole } from './assistant-utils'

/**
 * Empty-state prompt suggestions for the assistant composer. Each role gets
 * prompts that match its actual tool access: teachers stay inside their own
 * sections, administrators get institution-wide lookups, students get own-data
 * guidance (no institution or file-extraction wording).
 */
export const FACULTY_STARTER_PROMPTS: string[] = [
  'List my sections',
  'Extract my section’s master list (PDF)',
  'Show attendance for my last session',
  'Export my last session attendance (CSV)',
]

export const SUPER_ADMIN_STARTER_PROMPTS: string[] = [
  'Give me an institution overview',
  'Who are the disabled accounts?',
  'Show recent audit activity',
  'Extract a section master list (PDF)',
]

export const STUDENT_STARTER_PROMPTS: string[] = [
  'Why was I marked absent recently?',
  'What is my attendance standing in each subject?',
  'Draft a message to my professor.',
  'How do I enroll in a subject?',
]

interface AssistantRoleCopy {
  /** Header eyebrow and launcher tooltip, e.g. "Faculty assistant". */
  eyebrow: string
  /** Accessible name for the floating bubble. */
  bubbleAriaLabel: string
  emptyTitle: string
  emptyDescription: string
  can: string[]
  cant: string[]
}

export const ASSISTANT_ROLE_COPY: Record<AssistantRole, AssistantRoleCopy> = {
  super_admin: {
    eyebrow: 'Administrative assistant',
    bubbleAriaLabel: 'Open administrative assistant',
    emptyTitle: 'Ask about the institution',
    emptyDescription:
      'Get an institution overview, find accounts, review recent audit activity, or prepare section exports. Every lookup stays inside your administrative scope.',
    can: ['Institution overview', 'Account lookup', 'Audit activity', 'Section exports'],
    cant: ['Create or disable accounts', 'Change attendance or settings'],
  },
  teacher: {
    eyebrow: 'Faculty assistant',
    bubbleAriaLabel: 'Open faculty assistant',
    emptyTitle: 'Ask about your classes',
    emptyDescription:
      'Find a section, review session attendance, or generate a master list. The assistant only reads records you can already access.',
    can: ['Your own sections and rosters', 'Session attendance', 'Master lists', 'Attendance exports'],    cant: ['Other teachers’ classes', 'Institution-wide data'],
  },
  student: {
    eyebrow: 'Student assistant',
    bubbleAriaLabel: 'Open student assistant',
    emptyTitle: 'Ask about your attendance',
    emptyDescription:
      'Understand an attendance mark, check your standing, or draft a message to your professor. The assistant only reads your own records.',
    can: ['Explain your attendance marks', 'Check your standing', 'Draft a professor message'],
    cant: ['Change records or files', 'Geofencing details'],
  },
}

export function starterPromptsFor(role: AssistantRole): string[] {
  if (role === 'super_admin') return SUPER_ADMIN_STARTER_PROMPTS
  if (role === 'student') return STUDENT_STARTER_PROMPTS
  return FACULTY_STARTER_PROMPTS
}
