import { describe, expect, it } from 'vitest'
import {
  activeDesignations,
  canAccessAcademicOversight,
  canAccessItOperations,
  canAccessUserAdmin,
  hasDesignation,
  isMaintenanceExempt,
  oversightDepartment,
} from './designations'

const plainTeacher = { role: 'teacher' as const, department: 'CCIS' }

describe('designation helpers', () => {
  it('treats students as having no designations even if flags leak through', () => {
    const student = {
      role: 'student' as const,
      isItCoordinator: true,
      isDepartmentHead: true,
      isUserRegistrar: true,
    }
    expect(activeDesignations(student)).toEqual([])
    expect(canAccessItOperations(student)).toBe(false)
    expect(canAccessAcademicOversight(student)).toBe(false)
    expect(canAccessUserAdmin(student)).toBe(false)
    expect(isMaintenanceExempt(student)).toBe(false)
  })

  it('returns no capabilities for null users and plain teachers', () => {
    expect(activeDesignations(null)).toEqual([])
    expect(hasDesignation(null, 'it_operations')).toBe(false)
    expect(canAccessItOperations(plainTeacher)).toBe(false)
    expect(canAccessAcademicOversight(plainTeacher)).toBe(false)
    expect(canAccessUserAdmin(plainTeacher)).toBe(false)
    expect(isMaintenanceExempt(plainTeacher)).toBe(false)
    expect(oversightDepartment(plainTeacher)).toBeNull()
  })

  it('grants every suite implicitly to super admins without flags', () => {
    const superAdmin = { role: 'super_admin' as const }
    expect(activeDesignations(superAdmin)).toEqual(['it_operations', 'academic_oversight', 'user_admin'])
    expect(canAccessItOperations(superAdmin)).toBe(true)
    expect(canAccessAcademicOversight(superAdmin)).toBe(true)
    expect(canAccessUserAdmin(superAdmin)).toBe(true)
    expect(isMaintenanceExempt(superAdmin)).toBe(true)
    // Super admins are not department-pinned; their scope comes from admin-scope.
    expect(oversightDepartment(superAdmin)).toBeNull()
  })

  it('grants only the IT suite to an IT coordinator', () => {
    const coordinator = { role: 'teacher' as const, isItCoordinator: true, department: 'CCIS' }
    expect(canAccessItOperations(coordinator)).toBe(true)
    expect(isMaintenanceExempt(coordinator)).toBe(true)
    expect(canAccessAcademicOversight(coordinator)).toBe(false)
    expect(canAccessUserAdmin(coordinator)).toBe(false)
    expect(activeDesignations(coordinator)).toEqual(['it_operations'])
  })

  it('grants only academic oversight to a department head, pinned to their department', () => {
    const head = { role: 'teacher' as const, isDepartmentHead: true, department: '  CCIS  ' }
    expect(canAccessAcademicOversight(head)).toBe(true)
    expect(canAccessItOperations(head)).toBe(false)
    expect(canAccessUserAdmin(head)).toBe(false)
    expect(isMaintenanceExempt(head)).toBe(false)
    expect(oversightDepartment(head)).toBe('CCIS')
    expect(activeDesignations(head)).toEqual(['academic_oversight'])
  })

  it('denies oversight to a department head without a department', () => {
    const head = { role: 'teacher' as const, isDepartmentHead: true }
    expect(canAccessAcademicOversight(head)).toBe(true)
    expect(oversightDepartment(head)).toBeNull()
  })

  it('grants only user administration to a registrar', () => {
    const registrar = { role: 'teacher' as const, isUserRegistrar: true, department: 'Registrar' }
    expect(canAccessUserAdmin(registrar)).toBe(true)
    expect(canAccessItOperations(registrar)).toBe(false)
    expect(canAccessAcademicOversight(registrar)).toBe(false)
    expect(isMaintenanceExempt(registrar)).toBe(false)
    expect(activeDesignations(registrar)).toEqual(['user_admin'])
  })

  it('supports multiple concurrent designations in stable order', () => {
    const dualHat = {
      role: 'teacher' as const,
      isItCoordinator: true,
      isDepartmentHead: true,
      isUserRegistrar: true,
    }
    expect(activeDesignations(dualHat)).toEqual(['it_operations', 'academic_oversight', 'user_admin'])
    expect(hasDesignation(dualHat, 'user_admin')).toBe(true)
  })
})
