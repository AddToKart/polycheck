import { buildFacultyMoreItems } from '../lib/more-items'

const plainTeacher = { role: 'teacher' as const }
const itCoordinator = { role: 'teacher' as const, isItCoordinator: true }
const head = { role: 'teacher' as const, isDepartmentHead: true }
const registrar = { role: 'teacher' as const, isUserRegistrar: true }
const superAdmin = { role: 'super_admin' as const }

const base = { showAssistant: true, pendingExcuses: 2 }

function labels(user: Parameters<typeof buildFacultyMoreItems>[0]['user']): string[] {
  return buildFacultyMoreItems({ user, ...base }).map((item) => item.label)
}

describe('buildFacultyMoreItems', () => {
  it('keeps the plain teacher sheet unchanged', () => {
    const items = labels(plainTeacher)
    expect(items).toEqual(
      expect.arrayContaining(['Schedule', 'Attendance', 'Excuses', 'Report an Issue', 'Search', 'Assistant']),
    )
    expect(items).not.toContain('Server Status')
    expect(items).not.toContain('Department Reports')
    expect(items).not.toContain('At-Risk Students')
    expect(items).not.toContain('User Management')
  })

  it('adds the IT Operations suite for an IT coordinator', () => {
    const items = buildFacultyMoreItems({ user: itCoordinator, ...base })
    expect(items.map((item) => item.label)).toEqual(
      expect.arrayContaining(['Server Status', 'Issue Reports', 'Maintenance Controls']),
    )
    expect(items.find((item) => item.label === 'Server Status')?.route).toBe('/(faculty)/server-status')
    expect(items.find((item) => item.label === 'Maintenance Controls')?.route).toBe('/(faculty)/settings')
  })

  it('adds academic oversight without duplicating Excuses', () => {
    const items = labels(head)
    expect(items).toEqual(expect.arrayContaining(['Department Reports', 'At-Risk Students']))
    expect(items.filter((label) => label === 'Excuses')).toHaveLength(1)
    expect(items).not.toContain('Server Status')
  })

  it('adds user management for a registrar', () => {
    expect(labels(registrar)).toContain('User Management')
  })

  it('supports a dual-hat teacher and keeps assistant policy filtering', () => {
    const dual = { role: 'teacher' as const, isItCoordinator: true, isDepartmentHead: true, isUserRegistrar: true }
    expect(labels(dual)).toEqual(
      expect.arrayContaining(['Server Status', 'Department Reports', 'User Management']),
    )
    const withoutAssistant = buildFacultyMoreItems({
      user: dual,
      showAssistant: false,
      pendingExcuses: 0,
    }).map((item) => item.label)
    expect(withoutAssistant).not.toContain('Assistant')
  })

  it('keeps the super-admin sheet as the unchanged console list', () => {
    const items = buildFacultyMoreItems({ user: superAdmin, ...base })
    const labels = items.map((item) => item.label)
    expect(labels).toEqual(
      expect.arrayContaining(['Global Search', 'Institution Settings', 'Audit Log', 'System Reports', 'Assistant']),
    )
    expect(labels).not.toContain('At-Risk Students')
    expect(labels).not.toContain('Server Status')
  })
})
