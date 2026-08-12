/**
 * Coordinates cockpit reads with authoritative session mutations.
 *
 * A read may have been sent before Generate/End but resolve afterwards. Epochs
 * ensure that response cannot overwrite the mutation response. Reads started
 * while a mutation is pending are also invalidated when that mutation settles.
 */
export class SessionRequestCoordinator {
  private epoch = 0
  private mutationsInFlight = 0

  beginRead() {
    return this.epoch
  }

  canCommitRead(readEpoch: number) {
    return this.mutationsInFlight === 0 && readEpoch === this.epoch
  }

  beginMutation() {
    this.mutationsInFlight += 1
    this.epoch += 1
    return this.epoch
  }

  commitMutation(mutationEpoch: number) {
    this.mutationsInFlight = Math.max(0, this.mutationsInFlight - 1)
    if (mutationEpoch !== this.epoch) return false
    // Invalidate reads that began after mutation start but before its response.
    this.epoch += 1
    return true
  }

  abortMutation(mutationEpoch: number) {
    this.mutationsInFlight = Math.max(0, this.mutationsInFlight - 1)
    if (mutationEpoch === this.epoch) this.epoch += 1
  }

  /**
   * Starts a server-authoritative reconciliation after an ambiguous mutation
   * failure. Any older reads or overlapping mutation responses become stale,
   * and cannot block or overwrite the reconciliation response.
   */
  resetForReconciliation() {
    this.mutationsInFlight = 0
    this.epoch += 1
  }
}
