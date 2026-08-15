type MutableRef<T> = { current: T }

interface ScannerBlurState {
  timeoutRef: MutableRef<ReturnType<typeof setTimeout> | null>
  scannedRef: MutableRef<boolean>
  focusedRef: MutableRef<boolean>
  /** Monotonic generation counter; blur increments it to invalidate in-flight scans. */
  scanOpRef: MutableRef<number>
  setFocused: (focused: boolean) => void
  setTorchOn: (enabled: boolean) => void
  setResult: (result: null) => void
  setShowManual: (visible: boolean) => void
  setManualToken: (token: string) => void
  setDecodingImage: (decoding: boolean) => void
}

export const shouldMountScannerCamera = (focused: boolean, permissionGranted: boolean) =>
  focused && permissionGranted

/** Returns true while the screen is focused and no blur has occurred since the scan began. */
export const isScannerOperationCurrent = (
  focusedRef: MutableRef<boolean>,
  scanOpRef: MutableRef<number>,
  operationId: number,
) => focusedRef.current && scanOpRef.current === operationId

export const resetScannerOnBlur = ({
  timeoutRef,
  scannedRef,
  focusedRef,
  scanOpRef,
  setFocused,
  setTorchOn,
  setResult,
  setShowManual,
  setManualToken,
  setDecodingImage,
}: ScannerBlurState) => {
  focusedRef.current = false
  // Invalidate any scan that is still awaiting location/submission so it can
  // neither record attendance nor surface a result after leaving the screen.
  scanOpRef.current += 1
  scannedRef.current = false
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }
  setFocused(false)
  setTorchOn(false)
  setResult(null)
  setShowManual(false)
  setManualToken('')
  setDecodingImage(false)
}
