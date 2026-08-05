'use client'

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Camera, Keyboard, QrCode, Upload, X } from 'lucide-react'
import type { ScanInputChannel, Student } from '@polycheck/shared'
import { decodeTokenPayload } from '@polycheck/shared/utils'
import { ScanQrViews } from '@/components/scan-qr/ScanQrViews'
import { isBarcodeDetectorSupported, type InputMode, type ScanOutcome, type ScanPhase } from '@/components/scan-qr/types'
import { useQrCamera } from '@/components/scan-qr/useQrCamera'
import { api } from '@/lib/api-client'
import { getOrCreateWebInstallationId } from '@/lib/device-id'

const ALLOW_QR_FALLBACKS = process.env.NEXT_PUBLIC_ALLOW_QR_FALLBACKS === 'true'

interface ScanQrModalProps {
  user: Student
  onClose: () => void
  sessionId?: string
}

export default function ScanQrModal({ user, onClose, sessionId }: ScanQrModalProps) {
  const scannedRef = useRef(false)
  const handleTokenRef = useRef<(token: string, channel: ScanInputChannel) => Promise<void>>(async () => {})
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [inputMode, setInputMode] = useState<InputMode>('camera')
  const [phase, setPhase] = useState<ScanPhase>('idle')
  const [outcome, setOutcome] = useState<ScanOutcome>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [locationStatus, setLocationStatus] = useState('')
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  const { videoRef, startCamera, stopCamera, toggleCameraFacing } = useQrCamera({
    phase,
    setPhase,
    facingMode,
    setFacingMode,
    setInputMode,
    setCameraError,
    scannedRef,
    handleTokenRef,
    allowFallbacks: ALLOW_QR_FALLBACKS,
  })

  const handleImageFile = useCallback(async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'].includes(file.type)) {
      setUploadError('Unsupported file type. Use JPEG, PNG, WebP, or BMP.')
      return
    }
    if (file.size > 10_000_000) {
      setUploadError('Image is too large. Maximum size is 10 MB.')
      return
    }
    setUploadError('')
    setUploadFileName(file.name)
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    setUploadPreview(dataUrl)
  }, [])

  const handleDecodeUpload = useCallback(async () => {
    if (!uploadPreview) return
    setUploadError('')
    setPhase('decoding-image')
    let rawToken: string | null = null
    if (isBarcodeDetectorSupported()) {
      try {
        const image = new Image()
        image.src = uploadPreview
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject })
        const codes = await new BarcodeDetector({ formats: ['qr_code'] }).detect(image)
        if (codes.length > 0) rawToken = codes[0].rawValue
      } catch {
        // ZXing below is the compatibility path for browsers without native decoding.
      }
    }
    if (!rawToken) {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        rawToken = (await new BrowserQRCodeReader().decodeFromImageUrl(uploadPreview)).getText()
      } catch {
        // The user-facing error below covers unreadable images.
      }
    }
    if (!rawToken) {
      setUploadError('No QR code found in this image. Make sure the entire QR is visible and try again.')
      setPhase('idle')
      return
    }
    scannedRef.current = true
    await handleTokenRef.current(rawToken, 'image')
  }, [uploadPreview])

  const getCurrentPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 })
  })

  const handleToken = useCallback(async (token: string, inputChannel: ScanInputChannel) => {
    const payload = decodeTokenPayload(token)
    if (!payload) {
      setErrorMessage('Invalid QR code — could not read the token.')
      setPhase('error')
      return
    }
    if (sessionId && payload.sessionId !== sessionId) {
      setErrorMessage('This QR code belongs to a different session.')
      setPhase('error')
      return
    }

    setPhase('acquiring-location')
    setLocationStatus('Getting your location…')
    let position: GeolocationPosition
    try {
      position = await getCurrentPosition()
      setLocationStatus(`Location acquired (±${Math.round(position.coords.accuracy)}m)`)
    } catch (error: unknown) {
      const denied = error instanceof GeolocationPositionError && error.code === GeolocationPositionError.PERMISSION_DENIED
      setErrorMessage(denied ? 'Location access was denied. Allow location in your browser settings and try again.' : 'Unable to determine your location. Check your settings and try again.')
      setPhase('error')
      return
    }

    setPhase('submitting')
    try {
      const result = await api.submitScan(
        payload.sessionId,
        user.id,
        user.fullName,
        position.coords.latitude,
        position.coords.longitude,
        getOrCreateWebInstallationId(),
        token,
        new Date().toISOString(),
        {
          clientAttemptId: crypto.randomUUID(),
          accuracyMeters: position.coords.accuracy,
          locationCapturedAt: new Date(position.timestamp).toISOString(),
          inputChannel,
        },
      )
      if ('error' in result) {
        setErrorMessage(result.error)
        setPhase('error')
        return
      }
      setOutcome({ status: result.status as 'present' | 'late' | 'disputed', message: `Attendance recorded as ${result.status}.` })
      setPhase('success')
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred. Try again.')
      setPhase('error')
    }
  }, [sessionId, user])

  useEffect(() => { handleTokenRef.current = handleToken }, [handleToken])

  const switchMode = useCallback((mode: InputMode) => {
    if (mode === inputMode) return
    if (inputMode === 'camera') stopCamera()
    if (inputMode === 'upload') {
      setUploadPreview(null)
      setUploadFileName('')
      setUploadError('')
    }
    scannedRef.current = false
    setInputMode(mode)
    setPhase('idle')
    if (mode === 'camera') void startCamera()
  }, [inputMode, startCamera, stopCamera])

  const reset = useCallback(() => {
    scannedRef.current = false
    setOutcome(null)
    setErrorMessage('')
    setManualToken('')
    setLocationStatus('')
    setUploadPreview(null)
    setUploadFileName('')
    setUploadError('')
    setPhase('idle')
    if (inputMode === 'camera') void startCamera()
  }, [inputMode, startCamera])

  const handleClose = useCallback(() => { stopCamera(); onClose() }, [onClose, stopCamera])

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose()
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handleKey)
    return () => { window.removeEventListener('keydown', handleKey); previouslyFocused?.focus() }
  }, [handleClose])

  const handleManualSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const token = manualToken.trim()
    if (!token) return
    scannedRef.current = true
    stopCamera()
    await handleToken(token, 'manual')
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) void handleImageFile(file)
  }

  const isProcessing = phase === 'acquiring-location' || phase === 'submitting' || phase === 'decoding-image'
  const showTabs = phase !== 'success' && phase !== 'error' && !isProcessing
  const tabs = [
    { mode: 'camera' as const, label: 'Camera', icon: <Camera className="w-3.5 h-3.5" /> },
    ...(ALLOW_QR_FALLBACKS ? [
      { mode: 'upload' as const, label: 'Upload QR', icon: <Upload className="w-3.5 h-3.5" /> },
      { mode: 'manual' as const, label: 'Enter Code', icon: <Keyboard className="w-3.5 h-3.5" /> },
    ] : []),
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-pup-black/90 backdrop-blur-sm" aria-modal="true" role="dialog" aria-labelledby="scan-qr-title" onClick={(event) => { if (event.target === event.currentTarget) handleClose() }}>
      <div ref={panelRef} className="relative w-full max-w-lg mx-4 bg-background border-2 border-zinc-300 dark:border-zinc-800 shadow-2xl flex flex-col h-[540px] max-h-[92dvh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-maroon text-white shrink-0">
          <div className="flex items-center gap-3"><QrCode className="w-5 h-5 text-golden" /><div><p id="scan-qr-title" className="text-[10px] font-bold uppercase tracking-widest text-white/70">Scan attendance QR code</p><p className="text-sm font-bold text-golden font-heading">{user.fullName}</p></div></div>
          <button ref={closeButtonRef} onClick={handleClose} className="p-1.5 hover:bg-white/10 transition-colors rounded-none" aria-label="Close scanner"><X className="w-5 h-5" /></button>
        </div>
        {showTabs ? <div className="flex border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50 dark:bg-zinc-900/50">{tabs.map(({ mode, label, icon }) => <button key={mode} onClick={() => switchMode(mode)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${inputMode === mode ? 'text-maroon dark:text-golden border-b-2 border-maroon dark:border-golden bg-background' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 border-b-2 border-transparent'}`}>{icon}{label}</button>)}</div> : null}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto h-full">
          <ScanQrViews ref={videoRef} phase={phase} outcome={outcome} errorMessage={errorMessage} locationStatus={locationStatus} inputMode={inputMode} cameraError={cameraError} facingMode={facingMode} uploadPreview={uploadPreview} uploadFileName={uploadFileName} uploadError={uploadError} manualToken={manualToken} setManualToken={setManualToken} onClose={handleClose} onReset={reset} onToggleCamera={toggleCameraFacing} onDrop={handleDrop} onImageFile={(file) => void handleImageFile(file)} onDecodeUpload={() => void handleDecodeUpload()} onManualSubmit={(event) => void handleManualSubmit(event)} />
        </div>
      </div>
      <style>{`@keyframes scanLine { 0% { top: 10%; opacity: 1; } 50% { top: 90%; opacity: 0.6; } 100% { top: 10%; opacity: 1; } }`}</style>
    </div>
  )
}
