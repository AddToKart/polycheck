import type { AiChatAttachment, AiToolInvocationSummary } from '@polycheck/shared'

/** Pure presentation helpers for the assistant transcript. */

export type AttachmentDownloadState = 'idle' | 'loading' | 'done'

export function toolActivityLabel(count: number): string {
  return `Used ${count} tool${count === 1 ? '' : 's'}`
}

export function toolInvocationLabel(invocation: AiToolInvocationSummary): string {
  return `${invocation.tool.replace(/_/g, ' ')} · ${invocation.outcome}`
}

export function attachmentAccessibilityLabel(
  attachment: AiChatAttachment,
  state: AttachmentDownloadState,
): string {
  if (state === 'loading') return `Downloading ${attachment.filename}`
  if (state === 'done') return `Download ${attachment.filename} again`
  return `Download ${attachment.filename}`
}

/** Marks the point where the server produced no persisted reply for a stop. */
export const STOPPED_EMPTY_REPLY = 'Stopped before a reply arrived.'

/** Copy feedback announced after a transcript message reaches the clipboard. */
export const MESSAGE_COPIED_ANNOUNCEMENT = 'Message copied to clipboard'
export const MESSAGE_COPY_FAILED_ANNOUNCEMENT = 'Could not copy the message'

export function stoppedReplyHint(hasContent: boolean): string {
  return hasContent ? 'Stopped — retry?' : STOPPED_EMPTY_REPLY
}
