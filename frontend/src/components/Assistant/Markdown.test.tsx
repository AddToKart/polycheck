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

  it('renders GFM tables with a header row and cells', () => {
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

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Metric' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '12' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument()
  })

  it('opens links in a new tab with a safe rel', () => {
    render(<Markdown content="[PUP](https://pup.edu.ph)" />)

    const link = screen.getByRole('link', { name: 'PUP' })
    expect(link).toHaveAttribute('href', 'https://pup.edu.ph')
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
