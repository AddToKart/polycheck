/**
 * Generates SYNTHETIC master-list PDFs used by the browser PDF-import tests.
 *
 *   node scripts/generate-pdf-fixtures.cjs
 *
 * Never put real student data here: names are placeholders and student numbers use the 2099 intake.
 * pdfkit comes from the backend workspace (it already builds PolyCheck's own PDFs).
 */
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

const backendRequire = createRequire(path.join(__dirname, '..', 'backend', 'package.json'))
const PDFDocument = backendRequire('pdfkit')

const OUT = path.join(__dirname, '..', 'frontend', 'src', 'lib', 'import', 'fixtures')
fs.mkdirSync(OUT, { recursive: true })

const COLUMNS = [
  { title: 'No.', x: 40 },
  { title: 'Student No.', x: 75 },
  { title: 'Name', x: 195 },
  { title: 'Program', x: 385 },
  { title: 'Year Level', x: 440 },
  { title: 'Email', x: 505 },
]

const studentNumber = (n) => `2099-${String(n).padStart(5, '0')}-MN-0`
const student = (n) => ({
  no: n,
  id: studentNumber(n),
  name: `Student ${String(n).padStart(3, '0')} Sample`,
  program: n % 7 === 0 ? 'BSHM' : 'BSIT',
  year: String(1 + (n % 4)),
  email: n % 3 === 0 ? '' : `student${n}@example.com`,
})

function write(name, build) {
  const doc = new PDFDocument({ size: 'A4', margin: 30, info: { Title: name } })
  const chunks = []
  doc.on('data', (chunk) => chunks.push(chunk))
  const done = new Promise((resolve) => doc.on('end', resolve))
  build(doc)
  doc.end()
  return done.then(() => {
    fs.writeFileSync(path.join(OUT, name), Buffer.concat(chunks))
    console.log('wrote', name)
  })
}

const text = (doc, value, x, y) => doc.text(value, x, y, { lineBreak: false })

function header(doc, y) {
  doc.font('Helvetica-Bold').fontSize(8)
  for (const column of COLUMNS) text(doc, column.title, column.x, y)
}

function row(doc, record, y) {
  doc.font('Helvetica').fontSize(8)
  text(doc, String(record.no), COLUMNS[0].x, y)
  text(doc, record.id, COLUMNS[1].x, y)
  text(doc, record.name, COLUMNS[2].x, y)
  text(doc, record.program, COLUMNS[3].x, y)
  text(doc, record.year, COLUMNS[4].x, y)
  if (record.email) text(doc, record.email, COLUMNS[5].x, y)
}

async function main() {
  // 1. One page: title block, header, 12 students (one with a wrapped name), signature block.
  await write('master-simple.pdf', (doc) => {
    doc.font('Helvetica-Bold').fontSize(11)
    text(doc, 'Republic of the Philippines', 200, 40)
    text(doc, 'POLYTECHNIC UNIVERSITY OF THE PHILIPPINES - SANTA MARIA', 110, 56)
    doc.fontSize(10)
    text(doc, 'MASTER LIST - BSIT 1-1 (SAMPLE)', 190, 76)
    header(doc, 110)
    let y = 128
    for (let n = 1; n <= 12; n += 1) {
      const record = student(n)
      if (n === 5) {
        record.name = 'Maria Elena Concepcion de la'
        row(doc, record, y)
        doc.font('Helvetica').fontSize(8)
        text(doc, 'Santa Cruz y Reyes', COLUMNS[2].x, y + 10)
        y += 26
        continue
      }
      row(doc, record, y)
      y += 16
    }
    doc.font('Helvetica').fontSize(9)
    text(doc, 'Prepared by:', 75, y + 30)
    text(doc, 'Checked by:', 385, y + 30)
    text(doc, 'Registrar (sample)', 75, y + 44)
  })

  // 2. Several pages: the header repeats and every page carries a "Page x of y" footer.
  await write('master-multipage.pdf', (doc) => {
    const perPage = 40
    const total = 95
    const pages = Math.ceil(total / perPage)
    for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
      if (pageIndex > 0) doc.addPage()
      doc.font('Helvetica-Bold').fontSize(10)
      text(doc, 'MASTER LIST - BSIT 2-1 (SAMPLE)', 190, 40)
      header(doc, 70)
      let y = 88
      for (let k = 0; k < perPage; k += 1) {
        const n = pageIndex * perPage + k + 1
        if (n > total) break
        row(doc, student(n), y)
        y += 16
      }
      doc.font('Helvetica').fontSize(8)
      text(doc, `Page ${pageIndex + 1} of ${pages}`, 270, 800)
    }
  })

  // 3. A "scanned" file: shapes only, no text layer.
  await write('scanned-no-text.pdf', (doc) => {
    doc.rect(50, 50, 400, 600).stroke()
    doc.rect(70, 100, 360, 20).fill('#cccccc')
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
