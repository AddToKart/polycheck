'use client'

import { forwardRef, useRef, type Dispatch, type DragEvent, type FormEvent, type SetStateAction } from 'react'
import { AlertTriangle, CheckCircle, Clipboard, Clock, Loader2, MapPin, QrCode, RefreshCw, SwitchCamera, Upload, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { InputMode, ScanOutcome, ScanPhase } from './types'

interface ScanQrViewsProps {
  phase: ScanPhase
  outcome: ScanOutcome
  errorMessage: string
  locationStatus: string
  inputMode: InputMode
  cameraError: string
  facingMode: 'environment' | 'user'
  uploadPreview: string | null
  uploadFileName: string
  uploadError: string
  manualToken: string
  setManualToken: Dispatch<SetStateAction<string>>
  onClose: () => void
  onReset: () => void
  onToggleCamera: () => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onImageFile: (file: File) => void
  onDecodeUpload: () => void
  onManualSubmit: (event: FormEvent) => void
}

export const ScanQrViews = forwardRef<HTMLVideoElement, ScanQrViewsProps>(function ScanQrViews(props, videoRef) {
  const isProcessing = props.phase === 'acquiring-location' || props.phase === 'submitting' || props.phase === 'decoding-image'
  const showScanner = props.inputMode === 'camera' && (props.phase === 'scanning' || props.phase === 'requesting-camera')
  const outcomeConfig = props.outcome
    ? props.outcome.status === 'present'
      ? { icon: CheckCircle, iconColor: 'text-golden', background: 'bg-maroon border-golden', title: 'Verified — Present' }
      : props.outcome.status === 'late'
        ? { icon: Clock, iconColor: 'text-white', background: 'bg-maroon border-white/30', title: 'Recorded — Late' }
        : { icon: AlertTriangle, iconColor: 'text-golden', background: 'bg-maroon-dark border-golden/40', title: 'Flagged for Review' }
    : null

  if (props.phase === 'success' && outcomeConfig) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 text-center gap-6 h-full min-h-0">
        <div className={`w-20 h-20 flex items-center justify-center border-2 ${outcomeConfig.background}`}><outcomeConfig.icon className={`w-10 h-10 ${outcomeConfig.iconColor}`} /></div>
        <div><p className={`text-2xl font-heading font-bold uppercase tracking-wider ${props.outcome?.status === 'present' ? 'text-maroon dark:text-golden' : 'text-foreground'}`}>{outcomeConfig.title}</p><p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs mx-auto">{props.outcome?.message}</p></div>
        <Button onClick={props.onClose} className="w-full rounded-none bg-maroon hover:bg-maroon-dark text-white uppercase tracking-widest font-bold text-xs h-10">Done</Button>
      </div>
    )
  }

  if (props.phase === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 text-center gap-6 h-full min-h-0">
        <div className="w-20 h-20 flex items-center justify-center border-2 border-red-500/40 bg-red-950/30"><XCircle className="w-10 h-10 text-red-500" /></div>
        <div><p className="text-xl font-heading font-bold text-foreground uppercase tracking-wider">Check-in Rejected</p><p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs mx-auto">{props.errorMessage}</p></div>
        <div className="flex gap-3 w-full"><Button onClick={props.onReset} variant="outline" className="flex-1 rounded-none border-zinc-300 dark:border-zinc-700 uppercase tracking-widest font-bold text-xs h-10"><RefreshCw className="w-3.5 h-3.5 mr-2" />Try Again</Button><Button onClick={props.onClose} className="flex-1 rounded-none bg-maroon hover:bg-maroon-dark text-white uppercase tracking-widest font-bold text-xs h-10">Close</Button></div>
      </div>
    )
  }

  if (isProcessing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 text-center gap-4 h-full min-h-0">
        <Loader2 className="w-10 h-10 text-maroon dark:text-golden animate-spin" />
        <p className="text-sm font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{props.phase === 'decoding-image' ? 'Reading QR code from image…' : props.phase === 'acquiring-location' ? props.locationStatus || 'Acquiring location…' : 'Verifying attendance…'}</p>
        {props.phase === 'acquiring-location' ? <p className="text-xs text-zinc-400 max-w-xs">Your GPS location is required to confirm you are physically inside the classroom geofence.</p> : null}
      </div>
    )
  }

  if (showScanner) {
    return (
      <div className="flex-1 flex flex-col h-full min-h-0 bg-pup-black justify-between">
        <div className="relative flex-1 w-full bg-pup-black overflow-hidden flex items-center justify-center min-h-0">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" aria-label="Camera viewfinder" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-pup-black/40" />
            <div className="relative" style={{ width: '65%', aspectRatio: '1' }}><span className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-golden" /><span className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-golden" /><span className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-golden" /><span className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-golden" /><div className="absolute left-0 right-0 h-px bg-golden/70" style={{ animation: 'scanLine 2s ease-in-out infinite' }} /></div>
            <p className="absolute bottom-4 text-[10px] font-bold uppercase tracking-widest text-white/80">Point camera at the QR code</p>
          </div>
          {props.phase === 'requesting-camera' ? <div className="absolute inset-0 flex flex-col items-center justify-center bg-pup-black/80 gap-3"><Loader2 className="w-8 h-8 text-golden animate-spin" /><p className="text-xs font-bold uppercase tracking-widest text-white/70">Starting camera…</p></div> : null}
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0"><MapPin className="w-3.5 h-3.5 text-maroon dark:text-golden shrink-0" /><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 truncate">GPS captured automatically on scan</p></div>
          <Button type="button" variant="outline" size="sm" onClick={props.onToggleCamera} className="text-[10px] h-7 px-2.5 font-bold uppercase tracking-widest text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800 shrink-0"><SwitchCamera className="w-3.5 h-3.5 mr-1.5 text-maroon dark:text-golden" />Flip Camera ({props.facingMode === 'environment' ? 'Rear' : 'Front'})</Button>
        </div>
        {props.cameraError ? <p className="text-xs text-amber-600 dark:text-amber-400 px-4 pt-3 border-l-2 border-amber-400 ml-4 shrink-0">{props.cameraError}</p> : null}
      </div>
    )
  }

  if (props.inputMode === 'upload') return <UploadQrView {...props} />
  if (props.inputMode === 'manual') return <ManualQrView {...props} />
  return null
})

function UploadQrView(props: ScanQrViewsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="p-6 flex-1 flex flex-col justify-between gap-4 h-full min-h-0 overflow-y-auto">
      <SecurityNotice>Geofence is enforced regardless of input method — your live GPS location must be inside the classroom to check in.</SecurityNotice>
      <div className={`relative flex-1 flex flex-col items-center justify-center border-2 border-dashed transition-colors cursor-pointer min-h-[160px] ${props.uploadPreview ? 'border-maroon dark:border-golden bg-maroon/5 dark:bg-golden/5' : 'border-zinc-300 dark:border-zinc-700 hover:border-maroon dark:hover:border-golden bg-zinc-50 dark:bg-zinc-900/50'}`} onClick={() => fileInputRef.current?.click()} onDrop={props.onDrop} onDragOver={(event) => event.preventDefault()} aria-label="Upload QR image" role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click() }}>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onImageFile(file); event.target.value = '' }} />
        {props.uploadPreview ? (
          <div className="w-full flex flex-col items-center p-4 gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={props.uploadPreview} alt="Uploaded QR" className="max-h-40 max-w-full object-contain border border-zinc-200 dark:border-zinc-700" />
            <p className="text-[10px] font-mono text-zinc-400 truncate max-w-xs">{props.uploadFileName}</p><p className="text-[10px] font-bold uppercase tracking-widest text-maroon dark:text-golden">Tap to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 p-6 text-center"><div className="w-12 h-12 border-2 border-zinc-300 dark:border-zinc-700 flex items-center justify-center"><Upload className="w-5 h-5 text-zinc-400" /></div><div><p className="text-sm font-bold text-foreground">Upload QR image</p><p className="text-xs text-zinc-500 mt-1">Screenshot from group chat, photo, or any image with a QR code</p><p className="text-[10px] text-zinc-400 mt-1.5">JPEG · PNG · WebP · BMP — max 10 MB</p></div><p className="text-[10px] font-bold uppercase tracking-widest text-maroon dark:text-golden">Tap to browse or drag and drop</p></div>
        )}
      </div>
      {props.uploadError ? <p className="text-xs text-red-600 dark:text-red-400 border-l-2 border-red-500 pl-3 shrink-0">{props.uploadError}</p> : null}
      <div className="shrink-0 flex flex-col gap-2"><Button onClick={props.onDecodeUpload} disabled={!props.uploadPreview} className="w-full rounded-none bg-maroon hover:bg-maroon-dark disabled:opacity-40 text-white uppercase tracking-widest font-bold text-xs h-11"><QrCode className="w-4 h-4 mr-2" />Read QR &amp; Check In</Button><p className="text-[10px] text-zinc-400 text-center">The QR token from the image is decoded locally — but your live GPS and the token&apos;s cryptographic signature are still verified by the server.</p></div>
    </div>
  )
}

function ManualQrView(props: ScanQrViewsProps) {
  return (
    <div className="p-6 flex-1 flex flex-col justify-between gap-4 h-full min-h-0 overflow-y-auto">
      <SecurityNotice>Geofence is enforced for manual entry — you must be physically inside the classroom.</SecurityNotice>
      <div className="flex-1 flex flex-col justify-between gap-3">
        <div><div className="flex items-center justify-between mb-2"><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">QR Token Code</p><Button type="button" variant="outline" size="sm" onClick={async () => { try { const text = await navigator.clipboard.readText(); if (text) props.setManualToken(text) } catch { /* Clipboard access is optional. */ } }} className="text-[10px] h-7 px-2 font-bold uppercase tracking-widest text-maroon dark:text-golden border-maroon/30 dark:border-golden/30 hover:bg-maroon/10 dark:hover:bg-golden/10"><Clipboard className="w-3 h-3 mr-1.5" />Paste Clipboard</Button></div>
          <form onSubmit={props.onManualSubmit} className="flex flex-col gap-3"><Input value={props.manualToken} onChange={(event) => props.setManualToken(event.target.value)} placeholder="Paste or type the QR token from your instructor…" className="rounded-none font-mono text-xs h-10 border-zinc-300 dark:border-zinc-700 focus:border-maroon dark:focus:border-golden" aria-label="QR token text field" autoComplete="off" spellCheck={false} /><Button type="submit" disabled={!props.manualToken.trim()} className="w-full rounded-none bg-maroon hover:bg-maroon-dark disabled:opacity-40 text-white h-10 font-bold uppercase tracking-widest text-xs">Check In</Button></form>
        </div>
        <p className="text-[10px] text-zinc-400 mt-2 shrink-0">Ask your instructor to copy and share the session token. It is a long string of characters beginning with the payload and signature separated by a dot.</p>
      </div>
    </div>
  )
}

function SecurityNotice({ children }: { children: string }) {
  return <div className="flex items-start gap-3 p-3 border border-maroon/30 dark:border-golden/20 bg-maroon/5 dark:bg-golden/5 shrink-0"><MapPin className="w-4 h-4 text-maroon dark:text-golden mt-0.5 shrink-0" /><p className="text-[10px] font-bold uppercase tracking-wider text-maroon dark:text-golden leading-relaxed">{children}</p></div>
}
