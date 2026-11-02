/**
 * Pure URL-filter helpers used by the FIL primitives (Wave 4).
 *
 * Filters live in the query string so a filtered workspace can be shared as a
 * deep link. Unknown parameters are preserved: pages such as the student
 * dashboard keep `?tab=attendance` while the attendance filters change.
 */

export interface UrlFilterDefinition {
  /** Value used when the parameter is absent. Returned by readUrlFilters. */
  defaultValue?: string
  /** Optional allow-list; values outside it fall back to the default. */
  allowed?: readonly string[]
}

export type UrlFilterSchema = Record<string, UrlFilterDefinition>

export type UrlFilterValues<S extends UrlFilterSchema> = { [K in keyof S]: string }

export function readUrlFilters<S extends UrlFilterSchema>(
  schema: S,
  params: URLSearchParams,
): UrlFilterValues<S> {
  const values = {} as UrlFilterValues<S>
  for (const key of Object.keys(schema) as (keyof S & string)[]) {
    const definition = schema[key]
    const raw = params.get(key)
    const allowed = definition?.allowed
    const value = raw !== null && (!allowed || allowed.includes(raw)) ? raw : ''
    values[key] = (value || definition?.defaultValue || '') as UrlFilterValues<S>[typeof key]
  }
  return values
}

/**
 * Writes the schema keys into `existing` (unrelated params are preserved).
 * Default values are removed from the URL to keep deep links short.
 */
export function writeUrlFilters<S extends UrlFilterSchema>(
  schema: S,
  values: Partial<UrlFilterValues<S>>,
  existing: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const next = new URLSearchParams(existing.toString())
  for (const key of Object.keys(schema)) {
    const definition = schema[key]
    const value = values[key] ?? definition?.defaultValue ?? ''
    if (!value || value === (definition?.defaultValue ?? '')) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
  }
  return next
}

export function defaultUrlFilters<S extends UrlFilterSchema>(schema: S): UrlFilterValues<S> {
  return readUrlFilters(schema, new URLSearchParams())
}

export function activeFilterCount<S extends UrlFilterSchema>(
  schema: S,
  values: Partial<UrlFilterValues<S>>,
): number {
  let count = 0
  for (const key of Object.keys(schema)) {
    const value = values[key] ?? ''
    if (value && value !== (schema[key]?.defaultValue ?? '')) count += 1
  }
  return count
}

export function filterSearchString(params: URLSearchParams): string {
  const query = params.toString()
  return query ? `?${query}` : ''
}
