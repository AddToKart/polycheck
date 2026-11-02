import { z } from 'zod'

export const AiChatSendSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(2_000, 'Message must be 2000 characters or fewer'),
  threadId: z.string().min(1).max(128).optional(),
  regenerate: z.boolean().optional(),
})

export type AiChatSendInputParsed = z.infer<typeof AiChatSendSchema>
