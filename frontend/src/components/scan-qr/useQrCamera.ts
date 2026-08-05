'use client'

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { ScanInputChannel } from '@polycheck/shared'
import type { IScannerControls } from '@zxing/browser'
import { isBarcodeDetectorSupported, type InputMode, type ScanPhase } from './types'

interface UseQrCameraOptions {
  phase: ScanPhase
  setPhase: Dispatch<SetStateAction<ScanPhase>>
  facingMode: 'environment' | 'user'
  setFacingMode: Dispatch<SetStateAction<'environment' | 'user'>>
  setInputMode: Dispatch<SetStateAction<InputMode>>
  setCameraError: Dispatch<SetStateAction<string>>
  scannedRef: MutableRefObject<boolean>
  handleTokenRef: MutableRefObject<(token: string, channel: ScanInputChannel) => Promise<void>>
  allowFallbacks: boolean
}

export function useQrCamera(options: UseQrCameraOptions) {
  const { phase, setPhase, facingMode, setFacingMode, setInputMode, setCameraError, scannedRef, handleTokenRef, allowFallbacks } = options
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const zxingControlsRef = useRef<IScannerControls | null>(null)
  const cameraRequestRef = useRef(0)
  const detectorRef = useRef<BarcodeDetector | null>(null)

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = null
    }
    zxingControlsRef.current?.stop()
    zxingControlsRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const startCamera = useCallback(async (overrideFacingMode?: 'environment' | 'user') => {
    const targetFacing = overrideFacingMode ?? facingMode
    const requestId = ++cameraRequestRef.current
    setPhase('requesting-camera')
    setCameraError('')
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: targetFacing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        return
      }
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      if (requestId === cameraRequestRef.current) setPhase('scanning')
    } catch (error: unknown) {
      if (requestId !== cameraRequestRef.current) return
      const message = error instanceof Error && error.name === 'NotAllowedError'
        ? 'Camera access denied. Enable camera permission to scan attendance QR codes.'
        : error instanceof Error && error.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : 'Camera unavailable.'
      setCameraError(message)
      if (allowFallbacks) setInputMode('upload')
      setPhase('idle')
    }
  }, [allowFallbacks, facingMode, setCameraError, setInputMode, setPhase])

  const toggleCameraFacing = useCallback(() => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextFacing)
    stopCamera()
    void startCamera(nextFacing)
  }, [facingMode, setFacingMode, startCamera, stopCamera])

  const processScanResult = useCallback(async (rawToken: string) => {
    if (scannedRef.current) return
    const token = rawToken.trim()
    if (!token) return
    scannedRef.current = true
    stopCamera()
    await handleTokenRef.current(token, 'camera')
  }, [handleTokenRef, scannedRef, stopCamera])

  useEffect(() => {
    if (phase !== 'scanning') return
    if (isBarcodeDetectorSupported() && !detectorRef.current) detectorRef.current = new BarcodeDetector({ formats: ['qr_code'] })
    const detector = detectorRef.current
    let cancelled = false
    let lastAttemptAt = 0
    const loop = async (timestamp: number) => {
      if (cancelled) return
      if (!videoRef.current || videoRef.current.readyState < 2 || timestamp - lastAttemptAt < 100) {
        scanLoopRef.current = requestAnimationFrame(loop)
        return
      }
      lastAttemptAt = timestamp
      if (detector) {
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) {
            await processScanResult(codes[0].rawValue)
            return
          }
        } catch {
          // The next animation frame retries while the decoder or video warms up.
        }
      }
      scanLoopRef.current = requestAnimationFrame(loop)
    }

    if (detector) {
      scanLoopRef.current = requestAnimationFrame(loop)
    } else {
      void import('@zxing/browser').then(async ({ BrowserQRCodeReader }) => {
        if (cancelled || !videoRef.current) return
        const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 200, delayBetweenScanSuccess: 500 })
        const controls = await reader.decodeFromVideoElement(videoRef.current, (result) => { if (result && !cancelled) void processScanResult(result.getText()) })
        if (cancelled) controls.stop()
        else zxingControlsRef.current = controls
      }).catch(() => { if (!cancelled) setCameraError('This browser could not start the QR decoder.') })
    }
    return () => {
      cancelled = true
      if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
      zxingControlsRef.current?.stop()
      zxingControlsRef.current = null
    }
  }, [phase, processScanResult, setCameraError])

  useEffect(() => {
    if (phase === 'idle') void startCamera()
    return stopCamera
    // Camera startup belongs to the modal mount; state changes are handled explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { videoRef, startCamera, stopCamera, toggleCameraFacing }
}
