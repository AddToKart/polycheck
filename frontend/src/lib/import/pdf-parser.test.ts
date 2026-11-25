// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { buildStudentRows, suggestColumnMapping } from '@polycheck/shared'
import { looksLikePdf, MAX_PDF_BYTES, parsePdfFile } from './pdf-parser'

// The first pdf.js load initializes the whole engine; keep the suite stable on a busy 2-core machine.
vi.setConfig({ testTimeout: 60_000 })

const require = createRequire(import.meta.url)
// pdf.js runs its worker from disk here; in the browser it resolves from the bundle.
const workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')).toString()

const fixture = (name: string) =>
  new File([readFileSync(path.join(__dirname, 'fixtures', name))], name, { type: 'application/pdf' })

describe('looksLikePdf', () => {
  it('checks the content, not the file name', () => {
    expect(looksLikePdf(new TextEncoder().encode('%PDF-1.7'))).toBe(true)
    expect(looksLikePdf(new TextEncoder().encode('PK\u0003\u0004'))).toBe(false)
    expect(looksLikePdf(new Uint8Array([0x25, 0x50]))).toBe(false)
  })
})

describe('parsePdfFile (real text-based PDFs)', () => {
  it('reads a single-page master list: title block skipped, columns recognised, wrapped name merged', async () => {
    const parsed = await parsePdfFile(fixture('master-simple.pdf'), { workerSrc })

    expect(parsed.headerRecognized).toBe(true)
    expect(parsed.pageCount).toBe(1)
    expect(parsed.headers).toEqual(['No.', 'Student No.', 'Name', 'Program', 'Year Level', 'Email'])
    expect(parsed.rows).toHaveLength(12)
    expect(parsed.rows[0]).toEqual(['1', '2099-00001-MN-0', 'Student 001 Sample', 'BSIT', '2', 'student1@example.com'])
    // The long name that wrapped onto a second line is one record, not two.
    expect(parsed.rows[4][2]).toBe('Maria Elena Concepcion de la Santa Cruz y Reyes')
    expect(parsed.rows[4][1]).toBe('2099-00005-MN-0')
    // The signature block under the table never becomes a record or part of one.
    expect(JSON.stringify(parsed.rows)).not.toMatch(/Prepared|Checked|Registrar/)
    expect(parsed.errors).toEqual([])
  })

  it('reads a multi-page list: repeated headers and page footers dropped, every student kept once', async () => {
    const parsed = await parsePdfFile(fixture('master-multipage.pdf'), { workerSrc })

    expect(parsed.pageCount).toBe(3)
    expect(parsed.rows).toHaveLength(95)
    const ids = parsed.rows.map((row) => row[1])
    expect(new Set(ids).size).toBe(95)
    expect(ids[0]).toBe('2099-00001-MN-0')
    expect(ids[94]).toBe('2099-00095-MN-0')
    expect(JSON.stringify(parsed.rows)).not.toMatch(/Page \d|MASTER LIST/)
  })

  it('feeds the existing mapper and normalizer unchanged', async () => {
    const parsed = await parsePdfFile(fixture('master-simple.pdf'), { workerSrc })
    const mapping = suggestColumnMapping(parsed.headers)
    expect(mapping).toMatchObject({ studentId: 1, fullName: 2, program: 3, yearLevel: 4, email: 5 })

    const built = buildStudentRows(parsed.rows, mapping)
    expect(built.rows).toHaveLength(12)
    expect(built.rows[1]).toMatchObject({ studentId: '2099-00002-MN-0', fullName: 'Student 002 Sample', program: 'BSIT' })
    expect(built.issues.filter((issue) => ['INVALID_STUDENT_NUMBER', 'MISSING_REQUIRED_FIELD'].includes(issue.code))).toEqual([])
  })

  it('refuses a scan (no text layer) with guidance instead of returning nothing', async () => {
    await expect(parsePdfFile(fixture('scanned-no-text.pdf'), { workerSrc })).rejects.toMatchObject({ code: 'scanned' })
  })

  it('refuses non-PDFs, oversized files and corrupt PDFs with a specific code', async () => {
    await expect(parsePdfFile(new File(['Student No.,Name'], 'list.pdf'), { workerSrc })).rejects.toMatchObject({
      code: 'not_pdf',
    })
    await expect(
      parsePdfFile(new File([new Uint8Array(MAX_PDF_BYTES + 1)], 'big.pdf'), { workerSrc }),
    ).rejects.toMatchObject({ code: 'too_large' })
    await expect(parsePdfFile(new File(['%PDF-1.7 not really a document'], 'broken.pdf'), { workerSrc })).rejects.toMatchObject({
      code: 'unreadable',
    })
  })
})
