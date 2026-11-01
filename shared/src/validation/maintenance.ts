import { z } from 'zod'

/** Maintenance-mode contracts shared by web, mobile, and backend. */

const IsoDateTimeOrEmpty = z
  .string()
  .trim()
  .max(64)
  .refine((value) => value === '' || !Number.isNaN(Date.parse(value)), 'Must be a valid ISO-8601 datetime')

/** Settings-input mirror for the three maintenance keys (server validates again). */
export const MaintenanceMessageSchema = z
  .string()
  .trim()
  .max(500, 'Maintenance message must be 500 characters or fewer')

export const MaintenanceUntilSchema = IsoDateTimeOrEmpty

/** Public status payload served by GET /maintenance/status. */
export const MaintenanceStatusSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(500).optional(),
  estimatedEnd: z.string().max(64).optional(),
})

/** Tolerant parser for the canonical 503 body. */
export const MaintenanceBlockBodySchema = z.object({
  code: z.literal('system_maintenance'),
  message: z.string(),
  estimatedEnd: z.string().optional(),
})

export type MaintenanceStatusPayload = z.infer<typeof MaintenanceStatusSchema>
export type MaintenanceBlockPayload = z.infer<typeof MaintenanceBlockBodySchema>

/** True when a decoded response body is the maintenance block. */
export function isMaintenanceBlockBody(value: unknown): value is MaintenanceBlockPayload {
  return MaintenanceBlockBodySchema.safeParse(value).success
}
