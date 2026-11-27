/**
 * Terms shown before a person's first use of the AI assistant, and the daily
 * message limits a super admin controls.
 *
 * Every statement here must stay true to the code: what the assistant's tools
 * return (`backend/src/ai/ai-tool-registry.service.ts`), how long chats are kept
 * (`ai-chat.service.ts`) and what is audited (`ai-audit.service.ts`). Change the
 * version whenever the meaning changes, so people are asked again.
 * Mirrored in `polycheck_mobile/lib/src/core/constants/ai_terms.dart`.
 */
export const AI_TERMS_VERSION = '1.0'

export const AI_TERMS_TITLE = 'Before you use the AI assistant'

export const AI_TERMS_INTRO =
  'The assistant is optional. Please read how your information is handled, then choose whether to continue.'

export interface AiTermsSection {
  heading: string
  points: readonly string[]
}

export const AI_TERMS_SECTIONS: readonly AiTermsSection[] = [
  {
    heading: 'What is sent to the AI provider',
    points: [
      'Your message, earlier messages in the same chat, and the records the assistant looks up to answer you are sent to an outside AI provider chosen by your school.',
      'Students: your own subjects, your professor’s name and your own attendance figures.',
      'Teachers: details of your own classes and sessions, including your name, courses, rooms, schedules and attendance counts.',
      'Administrators: details of the classes they oversee, accounts they search for (such as name, email, student number and course) and recent activity entries with names.',
    ],
  },
  {
    heading: 'What the assistant is not given',
    points: [
      'Master lists and attendance files are made by PolyCheck. The contents of those files are not sent to the AI provider.',
      'PolyCheck does not give the assistant your password, your GPS location or your device details.',
    ],
  },
  {
    heading: 'What is kept, and by whom',
    points: [
      'The AI provider handles what it receives under its own terms and privacy policy. PolyCheck cannot control how long the provider keeps it.',
      'PolyCheck keeps each chat so you can return to it. A chat is deleted automatically 7 days after its last message, and you can delete it sooner.',
      'PolyCheck’s activity log records that the assistant was used, which look-ups ran and whether they worked. It does not record the text of your messages.',
      'PolyCheck does not sell your information and does not use your chats to train AI models.',
    ],
  },
  {
    heading: 'Using it responsibly',
    points: [
      'The assistant can make mistakes. Check important answers against your records.',
      'Do not type passwords or sensitive personal information into the chat.',
      'Your school sets how many messages you can send each day.',
      'If you do not agree, do not use the assistant. The rest of PolyCheck works the same.',
    ],
  },
]

export const AI_TERMS_ACCEPT_LABEL = 'I agree and continue'

/** Error code returned when a message is sent before the current terms are accepted. */
export const AI_TERMS_REQUIRED_CODE = 'ai_terms_required'

export const AI_TERMS_REQUIRED_MESSAGE =
  'Accept the AI assistant terms first. Open the assistant on the PolyCheck website, or update the app.'

export type AiLimitRole = 'student' | 'teacher' | 'super_admin'

/** Institution setting holding each role's daily message limit. */
export const AI_DAILY_LIMIT_SETTING_KEYS = {
  student: 'ai_daily_limit_student',
  teacher: 'ai_daily_limit_teacher',
  super_admin: 'ai_daily_limit_super_admin',
} as const satisfies Record<AiLimitRole, string>

/** Used until a super admin saves a value. */
export const AI_DAILY_LIMIT_DEFAULTS: Record<AiLimitRole, number> = {
  student: 10,
  teacher: 20,
  super_admin: 100,
}

/** 0 turns the assistant off for that role. */
export const AI_DAILY_LIMIT_MAX = 1000
