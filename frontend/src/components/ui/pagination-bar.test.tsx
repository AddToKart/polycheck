import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PaginationBar } from './pagination-bar'

afterEach(() => {
  cleanup()
})


describe('PaginationBar', () => {
  it('renders nothing when totalPages is 0', () => {
    const { container } = render(
      <PaginationBar page={1} totalPages={0} onPageChange={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders summary count when totalItems is provided', () => {
    render(
      <PaginationBar
        page={1}
        totalPages={3}
        totalItems={25}
        pageSize={10}
        itemName="sessions"
        onPageChange={vi.fn()}
      />
    )
    expect(screen.getByText(/Showing/)).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText(/sessions/)).toBeInTheDocument()
  })

  it('disables Previous on page 1 and calls onPageChange on Next', () => {
    const onPageChange = vi.fn()
    render(
      <PaginationBar
        page={1}
        totalPages={4}
        totalItems={40}
        pageSize={10}
        onPageChange={onPageChange}
      />
    )
    const prevBtn = screen.getByRole('button', { name: /previous/i })
    const nextBtn = screen.getByRole('button', { name: /next/i })

    expect(prevBtn).toBeDisabled()
    expect(nextBtn).toBeEnabled()

    fireEvent.click(nextBtn)
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('disables Next on the last page', () => {
    const onPageChange = vi.fn()
    render(
      <PaginationBar
        page={4}
        totalPages={4}
        totalItems={40}
        pageSize={10}
        onPageChange={onPageChange}
      />
    )
    const prevBtn = screen.getByRole('button', { name: /previous/i })
    const nextBtn = screen.getByRole('button', { name: /next/i })

    expect(prevBtn).toBeEnabled()
    expect(nextBtn).toBeDisabled()

    fireEvent.click(prevBtn)
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('renders page numbers when showNumbers is true and totalPages <= 7', () => {
    const onPageChange = vi.fn()
    render(
      <PaginationBar
        page={2}
        totalPages={5}
        showNumbers
        onPageChange={onPageChange}
      />
    )
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 5' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Page 4' }))
    expect(onPageChange).toHaveBeenCalledWith(4)
  })
})
