"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { Camera, Keyboard, QrCode, ShieldCheck, Upload, X } from "lucide-react";
import type { ScanInputChannel, SessionMode, Student } from "@polycheck/shared";
import { decodeTokenPayload } from "@polycheck/shared/utils";
import { ScanQrViews } from "@/components/scan-qr/ScanQrViews";
import {
  isBarcodeDetectorSupported,
  type InputMode,
  type ScanOutcome,
  type ScanPhase,
} from "@/components/scan-qr/types";
import { useQrCamera } from "@/components/scan-qr/useQrCamera";
import { api } from "@/lib/api-client";
import { getOrCreateWebInstallationId } from "@/lib/device-id";

const ALLOW_QR_FALLBACKS =
  process.env.NEXT_PUBLIC_ALLOW_QR_FALLBACKS !== "false";

interface ScanQrModalProps {
  user: Student;
  onClose: () => void;
  sessionId?: string;
}

export default function ScanQrModal({
  user,
  onClose,
  sessionId,
}: ScanQrModalProps) {
  const scannedRef = useRef(false);
  const handleTokenRef = useRef<
    (token: string, channel: ScanInputChannel, pinOverride?: string) => Promise<void>
  >(async () => {});
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [inputMode, setInputMode] = useState<InputMode>("camera");
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [outcome, setOutcome] = useState<ScanOutcome>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [locationStatus, setLocationStatus] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [decodedMode, setDecodedMode] = useState<SessionMode | null>(null);
  const [pendingScan, setPendingScan] = useState<{
    token: string;
    channel: ScanInputChannel;
    checkpoint?: "start" | "end";
  } | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");

  const { videoRef, startCamera, stopCamera, toggleCameraFacing } = useQrCamera(
    {
      phase,
      setPhase,
      facingMode,
      setFacingMode,
      setInputMode,
      setCameraError,
      scannedRef,
      handleTokenRef,
      allowFallbacks: ALLOW_QR_FALLBACKS,
    },
  );

  const handleImageFile = useCallback(async (file: File) => {
    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/bmp",
      ].includes(file.type)
    ) {
      setUploadError("Unsupported file type. Use JPEG, PNG, WebP, or BMP.");
      return;
    }
    if (file.size > 10_000_000) {
      setUploadError("Image is too large. Maximum size is 10 MB.");
      return;
    }
    setUploadError("");
    setUploadFileName(file.name);
    const { promise, resolve, reject } = Promise.withResolvers<string>();
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("The selected image could not be read"));
    reader.readAsDataURL(file);
    try {
      setUploadPreview(await promise);
    } catch {
      // DD-W22: both call sites fire-and-forget this handler, so a rejected
      // FileReader (permissions, truncated file, memory pressure) used to become
      // an unhandled rejection with no feedback. Surface it instead.
      setUploadFileName("");
      setUploadPreview(null);
      setUploadError("That image could not be read. Choose a different file.");
    }
  }, []);

  const handleDecodeUpload = useCallback(async () => {
    if (!uploadPreview) return;
    setUploadError("");
    setPhase("decoding-image");
    let rawToken: string | null = null;
    if (isBarcodeDetectorSupported()) {
      try {
        const image = new Image();
        image.src = uploadPreview;
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = reject;
        });
        const codes = await new BarcodeDetector({
          formats: ["qr_code"],
        }).detect(image);
        if (codes.length > 0) rawToken = codes[0].rawValue;
      } catch {
        // ZXing below is the compatibility path for browsers without native decoding.
      }
    }
    if (!rawToken) {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        rawToken = (
          await new BrowserQRCodeReader().decodeFromImageUrl(uploadPreview)
        ).getText();
      } catch {
        // The user-facing error below covers unreadable images.
      }
    }
    if (!rawToken) {
      setUploadError(
        "No QR code found in this image. Make sure the entire QR is visible and try again.",
      );
      setPhase("idle");
      return;
    }
    scannedRef.current = true;
    await handleTokenRef.current(rawToken, "image");
  }, [uploadPreview]);

  const getCurrentPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not available in this browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      });
    });

  const handleToken = useCallback(
    async (token: string, inputChannel: ScanInputChannel, pinOverride?: string) => {
      const payload = decodeTokenPayload(token);
      if (!payload) {
        setErrorMessage("Invalid QR code — could not read the token.");
        setPhase("error");
        return;
      }
      if (sessionId && payload.sessionId !== sessionId) {
        setErrorMessage(
          inputChannel === "manual"
            ? "This token belongs to a different session."
            : "This QR code belongs to a different session.",
        );
        setPhase("error");
        return;
      }

      const online = (payload.mode ?? "in_person") === "online";
      setDecodedMode(payload.mode ?? "in_person");

      if (payload.pinRequired && !pinOverride) {
        setPendingScan({ token, channel: inputChannel, checkpoint: payload.checkpoint });
        setPinValue("");
        setPinError("");
        setPhase("entering-pin");
        return;
      }

      let latitude: number | null = null;
      let longitude: number | null = null;
      let accuracyMeters: number | undefined;
      let locationCapturedAt: string | undefined;

      if (!online) {
        setPhase("acquiring-location");
        setLocationStatus("Getting your location…");
        let position: GeolocationPosition;
        try {
          position = await getCurrentPosition();
          setLocationStatus(
            `Location acquired (±${Math.round(position.coords.accuracy)}m)`,
          );
        } catch (error: unknown) {
          const denied =
            error instanceof GeolocationPositionError &&
            error.code === GeolocationPositionError.PERMISSION_DENIED;
          setErrorMessage(
            denied
              ? "Location access was denied. Allow location in your browser settings and try again."
              : "Unable to determine your location. Check your settings and try again.",
          );
          setPhase("error");
          return;
        }
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        accuracyMeters = position.coords.accuracy;
        locationCapturedAt = new Date(position.timestamp).toISOString();
      } else {
        // RA 10173 zero-GPS: online checkpoints never request location.
        setLocationStatus("No location needed · online session");
      }

      setPhase("submitting");
      try {
        const result = await api.submitScan(
          payload.sessionId,
          user.id,
          user.fullName,
          latitude,
          longitude,
          getOrCreateWebInstallationId(),
          token,
          new Date().toISOString(),
          {
            clientAttemptId: crypto.randomUUID(),
            ...(accuracyMeters !== undefined ? { accuracyMeters } : {}),
            ...(locationCapturedAt ? { locationCapturedAt } : {}),
            inputChannel,
          },
          pinOverride,
        );
        if ("error" in result) {
          if (payload.pinRequired) {
            setPendingScan({ token, channel: inputChannel, checkpoint: payload.checkpoint });
            setPinError(result.error);
            setPhase("entering-pin");
            return;
          }
          setErrorMessage(result.error);
          setPhase("error");
          return;
        }
        const checkpoint = payload.checkpoint;
        const legStatus =
          checkpoint === "end"
            ? result.checkOutStatus ?? result.status
            : result.checkInStatus ?? result.status;
        const outcomeStatus =
          legStatus === "late"
            ? "late"
            : legStatus === "disputed" || result.status === "disputed"
              ? "disputed"
              : "present";
        setOutcome({
          status: outcomeStatus,
          message:
            result.isSynced === false
              ? online
                ? checkpoint === "end"
                  ? "Check-out saved on this device. It will sync when you reconnect."
                  : "Check-in saved on this device. It will sync when you reconnect."
                : `Attendance recorded as ${result.status} on this device. It will sync when you reconnect.`
              : online
                ? checkpoint === "end"
                  ? "End-of-class check-out recorded."
                  : outcomeStatus === "late"
                    ? "Start-of-class check-in recorded as late."
                    : "Start-of-class check-in recorded."
                : `Attendance recorded as ${result.status}.`,
          queued: result.isSynced === false,
        });
        setPhase("success");
      } catch (error: unknown) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Try again.",
        );
        setPhase("error");
      }
    },
    [sessionId, user],
  );

  useEffect(() => {
    handleTokenRef.current = handleToken;
  }, [handleToken]);

  // When the modal is opened for a specific session, learn its mode up front so
  // online sessions expose the screenshot/link fallbacks before any token has
  // been decoded (single-phone accessibility).
  useEffect(() => {
    if (!sessionId) return;
    const getSession = (api as { getSession?: (id: string) => Promise<{ mode?: SessionMode }> })
      .getSession;
    if (typeof getSession !== "function") return;
    let active = true;
    void getSession(sessionId)
      .then((session) => {
        if (active && session?.mode) setDecodedMode(session.mode);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [sessionId]);

  const switchMode = useCallback(
    (mode: InputMode) => {
      if (mode === inputMode) return;
      if (inputMode === "camera") stopCamera();
      if (inputMode === "upload") {
        setUploadPreview(null);
        setUploadFileName("");
        setUploadError("");
      }
      scannedRef.current = false;
      setInputMode(mode);
      setPhase("idle");
      if (mode === "camera") void startCamera();
    },
    [inputMode, startCamera, stopCamera],
  );

  const reset = useCallback(() => {
    scannedRef.current = false;
    setOutcome(null);
    setErrorMessage("");
    setManualToken("");
    setLocationStatus("");
    setUploadPreview(null);
    setUploadFileName("");
    setUploadError("");
    setPendingScan(null);
    setPinValue("");
    setPinError("");
    setPhase("idle");
    if (inputMode === "camera") void startCamera();
  }, [inputMode, startCamera]);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [onClose, stopCamera]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus();
    };
  }, [handleClose]);

  const handleManualSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const token = manualToken.trim().replace(/^["']|["']$/g, "");
    if (!token) return;
    scannedRef.current = true;
    stopCamera();
    await handleToken(token, "manual");
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void handleImageFile(file);
  };

  const isProcessing =
    phase === "acquiring-location" ||
    phase === "submitting" ||
    phase === "decoding-image" ||
    phase === "entering-pin";
  const showTabs =
    phase !== "success" &&
    phase !== "error" &&
    phase !== "entering-pin" &&
    !isProcessing;
  // Screenshot scans are a first-class channel for online sessions (single
  // device reality) and only env-gated for in-person sessions.
  const allowFallbacks = ALLOW_QR_FALLBACKS || decodedMode === "online";
  const tabs = [
    {
      mode: "camera" as const,
      label: "Camera",
      testId: "scan-tab-camera",
      icon: <Camera className="w-3.5 h-3.5" />,
    },
    ...(allowFallbacks
      ? [
          {
            mode: "upload" as const,
            label: "Upload Screenshot",
            testId: "scan-tab-upload",
            icon: <Upload className="w-3.5 h-3.5" />,
          },
          {
            mode: "manual" as const,
            label: "Enter Token",
            testId: "scan-tab-manual",
            icon: <Keyboard className="w-3.5 h-3.5" />,
          },
        ]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pup-black/90 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-labelledby="scan-qr-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-lg mx-4 bg-background border-2 border-zinc-300 dark:border-zinc-800 shadow-2xl flex flex-col h-[540px] max-h-[92dvh] overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-maroon text-white shrink-0">
          <div className="flex items-center gap-3">
            <QrCode className="w-5 h-5 text-golden" />
            <div>
              <p
                id="scan-qr-title"
                className="text-[10px] font-bold uppercase tracking-widest text-white/70"
              >
                Scan attendance QR code
              </p>
              <p className="text-sm font-bold text-golden font-heading">
                {user.fullName}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="p-1.5 hover:bg-white/10 transition-colors rounded-none"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {showTabs ? (
          <div
            role="tablist"
            aria-label="Attendance check-in methods"
            className="flex border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50 dark:bg-zinc-900/50"
          >
            {tabs.map(({ mode, label, testId, icon }) => (
              <button
                key={mode}
                role="tab"
                data-testid={testId}
                aria-selected={inputMode === mode}
                onClick={() => switchMode(mode)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${inputMode === mode ? "text-maroon dark:text-golden border-b-2 border-maroon dark:border-golden bg-background" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 border-b-2 border-transparent"}`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto h-full">
          {phase === "entering-pin" ? (
            <form
              className="flex-1 flex flex-col justify-center gap-6 p-8"
              onSubmit={(event) => {
                event.preventDefault();
                if (!pendingScan) return;
                const pin = pinValue.trim();
                if (!/^\d{2,4}$/.test(pin)) {
                  setPinError("Enter the 2–4 digit PIN announced in class.");
                  return;
                }
                setPinError("");
                void handleTokenRef.current(pendingScan.token, pendingScan.channel, pin);
              }}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 flex items-center justify-center border-2 border-maroon dark:border-golden bg-maroon/5 dark:bg-golden/10">
                  <ShieldCheck className="w-7 h-7 text-maroon dark:text-golden" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-maroon dark:text-golden">
                    Online checkpoint
                  </p>
                  <h3 className="text-lg font-heading font-bold text-maroon-dark dark:text-white mt-1">
                    Enter Meeting PIN
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Announced aloud by your instructor in class.
                  </p>
                </div>
              </div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Meeting PIN
                <input
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pinValue}
                  onChange={(event) => setPinValue(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  aria-label="Meeting PIN"
                  data-testid="scan-pin-input"
                  className="mt-1 flex h-12 w-full items-center justify-center border border-zinc-300 bg-white text-center text-2xl font-bold tracking-[0.5em] text-maroon-dark focus-visible:border-maroon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus-visible:border-golden"
                  placeholder="••••"
                />
              </label>
              {pinError ? (
                <p className="text-xs font-semibold text-red-600 dark:text-red-300" role="alert">
                  {pinError}
                </p>
              ) : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 h-10 border border-zinc-300 text-xs font-bold uppercase tracking-widest text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!pendingScan}
                  className="flex-1 h-10 bg-maroon text-xs font-bold uppercase tracking-widest text-white hover:bg-maroon-dark disabled:opacity-50 dark:bg-golden dark:text-maroon-dark dark:hover:bg-golden-dark"
                >
                  Verify
                </button>
              </div>
            </form>
          ) : (
            <ScanQrViews
              ref={videoRef}
              phase={phase}
              outcome={outcome}
              errorMessage={errorMessage}
              locationStatus={locationStatus}
              inputMode={inputMode}
              cameraError={cameraError}
              facingMode={facingMode}
              uploadPreview={uploadPreview}
              uploadFileName={uploadFileName}
              uploadError={uploadError}
              manualToken={manualToken}
              setManualToken={setManualToken}
              onClose={handleClose}
              onReset={reset}
              onToggleCamera={toggleCameraFacing}
              onDrop={handleDrop}
              onImageFile={(file) => void handleImageFile(file)}
              onDecodeUpload={() => void handleDecodeUpload()}
              onManualSubmit={(event) => void handleManualSubmit(event)}
            />
          )}
        </div>
      </div>
      <style>{`@keyframes scanLine { 0% { top: 10%; opacity: 1; } 50% { top: 90%; opacity: 0.6; } 100% { top: 10%; opacity: 1; } }`}</style>
    </div>
  );
}
