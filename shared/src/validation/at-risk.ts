import { z } from 'zod'

// ── F5 (WF-LD7): CHED CMO No. 40 notice-of-impending-drop referrals ──

export const ReferralStatusEnum = z.enum(['generated', 'acknowledged', 'counseling_scheduled', 'resolved'])

const ReferralNoteSchema = z.string().trim().max(500, 'Note must be 500 characters or fewer')

export const GenerateAtRiskReferralSchema = z.object({
  studentId: z.string().min(1, 'Student is required').max(64),
  sectionId: z.string().min(1, 'Section is required').max(64),
  note: ReferralNoteSchema.optional(),
})

export const UpdateAtRiskReferralSchema = z.object({
  status: ReferralStatusEnum,
  note: ReferralNoteSchema.optional(),
})

export type GenerateAtRiskReferralInput = z.infer<typeof GenerateAtRiskReferralSchema>
export type UpdateAtRiskReferralInput = z.infer<typeof UpdateAtRiskReferralSchema>
