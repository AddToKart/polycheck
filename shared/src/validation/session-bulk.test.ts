import { describe, expect, it } from 'vitest'
import { BulkSessionCreateSchema, SectionCreateSchema } from './index'

const baseBulk = {
  sectionId: 'sec-001',
  subjectName: 'IT Elective',
  startDate: '2026-11-10',
  endDate: '2026-11-30',
  geofence: { latitude: 14.8697, longitude: 120.9991, radiusMeters: 40 },
}

describe('SectionCreateSchema course', () => {
  const baseSection = {
    subjectId: 'subj-001',
    section: '4-1',
    room: 'CCIS Lab 3',
    semester: '1st Semester AY 2026-2027',
    schedule: [{ day: 'Mon', startTime: '08:00', endTime: '10:30' }],
  }

  it('accepts a course code', () => {
    const result = SectionCreateSchema.safeParse({ ...baseSection, course: 'BSIT' })
    expect(result.success).toBe(true)
  })

  it('stays backward compatible when the course is omitted', () => {
    const result = SectionCreateSchema.safeParse(baseSection)
    expect(result.success).toBe(true)
  })

  it('rejects a blank course when the field is supplied', () => {
    const result = SectionCreateSchema.safeParse({ ...baseSection, course: '   ' })
    expect(result.success).toBe(false)
  })

  it('rejects oversized course values', () => {
    const result = SectionCreateSchema.safeParse({ ...baseSection, course: 'X'.repeat(31) })
    expect(result.success).toBe(false)
  })
})

describe('BulkSessionCreateSchema', () => {
  it('accepts the legacy single-pair shape', () => {
    const result = BulkSessionCreateSchema.safeParse({
      ...baseBulk,
      daysOfWeek: ['Mon'],
      startTime: '08:00',
      endTime: '10:30',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a slot-aware payload without the legacy fields', () => {
    const result = BulkSessionCreateSchema.safeParse({
      ...baseBulk,
      slots: [
        { day: 'Mon', startTime: '08:00', endTime: '10:30' },
        { day: 'Wed', startTime: '09:00', endTime: '12:30' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts both shapes (slots win at the API layer)', () => {
    const result = BulkSessionCreateSchema.safeParse({
      ...baseBulk,
      daysOfWeek: ['Mon'],
      startTime: '10:00',
      endTime: '11:00',
      slots: [{ day: 'Mon', startTime: '08:00', endTime: '10:30' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a slot whose end time is not after its start time', () => {
    const result = BulkSessionCreateSchema.safeParse({
      ...baseBulk,
      slots: [{ day: 'Mon', startTime: '10:00', endTime: '09:00' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects duplicate slots', () => {
    const result = BulkSessionCreateSchema.safeParse({
      ...baseBulk,
      slots: [
        { day: 'Mon', startTime: '08:00', endTime: '10:30' },
        { day: 'Mon', startTime: '08:00', endTime: '10:30' },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('requires the legacy fields when slots are absent', () => {
    expect(BulkSessionCreateSchema.safeParse({ ...baseBulk }).success).toBe(false)
    expect(
      BulkSessionCreateSchema.safeParse({ ...baseBulk, daysOfWeek: ['Mon'] }).success,
    ).toBe(false)
    expect(
      BulkSessionCreateSchema.safeParse({
        ...baseBulk,
        daysOfWeek: ['Mon'],
        startTime: '10:00',
        endTime: '09:00',
      }).success,
    ).toBe(false)
  })

  it('rejects an end date before the start date', () => {
    const result = BulkSessionCreateSchema.safeParse({
      ...baseBulk,
      endDate: '2026-11-01',
      slots: [{ day: 'Mon', startTime: '08:00', endTime: '10:30' }],
    })
    expect(result.success).toBe(false)
  })
})
