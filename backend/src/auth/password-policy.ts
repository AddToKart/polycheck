export const PASSWORD_HASH_COST = 12

/**
 * Mirrors the class-validator policy in `IsStrongPassword` so services that
 * are called directly (not through the HTTP validation pipe) enforce the same
 * minimum strength before hashing a credential.
 */
export function isStrongPassword(value: string): boolean {
  return (
    value.length >= 12 &&
    value.length <= 128 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  )
}

// Hash of a fixed invalid sentinel at PASSWORD_HASH_COST. It equalizes the
// password-check work performed for identifiers that do not exist.
export const DUMMY_PASSWORD_HASH = '$2a$12$tUxE.dcI7cYM7nL4qYMLQ.oPQlrmZitTiTJUcQWSIhcoByqEd9V4q'
