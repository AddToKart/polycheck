'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  X, QrCode, MapPin, Keyboard, CheckCircle, XCircle,
  Clock, AlertTriangle, Loader2, RefreshCw, Upload, Camera,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { decodeTokenPayload } from '@polycheck/shared/utils'
import type { Student } from '@polycheck/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── Types ──────────────────────────────────────────────────────────────────
type InputMode = 'camera' | 'upload' | 'manual'

type ScanPhase =
  | 'idle'
  | 'requesting-camera'
  | 'scanning'
  | 'decoding-image'
  | 'acquiring-location'
  | 'submitting'
  | 'success'
  | 'error'

type ScanOutcome = {
  status: 'present' | 'late' | 'disputed'
  message: string
} | null

// ── Helpers ────────────────────────────────────────────────────────────────
function isBarcodeDetectorSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

// ── Component ──────────────────────────────────────────────────────────────
interface ScanQrModalProps {
  user: Student
  onClose: () => void
  /** Optional sessionId to pre-filter — supplied when launched from an active-session card */
  sessionId?: string
}

export default function ScanQrModal({ user, onClose, sessionId }: ScanQrModalProps) {
  // ── Camera refs ──────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const scannedRef = useRef(false)
  // BarcodeDetector not yet in TS lib typings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any | null>(null)

  // ── Upload refs ──────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── State ────────────────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>('camera')
  const [phase, setPhase] = useState<ScanPhase>('idle')
  const [outcome, setOutcome] = useState<ScanOutcome>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [locationStatus, setLocationStatus] = useState('')

  // Upload-specific state
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadError, setUploadError] = useState('')

  // ── Camera lifecycle ─────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setPhase('requesting-camera')
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setPhase('scanning')
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera access denied. Use Upload QR or Manual entry instead.'
          : err instanceof Error && err.name === 'NotFoundError'
            ? 'No camera found on this device. Use Upload QR or Manual entry instead.'
            : 'Camera unavailable. Use Upload QR or Manual entry instead.'
      setCameraError(msg)
      // Auto-switch to upload mode when camera fails
      setInputMode('upload')
      setPhase('idle')
    }
  }, [])

  // ── BarcodeDetector scan loop ────────────────────────────────────────────
  const processScanResult = useCallback(
    async (rawToken: string) => {
      if (scannedRef.current) return
      const trimmed = rawToken.trim()
      if (!trimmed) return
      scannedRef.current = true
      stopCamera()
      await handleToken(trimmed)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stopCamera]
  )

  useEffect(() => {
    if (phase !== 'scanning') return

    if (isBarcodeDetectorSupported() && !detectorRef.current) {
      // @ts-expect-error BarcodeDetector not in lib typings yet
      detectorRef.current = new BarcodeDetector({ formats: ['qr_code'] })
    }

    const detector = detectorRef.current

    const loop = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        scanLoopRef.current = requestAnimationFrame(loop)
        return
      }
      if (detector) {
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) {
            await processScanResult(codes[0].rawValue)
            return
          }
        } catch {
          // detector not ready — continue
        }
      } else if (canvasRef.current) {
        // zxing fallback — lazy import
        try {
          const ctx = canvasRef.current.getContext('2d')
          if (ctx && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth
            canvasRef.current.height = videoRef.current.videoHeight
            ctx.drawImage(videoRef.current, 0, 0)
            const { BrowserQRCodeReader } = await import('@zxing/browser')
            const reader = new BrowserQRCodeReader()
            const imgData = canvasRef.current.toDataURL()
            const result = await reader.decodeFromImageUrl(imgData)
            if (result) {
              await processScanResult(result.getText())
              return
            }
          }
        } catch {
          // no QR in this frame
        }
      }
      scanLoopRef.current = requestAnimationFrame(loop)
    }

    scanLoopRef.current = requestAnimationFrame(loop)
    return () => {
      if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
    }
  }, [phase, processScanResult])

  // ── Image upload & decode ────────────────────────────────────────────────
  const handleImageFile = useCallback(
    async (file: File) => {
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

      // Generate a data URL for preview
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setUploadPreview(dataUrl)
    },
    []
  )

  const handleDecodeUpload = useCallback(async () => {
    if (!uploadPreview) return
    setUploadError('')
    setPhase('decoding-image')

    let rawToken: string | null = null

    // 1. Try native BarcodeDetector on an Image element (fastest)
    if (isBarcodeDetectorSupported()) {
      try {
        const img = new Image()
        img.src = uploadPreview
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej })
        // @ts-expect-error BarcodeDetector not in lib typings yet
        const detector = new BarcodeDetector({ formats: ['qr_code'] })
        const codes = await detector.detect(img)
        if (codes.length > 0) rawToken = codes[0].rawValue
      } catch {
        // fall through to zxing
      }
    }

    // 2. zxing fallback
    if (!rawToken) {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        const reader = new BrowserQRCodeReader()
        const result = await reader.decodeFromImageUrl(uploadPreview)
        rawToken = result.getText()
      } catch {
        // no QR found
      }
    }

    if (!rawToken) {
      setUploadError('No QR code found in this image. Make sure the entire QR is visible and try again.')
      setPhase('idle')
      return
    }

    scannedRef.current = true
    await handleToken(rawToken)
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uploadPreview]
  )

  // ── Drag-and-drop support ────────────────────────────────────────────────
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleImageFile(file)
    },
    [handleImageFile]
  )

  // ── Geolocation ──────────────────────────────────────────────────────────
  const getCurrentPosition = (): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not available in this browser.'))
        return
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      })
    })

  // ── Core submission logic ────────────────────────────────────────────────
  // This is called from ALL three input modes — camera, upload, and manual.
  // Geofence enforcement is 100% server-side: the server re-validates GPS
  // coordinates against the session geofence regardless of input mode.
  const handleToken = useCallback(
    async (token: string) => {
      // 1. Decode payload locally (no sig check — server enforces that)
      const payload = decodeTokenPayload(token)
      if (!payload) {
        setErrorMessage('Invalid QR code — could not read the token.')
        setPhase('error')
        return
      }

      // 2. Session filter (when launched from a specific session card)
      if (sessionId && payload.sessionId !== sessionId) {
        setErrorMessage('This QR code belongs to a different session.')
        setPhase('error')
        return
      }

      // 3. Acquire live GPS — required for all input modes including upload.
      //    A student uploading a screenshot from off-campus still needs to be
      //    physically inside the geofence, so GPS is always captured fresh here.
      setPhase('acquiring-location')
      setLocationStatus('Getting your location…')
      let lat: number
      let lon: number
      try {
        const pos = await getCurrentPosition()
        lat = pos.coords.latitude
        lon = pos.coords.longitude
        setLocationStatus(`Location acquired (±${Math.round(pos.coords.accuracy)}m)`)
      } catch (err: unknown) {
        const denied =
          err instanceof GeolocationPositionError &&
          err.code === GeolocationPositionError.PERMISSION_DENIED
        setErrorMessage(
          denied
            ? 'Location access was denied. Allow location in your browser settings and try again.'
            : 'Unable to determine your location. Check your settings and try again.'
        )
        setPhase('error')
        return
      }

      // 4. Server validation + commit
      //    Server re-checks: Ed25519 signature, enrollment, geofence (Haversine),
      //    timestamp window, rate limit, duplicate.
      setPhase('submitting')
      try {
        const scannedAt = new Date().toISOString()
        const deviceId = `web-${user.id}`

        // Dry-run validation — surfaces a human-readable rejection reason
        const check = await api.checkAttendance(
          payload.sessionId,
          user.id,
          lat,
          lon,
          token,
          scannedAt,
        )

        if (!check.success) {
          const reason = check.reason ?? ''
          const msgMap: Record<string, string> = {
            outside_geofence:
              'You are outside the session geofence. You must be physically inside the classroom to check in.',
            qr_expired: 'The QR attendance window has closed.',
            session_inactive: 'This session is not currently active.',
            invalid_signature: 'QR code signature is invalid — the code may have been altered.',
            token_mismatch: 'This QR code does not match the active session.',
            not_enrolled: 'You are not enrolled in this section.',
            rate_limited: 'Too many attempts. Wait a moment and try again.',
            duplicate: 'Your attendance has already been recorded for this session.',
          }
          setErrorMessage(msgMap[reason] ?? check.message ?? 'Check-in was rejected by the server.')
          setPhase('error')
          return
        }

        // Commit the attendance record
        const result = await api.submitScan(
          payload.sessionId,
          user.id,
          user.fullName,
          lat,
          lon,
          deviceId,
          token,
          scannedAt,
        )

        if ('error' in result) {
          setErrorMessage(result.error)
          setPhase('error')
          return
        }

        setOutcome({
          status: (result.status as 'present' | 'late' | 'disputed') ?? check.status,
          message: check.message ?? 'Check-in recorded.',
        })
        setPhase('success')
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred. Try again.'
        )
        setPhase('error')
      }
    },
    [user, sessionId]
  )

  // ── Manual submit ────────────────────────────────────────────────────────
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = manualToken.trim()
    if (!trimmed) return
    scannedRef.current = true
    stopCamera()
    await handleToken(trimmed)
  }

  // ── Mode switching ───────────────────────────────────────────────────────
  const switchMode = useCallback(
    (mode: InputMode) => {
      if (mode === inputMode) return
      // Stop camera when leaving camera mode
      if (inputMode === 'camera') stopCamera()
      // Reset upload state when leaving upload mode
      if (inputMode === 'upload') {
        setUploadPreview(null)
        setUploadFileName('')
        setUploadError('')
      }
      scannedRef.current = false
      setInputMode(mode)
      setPhase('idle')
      if (mode === 'camera') startCamera()
    },
    [inputMode, stopCamera, startCamera]
  )

  // ── Reset (try again) ────────────────────────────────────────────────────
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
    if (inputMode === 'camera') startCamera()
  }, [inputMode, startCamera])

  // ── Mount / unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (inputMode === 'camera') startCamera()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Escape key ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { stopCamera(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, stopCamera])

  // ── Close ────────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    stopCamera()
    onClose()
  }, [stopCamera, onClose])

  // ── Derived UI state ─────────────────────────────────────────────────────
  const isProcessing =
    phase === 'acquiring-location' ||
    phase === 'submitting' ||
    phase === 'decoding-image'

  const showScanner = inputMode === 'camera' && (phase === 'scanning' || phase === 'requesting-camera')

  // ── Outcome config ───────────────────────────────────────────────────────
  const outcomeConfig = outcome
    ? outcome.status === 'present'
      ? {
          icon: CheckCircle,
          iconColor: 'text-golden',
          bg: 'bg-maroon border-golden',
          title: 'Verified — Present',
        }
      : outcome.status === 'late'
        ? {
            icon: Clock,
            iconColor: 'text-white',
            bg: 'bg-[#7B1113] border-white/30',
            title: 'Recorded — Late',
          }
        : {
            icon: AlertTriangle,
            iconColor: 'text-golden',
            bg: 'bg-maroon-dark border-golden/40',
            title: 'Flagged for Review',
          }
    : null

  // ── Tab config ───────────────────────────────────────────────────────────
  const tabs: { mode: InputMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'camera', label: 'Camera', icon: <Camera className="w-3.5 h-3.5" /> },
    { mode: 'upload', label: 'Upload QR', icon: <Upload className="w-3.5 h-3.5" /> },
    { mode: 'manual', label: 'Enter Code', icon: <Keyboard className="w-3.5 h-3.5" /> },
  ]

  const showTabs = phase !== 'success' && phase !== 'error' && !isProcessing

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pup-black/90 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-label="Scan attendance QR code"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 bg-background border-2 border-zinc-300 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-maroon text-white shrink-0">
          <div className="flex items-center gap-3">
            <QrCode className="w-5 h-5 text-golden" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Attendance Check-in</p>
              <p className="text-sm font-bold text-golden font-heading">{user.fullName}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-white/10 transition-colors rounded-none"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Input-mode tabs ── */}
        {showTabs && (
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50 dark:bg-zinc-900/50">
            {tabs.map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => switchMode(mode)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors
                  ${inputMode === mode
                    ? 'text-maroon dark:text-golden border-b-2 border-maroon dark:border-golden bg-background'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 border-b-2 border-transparent'
                  }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Success ── */}
          {phase === 'success' && outcomeConfig && (
            <div className="flex flex-col items-center justify-center p-10 text-center gap-6">
              <div className={`w-20 h-20 flex items-center justify-center border-2 ${outcomeConfig.bg}`}>
                <outcomeConfig.icon className={`w-10 h-10 ${outcomeConfig.iconColor}`} />
              </div>
              <div>
                <p className={`text-2xl font-heading font-bold uppercase tracking-wider ${
                  outcome?.status === 'present' ? 'text-maroon dark:text-golden' : 'text-foreground'
                }`}>
                  {outcomeConfig.title}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs mx-auto">
                  {outcome?.message}
                </p>
              </div>
              <Button
                onClick={handleClose}
                className="w-full rounded-none bg-maroon hover:bg-maroon-dark text-white uppercase tracking-widest font-bold text-xs h-10"
              >
                Done
              </Button>
            </div>
          )}

          {/* ── Error ── */}
          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center p-10 text-center gap-6">
              <div className="w-20 h-20 flex items-center justify-center border-2 border-red-500/40 bg-red-950/30">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <div>
                <p className="text-xl font-heading font-bold text-foreground uppercase tracking-wider">
                  Check-in Rejected
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs mx-auto">
                  {errorMessage}
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <Button
                  onClick={reset}
                  variant="outline"
                  className="flex-1 rounded-none border-zinc-300 dark:border-zinc-700 uppercase tracking-widest font-bold text-xs h-10"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={handleClose}
                  className="flex-1 rounded-none bg-maroon hover:bg-maroon-dark text-white uppercase tracking-widest font-bold text-xs h-10"
                >
                  Close
                </Button>
              </div>
            </div>
          )}

          {/* ── Processing ── */}
          {isProcessing && (
            <div className="flex flex-col items-center justify-center p-10 text-center gap-4">
              <Loader2 className="w-10 h-10 text-maroon dark:text-golden animate-spin" />
              <p className="text-sm font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                {phase === 'decoding-image'
                  ? 'Reading QR code from image…'
                  : phase === 'acquiring-location'
                    ? locationStatus || 'Acquiring location…'
                    : 'Verifying attendance…'}
              </p>
              {phase === 'acquiring-location' && (
                <p className="text-xs text-zinc-400 max-w-xs">
                  Your GPS location is required to confirm you are physically inside the classroom geofence.
                </p>
              )}
            </div>
          )}

          {/* ── Camera viewfinder ── */}
          {showScanner && !isProcessing && (
            <div className="flex flex-col">
              <div className="relative w-full bg-pup-black" style={{ aspectRatio: '4/3' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  aria-label="Camera viewfinder"
                />
                <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

                {/* Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="absolute inset-0 bg-pup-black/40" />
                  <div className="relative" style={{ width: '65%', aspectRatio: '1' }}>
                    <span className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-golden" />
                    <span className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-golden" />
                    <span className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-golden" />
                    <span className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-golden" />
                    <div
                      className="absolute left-0 right-0 h-px bg-golden/70"
                      style={{ animation: 'scanLine 2s ease-in-out infinite' }}
                    />
                  </div>
                  <p className="absolute bottom-4 text-[10px] font-bold uppercase tracking-widest text-white/80">
                    Point camera at the QR code
                  </p>
                </div>

                {phase === 'requesting-camera' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-pup-black/80 gap-3">
                    <Loader2 className="w-8 h-8 text-golden animate-spin" />
                    <p className="text-xs font-bold uppercase tracking-widest text-white/70">Starting camera…</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <MapPin className="w-3.5 h-3.5 text-maroon dark:text-golden shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  GPS is captured automatically when a QR is detected
                </p>
              </div>

              {cameraError && (
                <p className="text-xs text-amber-600 dark:text-amber-400 px-4 pt-3 border-l-2 border-amber-400 ml-4">
                  {cameraError}
                </p>
              )}
            </div>
          )}

          {/* ── Upload QR image ── */}
          {inputMode === 'upload' && !isProcessing && phase !== 'success' && phase !== 'error' && (
            <div className="p-6 flex flex-col gap-4">

              {/* Security notice */}
              <div className="flex items-start gap-3 p-3 border border-maroon/30 dark:border-golden/20 bg-maroon/5 dark:bg-golden/5">
                <MapPin className="w-4 h-4 text-maroon dark:text-golden mt-0.5 shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-maroon dark:text-golden leading-relaxed">
                  Geofence is enforced regardless of input method — your live GPS location must be inside the classroom to check in.
                </p>
              </div>

              {/* Drop zone / file picker */}
              <div
                className={`relative flex flex-col items-center justify-center border-2 border-dashed transition-colors cursor-pointer
                  ${uploadPreview
                    ? 'border-maroon dark:border-golden bg-maroon/5 dark:bg-golden/5'
                    : 'border-zinc-300 dark:border-zinc-700 hover:border-maroon dark:hover:border-golden bg-zinc-50 dark:bg-zinc-900/50'
                  }`}
                style={{ minHeight: 200 }}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                aria-label="Upload QR image"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImageFile(file)
                    // Reset so the same file can be reselected
                    e.target.value = ''
                  }}
                />

                {uploadPreview ? (
                  /* Preview */
                  <div className="w-full flex flex-col items-center p-4 gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={uploadPreview}
                      alt="Uploaded QR"
                      className="max-h-48 max-w-full object-contain border border-zinc-200 dark:border-zinc-700"
                    />
                    <p className="text-[10px] font-mono text-zinc-400 truncate max-w-xs">{uploadFileName}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-maroon dark:text-golden">
                      Tap to replace
                    </p>
                  </div>
                ) : (
                  /* Empty state */
                  <div className="flex flex-col items-center gap-3 p-8 text-center">
                    <div className="w-14 h-14 border-2 border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Upload QR image</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Screenshot from group chat, photo, or any image with a QR code
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-2">JPEG · PNG · WebP · BMP — max 10 MB</p>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-maroon dark:text-golden">
                      Tap to browse or drag and drop
                    </p>
                  </div>
                )}
              </div>

              {/* Decode error */}
              {uploadError && (
                <p className="text-xs text-red-600 dark:text-red-400 border-l-2 border-red-500 pl-3">
                  {uploadError}
                </p>
              )}

              {/* Submit button */}
              <Button
                onClick={handleDecodeUpload}
                disabled={!uploadPreview}
                className="w-full rounded-none bg-maroon hover:bg-maroon-dark disabled:opacity-40 text-white uppercase tracking-widest font-bold text-xs h-11"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Read QR &amp; Check In
              </Button>

              <p className="text-[10px] text-zinc-400 text-center">
                The QR token from the image is decoded locally — but your live GPS and the token's cryptographic signature are still verified by the server.
              </p>
            </div>
          )}

          {/* ── Manual entry ── */}
          {inputMode === 'manual' && !isProcessing && phase !== 'success' && phase !== 'error' && (
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-start gap-3 p-3 border border-maroon/30 dark:border-golden/20 bg-maroon/5 dark:bg-golden/5">
                <MapPin className="w-4 h-4 text-maroon dark:text-golden mt-0.5 shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-maroon dark:text-golden leading-relaxed">
                  Geofence is enforced for manual entry — you must be physically inside the classroom.
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                  QR Token
                </p>
                <form onSubmit={handleManualSubmit} className="flex flex-col gap-3">
                  <Input
                    value={manualToken}
                    onChange={e => setManualToken(e.target.value)}
                    placeholder="Paste or type the QR token…"
                    className="rounded-none font-mono text-xs h-10 border-zinc-300 dark:border-zinc-700 focus:border-maroon dark:focus:border-golden"
                    aria-label="QR token text field"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    type="submit"
                    disabled={!manualToken.trim()}
                    className="w-full rounded-none bg-maroon hover:bg-maroon-dark disabled:opacity-40 text-white h-10 font-bold uppercase tracking-widest text-xs"
                  >
                    Check In
                  </Button>
                </form>
                <p className="text-[10px] text-zinc-400 mt-3">
                  Ask your instructor to copy and share the session token. It is a long string of characters beginning with the payload and signature separated by a dot.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Scan-line animation */}
      <style>{`
        @keyframes scanLine {
          0%   { top: 10%; opacity: 1; }
          50%  { top: 90%; opacity: 0.6; }
          100% { top: 10%; opacity: 1; }
        }
      `}</style>
    </div>
  )
}
