import { describe, expect, it } from 'vitest'
import { SessionRequestCoordinator } from './session-request-coordinator'

describe('SessionRequestCoordinator', () => {
  it('invalidates a read that began before an authoritative mutation', () => {
    const coordinator = new SessionRequestCoordinator()
    const read = coordinator.beginRead()
    const mutation = coordinator.beginMutation()

    expect(coordinator.canCommitRead(read)).toBe(false)
    expect(coordinator.commitMutation(mutation)).toBe(true)
    expect(coordinator.canCommitRead(read)).toBe(false)
  })

  it('invalidates reads started while a mutation is awaiting its response', () => {
    const coordinator = new SessionRequestCoordinator()
    const mutation = coordinator.beginMutation()
    const read = coordinator.beginRead()

    expect(coordinator.canCommitRead(read)).toBe(false)
    coordinator.commitMutation(mutation)
    expect(coordinator.canCommitRead(read)).toBe(false)
    expect(coordinator.canCommitRead(coordinator.beginRead())).toBe(true)
  })

  it('allows reconciliation to supersede failed and overlapping mutations', () => {
    const coordinator = new SessionRequestCoordinator()
    const failedMutation = coordinator.beginMutation()
    const overlappingMutation = coordinator.beginMutation()

    coordinator.abortMutation(failedMutation)
    coordinator.resetForReconciliation()
    const reconciliationRead = coordinator.beginRead()

    expect(coordinator.canCommitRead(reconciliationRead)).toBe(true)
    expect(coordinator.commitMutation(overlappingMutation)).toBe(false)
    expect(coordinator.canCommitRead(reconciliationRead)).toBe(true)
  })
})
