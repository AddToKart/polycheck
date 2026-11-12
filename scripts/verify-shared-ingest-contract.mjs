#!/usr/bin/env node
/**
 * Contract gate for the ingestion gateway.
 *
 * The gateway must never re-implement domain logic that already lives in
 * `@polycheck/shared`, and must never import from the NestJS backend. Both are
 * silent-drift risks: a duplicated `verifyQRToken` would keep working while it
 * quietly diverged from the control plane.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = 'services/ingest/src'

/** Symbols that MUST come from @polycheck/shared, never be redefined here. */
const FORBIDDEN_DEFINITIONS = [
  'verifyQRToken',
  'verifyMeetingPin',
  'haversineDistance',
  'computeRecordHash',
  'generateLedgerSalt',
  'isTokenInValidityWindow',
  'decodeTokenPayload',
]

/** Symbols the gateway is expected to consume from the shared package. */
const REQUIRED_IMPORTS = ['verifyQRToken', 'computeRecordHash']

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (entry.endsWith('.ts')) files.push(full)
  }
}
walk(ROOT)

const problems = []
const importedShared = new Set()

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const rel = relative('.', file).replace(/\\/g, '/')

  for (const symbol of FORBIDDEN_DEFINITIONS) {
    const definition = new RegExp(`(function|const|class)\\s+${symbol}\\b`)
    if (definition.test(source)) {
      problems.push(`${rel}: redefines shared symbol \`${symbol}\` instead of importing it`)
    }
  }

  if (/from\s+['"][^'"]*backend\/src/.test(source)) {
    problems.push(`${rel}: imports from the NestJS backend (services must stay decoupled)`)
  }

  for (const match of source.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]@polycheck\/shared(?:\/[a-z]+)?['"]/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0]
      if (name) importedShared.add(name)
    }
  }
}

for (const symbol of REQUIRED_IMPORTS) {
  if (!importedShared.has(symbol)) {
    problems.push(`ingest does not import \`${symbol}\` from @polycheck/shared — contract drift`)
  }
}

if (problems.length > 0) {
  console.error('Ingest shared-contract violations:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(`Ingest shared contract OK (${files.length} files, ${importedShared.size} shared imports)`)
