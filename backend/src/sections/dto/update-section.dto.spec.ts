import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { UpdateSectionDto } from './update-section.dto'

function request(overrides: Record<string, unknown> = {}) {
  return plainToInstance(UpdateSectionDto, overrides)
}

describe('UpdateSectionDto schedule validation (DD-B5)', () => {
  it('accepts a complete, well-formed schedule entry', async () => {
    const dto = request({
      schedule: [{ day: 'Mon', startTime: '09:00', endTime: '10:30', room: 'E-201' }],
    })

    await expect(validate(dto)).resolves.toEqual([])
  })

  it.each([
    ['an unknown weekday', { day: 'Funday', startTime: '09:00', endTime: '10:00' }],
    ['a single-digit hour', { day: 'Mon', startTime: '9:00', endTime: '10:00' }],
    ['an out-of-range hour', { day: 'Mon', startTime: '24:00', endTime: '25:00' }],
    ['a missing start time', { day: 'Mon', endTime: '10:00' }],
    ['a missing end time', { day: 'Mon', startTime: '09:00' }],
  ])('rejects %s', async (_label, entry) => {
    await expect(validate(request({ schedule: [entry] }))).resolves.not.toEqual([])
  })
})
