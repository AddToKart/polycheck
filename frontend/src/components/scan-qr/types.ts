export type InputMode = 'camera' | 'upload' | 'manual'

export type ScanPhase =
  | 'idle'
  | 'requesting-camera'
  | 'scanning'
  | 'decoding-image'
  | 'acquiring-location'
  | 'submitting'
  | 'success'
  | 'error'

export type ScanOutcome = {
  status: 'present' | 'late' | 'disputed'
  message: string
} | null

declare global {
  interface BarcodeDetectorOptions { formats?: string[] }
  class BarcodeDetector {
    constructor(options?: BarcodeDetectorOptions)
    detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>
  }
  interface BarcodeDetectorResult {
    rawValue: string
    format: string
    boundingBox?: DOMRectReadOnly
  }
}

export const isBarcodeDetectorSupported = () => typeof window !== 'undefined' && 'BarcodeDetector' in window
