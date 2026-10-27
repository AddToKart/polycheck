import type { AiChatAttachment, AiToolInvocationSummary } from '@polycheck/shared'
import {
  STOPPED_EMPTY_REPLY,
  attachmentAccessibilityLabel,
  stoppedReplyHint,
  toolActivityLabel,
  toolInvocationLabel,
} from '../lib/assistant-ui'

const attachment: AiChatAttachment = {
  id: 'att-1',
  kind: 'master_list',
  format: 'pdf',
  label: 'Master list',
  filename: 'ccis-1a-master-list.pdf',
  downloadPath: '/docs/master-list/sec-1?format=pdf',
}

describe('toolActivityLabel', () => {
  it('pluralizes the collapsed disclosure label', () => {
    expect(toolActivityLabel(1)).toBe('Used 1 tool')
    expect(toolActivityLabel(2)).toBe('Used 2 tools')
    expect(toolActivityLabel(0)).toBe('Used 0 tools')
  })
})

describe('toolInvocationLabel', () => {
  it('humanizes the tool name and keeps the outcome', () => {
    const invocation: AiToolInvocationSummary = {
      tool: 'get_section_master_list',
      outcome: 'denied',
    }
    expect(toolInvocationLabel(invocation)).toBe('get section master list · denied')
  })
})

describe('attachmentAccessibilityLabel', () => {
  it('covers idle, loading, and completed downloads', () => {
    expect(attachmentAccessibilityLabel(attachment, 'idle'))
      .toBe('Download ccis-1a-master-list.pdf')
    expect(attachmentAccessibilityLabel(attachment, 'loading'))
      .toBe('Downloading ccis-1a-master-list.pdf')
    expect(attachmentAccessibilityLabel(attachment, 'done'))
      .toBe('Download ccis-1a-master-list.pdf again')
  })
})

describe('stoppedReplyHint', () => {
  it('distinguishes an empty draft from a partial reply', () => {
    expect(stoppedReplyHint(true)).toBe('Stopped — retry?')
    expect(stoppedReplyHint(false)).toBe(STOPPED_EMPTY_REPLY)
  })
})
