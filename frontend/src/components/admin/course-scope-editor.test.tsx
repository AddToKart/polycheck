import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PUP_SANTA_MARIA_COURSES } from '@polycheck/shared'
import { CourseScopeEditor, type CourseScopeValue } from './course-scope-editor'

afterEach(cleanup)

function renderEditor(value: CourseScopeValue, subject: 'head' | 'registrar' | 'both' = 'head') {
  const onChange = vi.fn()
  render(<CourseScopeEditor value={value} onChange={onChange} subject={subject} />)
  return onChange
}

describe('CourseScopeEditor', () => {
  it('offers exactly the catalog courses', () => {
    renderEditor({ managedCourses: [], managesAllCourses: false })
    for (const course of PUP_SANTA_MARIA_COURSES) {
      expect(screen.getByRole('checkbox', { name: `${course.code} — ${course.name}` })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('checkbox')).toHaveLength(PUP_SANTA_MARIA_COURSES.length + 1)
  })

  it('adds and removes a course without touching the all-courses switch', () => {
    const onChange = renderEditor({ managedCourses: ['BSIT'], managesAllCourses: false })
    fireEvent.click(screen.getByRole('checkbox', { name: /^BSHM/ }))
    expect(onChange).toHaveBeenLastCalledWith({ managedCourses: ['BSIT', 'BSHM'], managesAllCourses: false })
    fireEvent.click(screen.getByRole('checkbox', { name: /^BSIT/ }))
    expect(onChange).toHaveBeenLastCalledWith({ managedCourses: [], managesAllCourses: false })
  })

  it('marks every course as covered and locks the list when all courses is on (Head of Academic Programs)', () => {
    const onChange = renderEditor({ managedCourses: [], managesAllCourses: true })
    const bsit = screen.getByRole('checkbox', { name: /^BSIT/ }) as HTMLInputElement
    expect(bsit.checked).toBe(true)
    expect(bsit.closest('fieldset')).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /all courses/i }))
    expect(onChange).toHaveBeenLastCalledWith({ managedCourses: [], managesAllCourses: false })
  })

  it('warns that an empty scope sees no data', () => {
    renderEditor({ managedCourses: [], managesAllCourses: false })
    expect(screen.getByRole('note')).toHaveTextContent(/no courses selected/i)
    cleanup()
    renderEditor({ managedCourses: ['BSIT'], managesAllCourses: false })
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('describes what the scope governs per designation', () => {
    renderEditor({ managedCourses: [], managesAllCourses: false }, 'registrar')
    expect(screen.getByText(/student accounts and imports/i)).toBeInTheDocument()
  })
})
