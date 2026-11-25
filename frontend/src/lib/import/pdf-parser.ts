import { IMPORT_MAX_ROWS } from '@polycheck/shared'
import { SpreadsheetParseError } from './spreadsheet-parser'
import { tableFromPdfPages, type PdfPage } from './pdf-table'

/**
 * Browser-side reader for TEXT-based PDF master lists. Parsing happens in the admin's browser (no server CPU,
 * no student data sent anywhere); pdf.js and its worker load on demand so the main bundle never pays for them.
 * Scanned (image-only) PDFs are detected and refused with guidance: OCR is deliberately out of scope.
 */

export const MAX_PDF_BYTES = 10 * 1024 * 1024
export const MAX_PDF_PAGES = 50

export interface ParsedPdf {
  headers: string[]
  rows: string[][]
  pageCount: number
  headerRecognized: boolean
  errors: string[]
}

export interface PdfParseOptions {
  /** Override the pdf.js worker location (tests run it from disk; the browser resolves it from the bundle). */
  workerSrc?: string
}

/** `%PDF-` — the extension and MIME type of an upload are not evidence of its content. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
}

type TextContentItem = { str?: string; transform?: number[]; width?: number }

export async function parsePdfFile(file: File, options: PdfParseOptions = {}): Promise<ParsedPdf> {
  if (file.size > MAX_PDF_BYTES) {
    throw new SpreadsheetParseError('too_large', 'That PDF is larger than 10 MB. Split the master list or export it as Excel.')
  }
  const buffer = await file.arrayBuffer()
  if (!looksLikePdf(new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength)))) {
    throw new SpreadsheetParseError('not_pdf', 'That file is not a valid PDF.')
  }

  let pages: PdfPage[]
  try {
    // The legacy build keeps older phone browsers working; loaded only when a PDF is actually chosen.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc =
      options.workerSrc ?? new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      enableXfa: false,
      useSystemFonts: false,
      disableFontFace: true,
    })
    const document = await task.promise
    try {
      if (document.numPages > MAX_PDF_PAGES) {
        throw new SpreadsheetParseError(
          'too_many_pages',
          `That PDF has ${document.numPages} pages. The limit is ${MAX_PDF_PAGES}; split it or export it as Excel.`,
        )
      }
      pages = []
      for (let number = 1; number <= document.numPages; number += 1) {
        const page = await document.getPage(number)
        const content = await page.getTextContent()
        pages.push({
          items: (content.items as TextContentItem[])
            .filter((item): item is Required<Pick<TextContentItem, 'str' | 'transform'>> & TextContentItem =>
              typeof item.str === 'string' && Array.isArray(item.transform),
            )
            .map((item) => ({
              str: item.str,
              x: item.transform[4],
              y: item.transform[5],
              width: item.width ?? 0,
            })),
        })
        page.cleanup()
      }
    } finally {
      await document.destroy()
    }
  } catch (error) {
    if (error instanceof SpreadsheetParseError) throw error
    throw new SpreadsheetParseError('unreadable', 'That PDF could not be read. Export the master list again, or upload the Excel version.')
  }

  const characters = pages.reduce((total, page) => total + page.items.reduce((sum, item) => sum + item.str.trim().length, 0), 0)
  if (characters === 0) {
    throw new SpreadsheetParseError(
      'scanned',
      'This PDF is a scan (it has no text to read). Upload the Excel or CSV version, or ask the registrar for it.',
    )
  }

  const table = tableFromPdfPages(pages)
  if (table.rows.length === 0) {
    throw new SpreadsheetParseError(
      'empty',
      'No students were found in that PDF. It needs the PUP student numbers (for example 2024-00001-MN-0) as text.',
    )
  }
  const errors = [...table.warnings]
  if (table.rows.length > IMPORT_MAX_ROWS) {
    errors.push(`This PDF has ${table.rows.length} rows; only the first ${IMPORT_MAX_ROWS} can be imported at once.`)
  }
  return {
    headers: table.headers,
    rows: table.rows,
    pageCount: pages.length,
    headerRecognized: table.headerRecognized,
    errors,
  }
}
