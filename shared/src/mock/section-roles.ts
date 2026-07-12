import type { SectionRole, SessionPermission, ProofOfClass } from '../types'

export const mockSectionRoles: SectionRole[] = [
  {
    id: 'sr-001',
    sectionId: 'sec-001',
    studentId: 's-003',
    studentName: 'Bianca Ysabel Fernandez',
    role: 'president',
    grantedBy: 't-001',
    grantedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'sr-002',
    sectionId: 'sec-001',
    studentId: 's-005',
    studentName: 'Erika Mae Gonzales',
    role: 'qac',
    grantedBy: 't-001',
    grantedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'sr-003',
    sectionId: 'sec-003',
    studentId: 's-001',
    studentName: 'Angela Marie Cruz',
    role: 'president',
    grantedBy: 't-001',
    grantedAt: '2026-06-10T00:00:00.000Z',
  },
  {
    id: 'sr-004',
    sectionId: 'sec-003',
    studentId: 's-008',
    studentName: 'Hanz Christian Mercado',
    role: 'qac',
    grantedBy: 't-001',
    grantedAt: '2026-06-10T00:00:00.000Z',
  },
]

export const mockSessionPermissions: SessionPermission[] = [
  {
    id: 'sp-001',
    sectionId: 'sec-001',
    studentId: 's-003',
    grantedBy: 't-001',
    grantedAt: '2026-06-24T08:00:00.000Z',
    expiresAt: '2026-06-25T08:00:00.000Z',
    isActive: true,
  },
  {
    id: 'sp-002',
    sectionId: 'sec-001',
    studentId: 's-001',
    grantedBy: 't-001',
    grantedAt: '2026-06-10T08:00:00.000Z',
    expiresAt: '2026-06-11T08:00:00.000Z',
    isActive: false,
  },
  {
    id: 'sp-003',
    sectionId: 'sec-003',
    studentId: 's-001',
    grantedBy: 't-001',
    grantedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
    isActive: true,
  },
]

export const mockProofsOfClass: ProofOfClass[] = [
  {
    id: 'poc-001',
    sectionId: 'sec-001',
    sessionId: 'sess-001',
    uploadedBy: 's-005',
    uploadedByStudentName: 'Erika Mae Gonzales',
    photoData: 'mock-proof-001',
    uploadedAt: '2026-06-16T08:30:00.000Z',
    description: 'Class in session - Lecture on Data Structures',
  },
  {
    id: 'poc-002',
    sectionId: 'sec-003',
    sessionId: 'sess-008',
    uploadedBy: 's-008',
    uploadedByStudentName: 'Hanz Christian Mercado',
    photoData: 'mock-proof-002',
    uploadedAt: '2026-06-20T09:15:00.000Z',
    description: 'Laboratory activity - Group 3 presentation',
  },
]
