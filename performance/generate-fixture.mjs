#!/usr/bin/env node
/**
 * Generates a PUP-style student master list CSV for bulk import + load fixtures.
 *
 * Usage:
 *   node performance/generate-fixture.mjs --count 5000 [--start 0] [--year 2026] [--out file.csv]
 *
 * Output columns match the shared import parser's canonical headers:
 *   Student No., Name, Program, Year Level, College/Department
 *
 * Student numbers use the required format YYYY-NNNNN-XX-N. `--start` offsets the
 * five-digit sequence so repeated runs do not collide.
 */
import { writeFile } from 'node:fs/promises'

const args = process.argv.slice(2)
const valueOf = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`--${name} requires a value`)
  return value
}

const count = Number(valueOf('count', '5000'))
const start = Number(valueOf('start', '0'))
const year = Number(valueOf('year', String(new Date().getFullYear())))
const out = valueOf('out', '')

if (!Number.isInteger(count) || count < 1 || count > 5000) {
  throw new Error('--count must be an integer between 1 and 5000')
}
if (!Number.isInteger(start) || start < 0 || start + count > 100000) {
  throw new Error('--start must be non-negative and start + count must not exceed 100000')
}
if (!Number.isInteger(year) || year < 2000 || year > 2100) {
  throw new Error('--year must be a four-digit year')
}

const escape = (value) => `"${String(value).replace(/"/g, '""')}"`
const lines = ['Student No.,Name,Program,Year Level,College/Department']
for (let index = 0; index < count; index += 1) {
  const sequence = String(start + index).padStart(5, '0')
  const studentId = `${year}-${sequence}-MN-0`
  lines.push([
    escape(studentId),
    escape(`Load Student ${start + index + 1}`),
    escape('BS Information Technology'),
    escape('1st Year'),
    escape('CCIS'),
  ].join(','))
}

const csv = lines.join('\r\n')
if (out) {
  await writeFile(out, `${csv}\r\n`, 'utf8')
  console.log(`Wrote ${count} students to ${out}`)
} else {
  process.stdout.write(`${csv}\r\n`)
}
