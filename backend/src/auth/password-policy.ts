export const PASSWORD_HASH_COST = 12

// Hash of a fixed invalid sentinel at PASSWORD_HASH_COST. It equalizes the
// password-check work performed for identifiers that do not exist.
export const DUMMY_PASSWORD_HASH = '$2a$12$tUxE.dcI7cYM7nL4qYMLQ.oPQlrmZitTiTJUcQWSIhcoByqEd9V4q'
