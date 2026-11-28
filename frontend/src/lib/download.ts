import { downloadAssistantFile } from '@/lib/api-client'

/** Saves a blob under a name, without leaving the page. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

const part = (value: string) => value.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'file'

export type PhotoReportScope = { sessionId: string } | { sectionId: string } | { subjectId: string }

/** The server path of the class photo PDF for one session, section or subject. */
export function photoReportPath(scope: PhotoReportScope, range: { from?: string; to?: string } = {}): string {
  const params = new URLSearchParams(scope as Record<string, string>)
  if (range.from) params.set('from', range.from)
  if (range.to) params.set('to', range.to)
  return `/docs/proof-photos?${params.toString()}`
}

/** Downloads the PDF of class photos; the server's reason is thrown when there is nothing to export. */
export async function downloadPhotoReport(
  scope: PhotoReportScope,
  label: string,
  range: { from?: string; to?: string } = {},
) {
  const blob = await downloadAssistantFile(photoReportPath(scope, range))
  saveBlob(blob, `class-photos-${part(label)}.pdf`)
}

export async function downloadSubjectAttendance(subjectId: string, code: string) {
  const blob = await downloadAssistantFile(`/docs/subject-attendance/${encodeURIComponent(subjectId)}`)
  saveBlob(blob, `attendance-${part(code)}-all-records.csv`)
}
