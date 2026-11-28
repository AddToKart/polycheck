import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  afterEach(cleanup)

  it('renders bold text instead of literal asterisks', () => {
    render(<Markdown content="You are at **92%** attendance." />)

    const bold = screen.getByText('92%')
    expect(bold.tagName).toBe('STRONG')
    expect(screen.queryByText(/\*\*92%\*\*/)).not.toBeInTheDocument()
  })

  it('shows a table as a readable list, one entry per row', () => {
    render(
      <Markdown
        content={[
          '| Metric | Value |',
          '| --- | --- |',
          '| Present | 12 |',
          '| Late | 2 |',
        ].join('\n')}
      />,
    )

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['Present: 12', 'Late: 2'])
  })

  it('opens links in a new tab with a safe rel', () => {
    render(<Markdown content="[Example](https://example.edu.ph)" />)

    const link = screen.getByRole('link', { name: 'Example' })
    expect(link).toHaveAttribute('href', 'https://example.edu.ph')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('never injects raw HTML', () => {
    const { container } = render(
      <Markdown content={'Hello <script>alert(1)</script><strong>raw</strong>'} />,
    )

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('strong')).toBeNull()
    expect(screen.getByText(/Hello/)).toBeInTheDocument()
  })
})
