import { z } from 'zod'

export const ExcuseReasonSchema = z.enum([
  'medical',
  'family_emergency',
  'school_activity',
  'transportation',
  'bereavement',
  'other',
])

export const RequestExcuseSchema = z.object({
  reason: ExcuseReasonSchema,
  description: z.string().trim().min(10, 'Describe the reason in at least 10 characters').max(1_000),
  evidenceData: z.string().min(1).max(7_000_000).optional(),
})

export const DecideExcuseSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
})

export type RequestExcuseInput = z.infer<typeof RequestExcuseSchema>
export type DecideExcuseInput = z.infer<typeof DecideExcuseSchema>
