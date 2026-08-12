import {
  isScannerOperationCurrent,
  resetScannerOnBlur,
  shouldMountScannerCamera,
} from '../hooks/scanner-focus-lifecycle'

describe('scanner focus lifecycle', () => {
  it('mounts the camera only while focused and permission is granted', () => {
    expect(shouldMountScannerCamera(true, true)).toBe(true)
    expect(shouldMountScannerCamera(false, true)).toBe(false)
    expect(shouldMountScannerCamera(true, false)).toBe(false)
  })

  it('turns off the torch, unlocks scanning, and clears transient scan state on blur', () => {
    jest.useFakeTimers()
    const timeout = setTimeout(() => undefined, 5_000)
    const timeoutRef = { current: timeout as ReturnType<typeof setTimeout> | null }
    const scannedRef = { current: true }
    const focusedRef = { current: true }
    const scanOpRef = { current: 4 }
    const setFocused = jest.fn()
    const setTorchOn = jest.fn()
    const setResult = jest.fn()
    const setShowManual = jest.fn()
    const setManualToken = jest.fn()
    const setDecodingImage = jest.fn()

    resetScannerOnBlur({
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
    })

    expect(focusedRef.current).toBe(false)
    expect(scannedRef.current).toBe(false)
    expect(timeoutRef.current).toBeNull()
    expect(setFocused).toHaveBeenCalledWith(false)
    expect(setTorchOn).toHaveBeenCalledWith(false)
    expect(setResult).toHaveBeenCalledWith(null)
    expect(setShowManual).toHaveBeenCalledWith(false)
    expect(setManualToken).toHaveBeenCalledWith('')
    expect(setDecodingImage).toHaveBeenCalledWith(false)
    jest.useRealTimers()
  })

  it('invalidates an in-flight scan on blur by advancing the operation generation', () => {
    const focusedRef = { current: true }
    const scanOpRef = { current: 1 }
    const scannedRef = { current: true }
    const timeoutRef = { current: null }
    const setFocused = jest.fn()
    const setTorchOn = jest.fn()
    const setResult = jest.fn()
    const setShowManual = jest.fn()
    const setManualToken = jest.fn()
    const setDecodingImage = jest.fn()

    // A scan that started before the blur is no longer current.
    expect(isScannerOperationCurrent(focusedRef, scanOpRef, 1)).toBe(true)

    resetScannerOnBlur({
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
    })

    expect(scanOpRef.current).toBe(2)
    expect(isScannerOperationCurrent(focusedRef, scanOpRef, 1)).toBe(false)
    // After the user refocuses (focusedRef restored), a scan started with the
    // new generation is current again; the pre-blur scan stays invalid.
    focusedRef.current = true
    expect(isScannerOperationCurrent(focusedRef, scanOpRef, 2)).toBe(true)
    expect(isScannerOperationCurrent(focusedRef, scanOpRef, 1)).toBe(false)
  })

  it('never treats a pre-blur image upload as current after refocus', () => {
    const focusedRef = { current: true }
    const scanOpRef = { current: 8 }
    const uploadGeneration = scanOpRef.current

    focusedRef.current = false
    scanOpRef.current += 1
    focusedRef.current = true

    expect(isScannerOperationCurrent(focusedRef, scanOpRef, uploadGeneration)).toBe(false)
    expect(isScannerOperationCurrent(focusedRef, scanOpRef, scanOpRef.current)).toBe(true)
  })
})
