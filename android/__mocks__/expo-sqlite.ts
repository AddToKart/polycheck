/**
 * Minimal expo-sqlite mock.
 *
 * Load-bearing: api-client.ts → offline-store.ts performs `import * as SQLite
 * from 'expo-sqlite'` at module scope, so ANY test importing api-client (e.g.
 * classify-sync-error.test.ts) must resolve the real ESM package otherwise
 * (its `export *` syntax fails under ts-jest CJS transform). DB access is
 * lazy (inside functions), so no engine is needed here.
 *
 * offline-store.test.ts overrides this with its own inline SQL factory via
 * `jest.mock('expo-sqlite', () => ({...}))` — keep this file engine-free.
 */
export const openDatabaseAsync = jest.fn().mockResolvedValue(null)
export const openDatabaseSync = jest.fn().mockReturnValue(null)
