import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AiToolInvocationSummary } from '@polycheck/shared'
import { ToolActivityDisclosure } from './ToolActivityDisclosure'

const invocations: AiToolInvocationSummary[] = [
  { tool: 'get_my_sections', outcome: 'succeeded', detail: 'Read 3 sections' },
  { tool: 'export_master_list', outcome: 'denied', detail: 'Outside your scope' },
]

describe('ToolActivityDisclosure', () => {
  afterEach(cleanup)

  it('is collapsed by default and toggles the chips', () => {
    render(<ToolActivityDisclosure invocations={invocations} />)

    const toggle = screen.getByRole('button', { name: /Used 2 tools/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: 'Tool activity' })).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('list', { name: 'Tool activity' })).toBeInTheDocument()
    expect(screen.getByText('get my sections · succeeded')).toHaveAttribute('title', 'Read 3 sections')
    expect(screen.getByText('export master list · denied')).toHaveAttribute(
      'title',
      'Outside your scope',
    )

    fireEvent.click(toggle)
    expect(screen.queryByRole('list', { name: 'Tool activity' })).not.toBeInTheDocument()
  })

  it('renders nothing when a message has no tool activity', () => {
    const { container } = render(<ToolActivityDisclosure invocations={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
