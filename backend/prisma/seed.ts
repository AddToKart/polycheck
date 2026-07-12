import { PrismaClient, UserRole } from '@prisma/client'
import { hashSync } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = hashSync('password123', 10)

  const users = [
    {
      id: 's-admin-001',
      fullName: 'Dr. Maria Concepcion Reyes',
      email: 'mcreyes@pup.edu.ph',
      password,
      role: UserRole.super_admin,
      department: 'CCIS',
      scope: 'institution',
    },
    {
      id: 't-001',
      fullName: 'Prof. Juan Miguel Dela Cruz',
      email: 'jmdelacruz@pup.edu.ph',
      password,
      role: UserRole.teacher,
      department: 'CCIS',
    },
    {
      id: 't-002',
      fullName: 'Prof. Maria Elena Santos',
      email: 'mesantos@pup.edu.ph',
      password,
      role: UserRole.teacher,
      department: 'CCIS',
    },
    {
      id: 's-001',
      studentId: '2024-00001-MN-0',
      fullName: 'Alexandra Marie Reyes',
      email: 'amreyes@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-002',
      studentId: '2024-00002-MN-0',
      fullName: 'Benjamin Lucas Santos',
      email: 'blsantos@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-003',
      studentId: '2024-00003-MN-0',
      fullName: 'Camille Andrea Villanueva',
      email: 'cavillanueva@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-004',
      studentId: '2024-00004-MN-0',
      fullName: 'Daniel Joseph Cruz',
      email: 'djcruz@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-005',
      studentId: '2024-00005-MN-0',
      fullName: 'Erika Mae Gonzales',
      email: 'emgonzales@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-006',
      studentId: '2024-00006-MN-0',
      fullName: 'Francis Dominic Reyes',
      email: 'fdreyes@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-007',
      studentId: '2024-00007-MN-0',
      fullName: 'Gabriella Sofia Mendoza',
      email: 'gsmendoza@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-008',
      studentId: '2024-00008-MN-0',
      fullName: 'Henry William Tan',
      email: 'hwtan@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
  ]

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: user,
      create: user,
    })
  }

  console.log('Seed complete: 11 users created')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
