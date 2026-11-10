import { BadRequestException } from '@nestjs/common'
import { DocsController } from './docs.controller'
import type { DocsService } from './docs.service'
import { ROLES_KEY } from '../common/decorators/roles.decorator'
import { REQUIRED_DESIGNATIONS_KEY } from '../common/decorators/require-designation.decorator'
import { SettingsController } from '../settings/settings.controller'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'

type ControllerMethod = (...args: never[]) => unknown

const rolesFor = (method: ControllerMethod): string[] => Reflect.getMetadata(ROLES_KEY, method) ?? []
const designationsFor = (method: ControllerMethod): string[] =>
  Reflect.getMetadata(REQUIRED_DESIGNATIONS_KEY, method) ?? []

const user = { id: 'teacher-1', role: 'teacher', isItCoordinator: true } as AuthenticatedRequest['user']
const mockResponse = { setHeader: jest.fn(), status: jest.fn(), send: jest.fn() } as never

describe('DocsController (F4/F6)', () => {
  it('opens the class record to teachers and super admins without a designation gate', () => {
    expect(rolesFor(DocsController.prototype.classRecord as ControllerMethod)).toEqual(['teacher', 'super_admin'])
    expect(designationsFor(DocsController.prototype.classRecord as ControllerMethod)).toEqual([])
  })

  it('gates the DPO summary behind the IT-designation suite (institution super admins pass)', () => {
    expect(rolesFor(DocsController.prototype.dpoSummary as ControllerMethod).sort()).toEqual(['super_admin', 'teacher'])
    expect(designationsFor(DocsController.prototype.dpoSummary as ControllerMethod)).toEqual(['it_operations'])
    expect(rolesFor(SettingsController.prototype.privacyCenter as ControllerMethod).sort()).toEqual([
      'super_admin',
      'teacher',
    ])
    expect(designationsFor(SettingsController.prototype.privacyCenter as ControllerMethod)).toEqual(['it_operations'])
  })

  function makeController(documents: Partial<Record<string, unknown>> = {}) {
    const docs = {
      classRecord: jest.fn().mockResolvedValue(
        documents.classRecord ?? {
          filename: 'PUP-ClassRecord-COMP-20043-BSIT-1-A.pdf',
          contentType: 'application/pdf',
          body: Buffer.from('%PDF'),
        },
      ),
      dpoSummary: jest.fn().mockResolvedValue(
        documents.dpoSummary ?? {
          filename: 'dpo-summary.pdf',
          contentType: 'application/pdf',
          body: Buffer.from('%PDF'),
        },
      ),
    }
    const controller = new DocsController(docs as unknown as DocsService)
    return { controller, docs }
  }

  const request = { user } as AuthenticatedRequest

  it('forwards the section id, format, and from anchor to the service', async () => {
    const { controller, docs } = makeController()

    await controller.classRecord(request, 'sec-1', mockResponse, 'docx', '2026-08-14')

    expect(docs.classRecord).toHaveBeenCalledWith(user, 'sec-1', 'docx', '2026-08-14')
  })

  it('defaults the class-record format to pdf and clears an empty anchor', async () => {
    const { controller, docs } = makeController()

    await controller.classRecord(request, 'sec-1', mockResponse, undefined, '  ')

    expect(docs.classRecord).toHaveBeenCalledWith(user, 'sec-1', 'pdf', null)
  })

  it.each([
    ['nope', 'format must be one of: pdf, docx'],
    ['not-a-date', 'from must be an ISO calendar date formatted as YYYY-MM-DD'],
  ])('rejects unsupported class-record parameters: %s', async (source, message) => {
    const { controller } = makeController()
    const isFormat = source === 'nope'

    await expect(
      isFormat
        ? controller.classRecord(request, 'sec-1', mockResponse, source, undefined)
        : controller.classRecord(request, 'sec-1', mockResponse, 'pdf', source),
    ).rejects.toThrow(message)
  })

  it('validates the section identifier length', async () => {
    const { controller, docs } = makeController()

    await expect(controller.classRecord(request, '', mockResponse, 'pdf', undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(docs.classRecord).not.toHaveBeenCalled()
  })

  it('defaults the DPO summary format to pdf and streams the attachment headers', async () => {
    const { controller, docs } = makeController()
    const headers = new Map<string, string>()
    const response = { setHeader: (name: string, value: string) => headers.set(name, value) } as never

    const stream = await controller.dpoSummary(request, response, undefined)

    expect(docs.dpoSummary).toHaveBeenCalledWith(user, 'pdf')
    expect(headers.get('Content-Type')).toBe('application/pdf')
    expect(headers.get('Content-Disposition')).toBe('attachment; filename="dpo-summary.pdf"')
    expect((stream as { buffer?: Buffer }).buffer).toBeUndefined()
  })
})
