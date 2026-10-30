import { z } from 'zod'

// Mirrors the backend class-validator DTOs so the browser can pre-validate
// bulk-import rows with identical rules before any network request.

export const STUDENT_ID_PATTERN = /^\d{4}-\d{5}-[A-Z]{2}-\d$/
export const IMPORT_CHUNK_SIZE = 250
export const IMPORT_MAX_ROWS = 5000

export const ImportModeSchema = z.enum(['validate', 'execute'])
export const ImportConflictModeSchema = z.enum(['skip_existing', 'update_existing'])

export const StudentImportRowSchema = z.object({
  rowNumber: z.number().int().min(1),
  fullName: z.string().trim().min(2).max(150),
  studentId: z.string().trim().toUpperCase().regex(STUDENT_ID_PATTERN, 'Invalid PUP student number'),
  email: z.string().trim().email().max(254).optional(),
  program: z.string().trim().min(2).max(150).optional(),
  yearLevel: z.number().int().min(1).max(8).optional(),
  department: z.string().trim().min(2).max(100).optional(),
})

export const EnrollImportRowSchema = z.object({
  rowNumber: z.number().int().min(1),
  studentId: z.string().trim().toUpperCase().regex(STUDENT_ID_PATTERN, 'Invalid PUP student number'),
  studentName: z.string().trim().min(1).max(150).optional(),
  expectedProgram: z.string().trim().min(1).max(150).optional(),
  expectedYearLevel: z.number().int().min(1).max(8).optional(),
})

const IdempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9._:-]{8,128}$/, 'Idempotency key must be 8-128 safe characters')
  .optional()

const RowChecksumSchema = z.string().regex(/^[a-f0-9]{16}$/, 'Invalid row checksum')

export const StudentImportRequestSchema = z
  .object({
    mode: ImportModeSchema,
    conflictMode: ImportConflictModeSchema,
    rows: z.array(StudentImportRowSchema).min(1).max(IMPORT_CHUNK_SIZE),
    idempotencyKey: IdempotencyKeySchema,
    rowChecksum: RowChecksumSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'execute' && !value.rowChecksum) {
      ctx.addIssue({
        code: 'custom',
        path: ['rowChecksum'],
        message: 'Execute requires the checksum returned by validate',
      })
    }
  })

export const EnrollImportRequestSchema = z
  .object({
    mode: ImportModeSchema,
    rows: z.array(EnrollImportRowSchema).min(1).max(IMPORT_CHUNK_SIZE),
    idempotencyKey: IdempotencyKeySchema,
    rowChecksum: RowChecksumSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'execute' && !value.rowChecksum) {
      ctx.addIssue({
        code: 'custom',
        path: ['rowChecksum'],
        message: 'Execute requires the checksum returned by validate',
      })
    }
  })

export type StudentImportRequestInput = z.infer<typeof StudentImportRequestSchema>
export type EnrollImportRequestInput = z.infer<typeof EnrollImportRequestSchema>
