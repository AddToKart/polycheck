export type UserRole = 'super_admin' | 'teacher' | 'student'

export interface User {
  id: string
  studentId?: string
  fullName: string
  email?: string
  role: UserRole
  program?: string
  yearLevel?: number
  department?: string
  photoUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Teacher extends User {
  role: 'teacher'
  department?: string
}

export interface Student extends User {
  role: 'student'
  studentId: string
  program: string
  yearLevel: number
  enrolledSectionIds: string[]
}

export interface SuperAdmin extends User {
  role: 'super_admin'
  scope: 'department' | 'institution'
}
