import Papa from 'papaparse'
import type { ImportColumnMapping } from './map'

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
  errors: string[]
}

/** Minimal CSV parser for master lists (CSV only; Excel exports are expected). */
export function parseCsv(text: string): ParsedCsv {
  const cleaned = text.replace(/^\uFEFF/, '')
  const result = Papa.parse<string[]>(cleaned, { skipEmptyLines: 'greedy' })
  const data = (result.data as unknown as string[][]).map((row) =>
    Array.isArray(row) ? row.map((cell) => (cell ?? '').toString()) : [],
  )
  const headers = (data[0] ?? []).map((header) => header.trim())
  const rows = data.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''))
  return {
    headers,
    rows,
    errors: result.errors.slice(0, 10).map((error) => error.message),
  }
}

export function cell(row: string[], index: number | undefined): string {
  if (index === undefined) return ''
  return (row[index] ?? '').trim()
}

export function isMappingComplete(mapping: ImportColumnMapping): boolean {
  return mapping.studentId !== undefined && mapping.fullName !== undefined
}
