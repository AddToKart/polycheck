import { beforeEach, describe, expect, it } from 'vitest'
import { fingerprintHeaders, loadMappingProfile, saveMappingProfile } from './mapping-profiles'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

const HEADERS = ['Student No.', 'Name', 'Program']
const MAPPING = { studentId: 0, fullName: 1, program: 2 }

describe('mapping profiles', () => {
  let storage: MemoryStorage
  beforeEach(() => {
    storage = new MemoryStorage()
  })

  it('identifies a header layout regardless of case, spacing and punctuation', () => {
    expect(fingerprintHeaders(['Student No.', ' NAME ', 'Program'])).toBe(fingerprintHeaders(['student no', 'name', 'program']))
    expect(fingerprintHeaders(['Name', 'Program'])).not.toBe(fingerprintHeaders(['Program', 'Name']))
  })

  it('remembers a confirmed mapping and applies it to the same layout next time', () => {
    expect(loadMappingProfile(HEADERS, storage)).toBeNull()
    saveMappingProfile(HEADERS, MAPPING, storage)
    expect(loadMappingProfile(HEADERS, storage)).toEqual(MAPPING)
    expect(loadMappingProfile(['STUDENT NO', 'name', 'PROGRAM'], storage)).toEqual(MAPPING)
    expect(loadMappingProfile(['Student No.', 'Name'], storage)).toBeNull()
  })

  it('keeps separate profiles per layout and updates one in place', () => {
    const other = { studentId: 1, fullName: 0 }
    saveMappingProfile(HEADERS, MAPPING, storage)
    saveMappingProfile(['Name', 'ID'], other, storage)
    saveMappingProfile(HEADERS, { ...MAPPING, program: undefined }, storage)

    expect(loadMappingProfile(['Name', 'ID'], storage)).toEqual(other)
    expect(loadMappingProfile(HEADERS, storage)).toEqual({ studentId: 0, fullName: 1 })
    expect(JSON.parse(storage.getItem('polycheck-import-mapping-profiles-v1')!)).toHaveLength(2)
  })

  it('caps the number of stored profiles, newest first', () => {
    for (let index = 0; index < 40; index += 1) saveMappingProfile([`col ${index}`, 'id'], { studentId: 1 }, storage)
    const stored = JSON.parse(storage.getItem('polycheck-import-mapping-profiles-v1')!)
    expect(stored).toHaveLength(25)
    expect(loadMappingProfile(['col 39', 'id'], storage)).toEqual({ studentId: 1 })
    expect(loadMappingProfile(['col 0', 'id'], storage)).toBeNull()
  })

  it('stores header names and column positions only, never student data', () => {
    saveMappingProfile(HEADERS, MAPPING, storage)
    const raw = storage.getItem('polycheck-import-mapping-profiles-v1')!
    expect(raw).not.toMatch(/\d{4}-\d{5}-[A-Z]{2}-\d/)
  })

  it('still honours the single profile written by earlier versions', () => {
    storage.setItem('polycheck-import-mapping', JSON.stringify({ headers: HEADERS, mapping: MAPPING }))
    expect(loadMappingProfile(HEADERS, storage)).toEqual(MAPPING)
  })

  it('degrades silently when storage is missing, corrupt or full', () => {
    expect(loadMappingProfile(HEADERS, null)).toBeNull()
    expect(() => saveMappingProfile(HEADERS, MAPPING, null)).not.toThrow()

    storage.setItem('polycheck-import-mapping-profiles-v1', '{not json')
    expect(loadMappingProfile(HEADERS, storage)).toBeNull()

    const full = new MemoryStorage()
    full.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(() => saveMappingProfile(HEADERS, MAPPING, full)).not.toThrow()
  })
})
