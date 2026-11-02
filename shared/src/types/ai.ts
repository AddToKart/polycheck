/** AI assistant chat contract (AI0). */

export type AiChatRole = 'user' | 'assistant'

export type AiAttachmentKind = 'master_list' | 'session_attendance'

export type AiAttachmentFormat = 'pdf' | 'docx' | 'csv'

export interface AiChatAttachment {
  id: string
  kind: AiAttachmentKind
  format: AiAttachmentFormat
  label: string
  filename: string
  /** Authenticated API path (relative to the API base) that streams the file. */
  downloadPath: string
}

export type AiToolOutcome = 'succeeded' | 'denied' | 'failed'

export interface AiToolInvocationSummary {
  tool: string
  outcome: AiToolOutcome
  detail?: string
}

export interface AiChatMessage {
  id: string
  threadId: string
  role: AiChatRole
  content: string
  createdAt: string
  attachments?: AiChatAttachment[]
  toolInvocations?: AiToolInvocationSummary[]
}

export interface AiChatThread {
  id: string
  messages: AiChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface AiChatSendInput {
  message: string
  threadId?: string
  /** Re-run the last user turn without appending a duplicate user message. */
  regenerate?: boolean
}

export interface AiChatSendResult {
  threadId: string
  messageId: string
}

export interface AiThreadSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface AiCapabilities {
  enabled: boolean
  model?: string
  maxMessageChars?: number
  reason?: string
  /** Configuration pieces that are still missing (empty/absent when enabled). */
  missing?: AiMissingConfig[]
  /** True when an administrator disabled the assistant for this role or entirely. */
  policyBlocked?: boolean
}

export type AiMissingConfig = 'base_url' | 'model' | 'api_key'

/** One Socket.IO stream tick for an in-flight assistant reply. */
export type AiStreamEvent =
  | { type: 'delta'; threadId: string; messageId: string; text: string }
  | { type: 'done'; threadId: string; message: AiChatMessage }
  | { type: 'error'; threadId: string; messageId?: string; message: string }

export const AI_THREAD_JOIN_EVENT = 'ai:thread:join'
export const AI_THREAD_JOINED_EVENT = 'ai:thread:joined'
export const AI_THREAD_LEAVE_EVENT = 'ai:thread:leave'
export const AI_THREAD_STREAM_EVENT = 'ai:thread:stream'
