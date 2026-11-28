import { ConflictException, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AttendanceController } from '../../attendance/attendance.controller'
import { DisputesController } from '../../disputes/disputes.controller'
import { ProofsController } from '../../proofs/proofs.controller'
import { SectionsController } from '../../sections/sections.controller'
import { SessionsController } from '../../sessions/sessions.controller'
import { SubjectsController } from '../../subjects/subjects.controller'
import { ArchivedSubjectGuard } from './archived-subject.guard'

type Handler = (...args: never[]) => unknown

function context(handler: Handler, request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}

describe('ArchivedSubjectGuard', () => {
  const findFirst = jest.fn()
  const guard = new ArchivedSubjectGuard({ subject: { findFirst } } as never, new Reflector())
  beforeEach(() => findFirst.mockReset())

  it('refuses a change under an archived subject with a code the apps understand', async () => {
    findFirst.mockResolvedValue({ id: 'subj-1' })
    const attempt = guard.canActivate(context(SessionsController.prototype.create, { body: { sectionId: 'sec-1' } }))
    await expect(attempt).rejects.toThrow(ConflictException)
    await attempt.catch((error: ConflictException) => {
      expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'subject_archived' }))
    })
    expect(findFirst.mock.calls[0][0].where).toEqual({
      AND: [{ sections: { some: { id: 'sec-1' } } }, { archivedAt: { not: null } }],
    })
  })

  it('lets the same change through for an active subject', async () => {
    findFirst.mockResolvedValue(null)
    await expect(
      guard.canActivate(context(SessionsController.prototype.activate, { params: { id: 'sess-1' } })),
    ).resolves.toBe(true)
  })

  it('leaves a missing or malformed id to validation', async () => {
    await expect(guard.canActivate(context(SessionsController.prototype.create, { body: {} }))).resolves.toBe(true)
    await expect(
      guard.canActivate(context(SessionsController.prototype.create, { body: { sectionId: { $ne: null } } })),
    ).resolves.toBe(true)
    expect(findFirst).not.toHaveBeenCalled()
  })

  it.each<[string, Handler]>([
    ['add a section', SectionsController.prototype.create],
    ['edit a section', SectionsController.prototype.update],
    ['enrol a student', SectionsController.prototype.enrollStudent],
    ['import a class list', SectionsController.prototype.importEnrollments],
    ['create sessions in bulk', SessionsController.prototype.createBulk],
    ['reschedule a session', SessionsController.prototype.reschedule],
    ['start a session', SessionsController.prototype.activate],
    ['mark attendance', AttendanceController.prototype.createManual],
    ['change a status', AttendanceController.prototype.updateStatus],
    ['resolve a dispute', DisputesController.prototype.resolve],
    ['upload a photo', ProofsController.prototype.upload],
    ['delete a photo', ProofsController.prototype.remove],
    ['edit the subject', SubjectsController.prototype.update],
  ])('covers the route to %s', async (_label, handler) => {
    findFirst.mockResolvedValue({ id: 'subj-1' })
    const everyId = { id: 'x', sectionId: 'x', sessionId: 'x', recordId: 'x', subjectId: 'x' }
    await expect(guard.canActivate(context(handler, { params: everyId, body: everyId }))).rejects.toThrow(/archived/)
  })

  it.each<[string, Handler]>([
    ['restore', SubjectsController.prototype.restore],
    ['delete for good', SubjectsController.prototype.deletePermanently],
  ])('never blocks the way out: %s', async (_label, handler) => {
    findFirst.mockResolvedValue({ id: 'subj-1' })
    await expect(guard.canActivate(context(handler, { params: { id: 'subj-1' } }))).resolves.toBe(true)
  })
})
