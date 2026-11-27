import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const apiMock = vi.hoisted(() => ({ uploadProofOfClass: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ api: apiMock }))
// Real compression needs a browser canvas.
vi.mock('@/lib/proof-photos', () => ({
  compressPhoto: vi.fn(async (file: File) => `data:image/jpeg;base64,${file.name}`),
}))

import { ProofUploader } from './ProofUploader'

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

function setup(alreadyUploaded = 0) {
  const onUploaded = vi.fn()
  render(
    <ProofUploader
      sectionId="sec-1"
      sessionId="sess-1"
      alreadyUploaded={alreadyUploaded}
      uploader={{ id: 'stu-1', fullName: 'QAC Student' }}
      onUploaded={onUploaded}
    />,
  )
  return onUploaded
}

const choose = (files: File[]) =>
  fireEvent.change(screen.getByLabelText('Choose photos'), { target: { files } })

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.uploadProofOfClass.mockResolvedValue({})
})
afterEach(cleanup)

describe('ProofUploader', () => {
  it('takes no more photos than the session still allows', async () => {
    setup(2)
    choose([photo('a'), photo('b'), photo('c')])

    expect(await screen.findByRole('button', { name: 'Upload 2 photos' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('You can add 2 more photos')
  })

  it('uploads each photo to that one session and reports how many went through', async () => {
    const onUploaded = setup()
    choose([photo('a'), photo('b')])
    fireEvent.click(await screen.findByRole('button', { name: 'Upload 2 photos' }))

    await screen.findByText('2 photos uploaded.')
    expect(apiMock.uploadProofOfClass.mock.calls.map(([input]) => [input.sessionId, input.photoData])).toEqual([
      ['sess-1', 'data:image/jpeg;base64,a'],
      ['sess-1', 'data:image/jpeg;base64,b'],
    ])
    expect(onUploaded).toHaveBeenCalledTimes(1)
  })

  it('keeps the photos that did not upload so they can be tried again', async () => {
    apiMock.uploadProofOfClass.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Photos can only be uploaded while the class is ongoing'))
    const onUploaded = setup()
    choose([photo('a'), photo('b'), photo('c')])
    fireEvent.click(await screen.findByRole('button', { name: 'Upload 3 photos' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('1 uploaded.'))
    expect(screen.getByRole('button', { name: 'Upload 2 photos' })).toBeInTheDocument()
    expect(onUploaded).toHaveBeenCalledTimes(1)
  })

  it('offers no pickers once all four are used', () => {
    setup(4)
    expect(screen.getByText('You have added all 4 photos for this session.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Take a photo')).not.toBeInTheDocument()
  })
})
