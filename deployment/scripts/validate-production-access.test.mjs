import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateProductionAccess } from './validate-production-access.mjs'

const settings = {
  POSTGRES_PASSWORD: 'admin-secret-test-only-123456789',
  RUNTIME_DATABASE_PASSWORD: 'runtime-secret-test-only-123456789',
  MIGRATOR_DATABASE_PASSWORD: 'migrator-secret-test-only-123456789',
  BACKUP_DATABASE_PASSWORD: 'backup-secret-test-only-123456789',
  DATABASE_URL: 'postgresql://polycheck_runtime:runtime-secret-test-only-123456789@pgbouncer/polycheck',
  DIRECT_DATABASE_URL: 'postgresql://polycheck_migrator:migrator-secret-test-only-123456789@postgres/polycheck',
  RESTIC_REPOSITORY: 's3:https://backup.example.test/polycheck',
  RESTIC_PASSWORD: 'encryption-secret-test-only-123456789',
  OFFSITE_ACCESS_KEY_ID: 'test-key', OFFSITE_SECRET_ACCESS_KEY: 'test-secret',
}
test('accepts isolated runtime, migration, backup and remote archive configuration', () => validateProductionAccess(settings))
test('rejects runtime access as the bootstrap administrator without leaking credentials', () => {
  assert.throws(() => validateProductionAccess({ ...settings, DATABASE_URL: settings.DATABASE_URL.replace('polycheck_runtime:', 'polycheck:') }), /DATABASE_URL must target polycheck_runtime/)
})
test('rejects reused role passwords and local-only recovery', () => {
  assert.throws(() => validateProductionAccess({ ...settings, BACKUP_DATABASE_PASSWORD: settings.POSTGRES_PASSWORD }), /different passwords/)
  assert.throws(() => validateProductionAccess({ ...settings, RESTIC_REPOSITORY: '/local/backups' }), /remote HTTPS/)
  assert.throws(() => validateProductionAccess({ ...settings, RESTIC_PASSWORD: settings.POSTGRES_PASSWORD }), /independent/)
})
