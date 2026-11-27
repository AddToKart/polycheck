import { CAMPUS_COURSES } from '@polycheck/shared'
import { STUDENT_SYSTEM_PROMPT, SUPER_ADMIN_SYSTEM_PROMPT, TEACHER_SYSTEM_PROMPT, systemPromptFor } from './ai-prompts'

describe('AI system prompts', () => {
  it('selects the teacher prompt with scope, privacy, and language rules', () => {
    const sent = systemPromptFor('teacher')
    expect(sent.startsWith(TEACHER_SYSTEM_PROMPT)).toBe(true)
    // The same courses the student form offers, and no others to invent.
    for (const course of CAMPUS_COURSES) expect(sent).toContain(`${course.code} (${course.name})`)
    expect(TEACHER_SYSTEM_PROMPT).toContain('own sections')
    expect(TEACHER_SYSTEM_PROMPT).toContain('never invent data')
    expect(TEACHER_SYSTEM_PROMPT).toContain('do not recite student names')
    expect(TEACHER_SYSTEM_PROMPT).toContain('PDF by default')
    expect(TEACHER_SYSTEM_PROMPT).toContain('find_sections with no query')
    expect(TEACHER_SYSTEM_PROMPT).toContain('Filipino')
  })

  it('selects the super-admin prompt with administrative scope and admin-only tools', () => {
    const sent = systemPromptFor('super_admin')
    expect(sent.startsWith(SUPER_ADMIN_SYSTEM_PROMPT)).toBe(true)
    // The same courses the student form offers, and no others to invent.
    for (const course of CAMPUS_COURSES) expect(sent).toContain(`${course.code} (${course.name})`)
    expect(SUPER_ADMIN_SYSTEM_PROMPT).toContain('administrative scope')
    expect(SUPER_ADMIN_SYSTEM_PROMPT).toContain('audited')
    expect(SUPER_ADMIN_SYSTEM_PROMPT).toContain('never invent data')
    expect(SUPER_ADMIN_SYSTEM_PROMPT).toContain('NO personal sections')
    expect(SUPER_ADMIN_SYSTEM_PROMPT).toContain('get_institution_overview')
    expect(SUPER_ADMIN_SYSTEM_PROMPT).toContain('find_users')
    expect(SUPER_ADMIN_SYSTEM_PROMPT).toContain('get_recent_audit_activity')
    expect(SUPER_ADMIN_SYSTEM_PROMPT).toContain('User Management')
  })

  it('selects the student prompt with read-only, own-data, and no-guarantee rules', () => {
    expect(systemPromptFor('student')).toBe(STUDENT_SYSTEM_PROMPT)
    expect(STUDENT_SYSTEM_PROMPT).toContain('strictly read-only')
    expect(STUDENT_SYSTEM_PROMPT).toContain('Never guarantee a passing outcome')
    expect(STUDENT_SYSTEM_PROMPT).toContain('you will pass')
    expect(STUDENT_SYSTEM_PROMPT).toContain('Never reveal other students')
    expect(STUDENT_SYSTEM_PROMPT).toContain('Never reveal geofence coordinates')
    expect(STUDENT_SYSTEM_PROMPT).toContain('Never invent professor emails')
    expect(STUDENT_SYSTEM_PROMPT).toContain('no file-export tools')
    expect(STUDENT_SYSTEM_PROMPT).toContain('Filipino')
  })
})
