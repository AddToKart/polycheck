import { SetMetadata } from '@nestjs/common'
import type { FacultyDesignation } from '@polycheck/shared'

export const REQUIRED_DESIGNATIONS_KEY = 'requiredDesignations'

/**
 * Requires one or more concurrent administrative designations on a teacher
 * account. Super admins always pass; plain teachers without the flag get a
 * typed `403 designation_required`.
 */
export const RequireDesignation = (...designations: FacultyDesignation[]) =>
  SetMetadata(REQUIRED_DESIGNATIONS_KEY, designations)
