import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import {
  CameraView,
  scanFromURLAsync,
  useCameraPermissions,
} from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { decodeTokenPayload } from "@polycheck/shared/utils";
import type { QRTokenPayload, ScanInputChannel, Session, SessionMode } from "@polycheck/shared";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { api } from "../../services/api-client";
import { isMaintenanceError } from "../../lib/maintenance";
import { useTheme } from "../../theme/ThemeContext";
import { pupColors } from "../../theme/colors";
import { CampusIconButton } from "../../components/CampusPrimitives";
import { getOrCreateInstallationId } from "../../services/device-id";
import { getDeviceSecuritySnapshot } from "../../services/device-security";
import {
  resetScannerOnBlur,
  shouldMountScannerCamera,
  isScannerOperationCurrent,
} from "../../hooks/scanner-focus-lifecycle";
import { shouldShowScanFallbacks } from "../../hooks/qr-fallback-policy";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const scanSize = Math.min(SCREEN_WIDTH * 0.82, 340);
const allowQrFallbacksEnv = process.env.EXPO_PUBLIC_ALLOW_QR_FALLBACKS;

type ScanResult = {
  status: "present" | "late" | "absent" | "disputed" | "pending" | "incomplete";
  message: string;
} | null;

const resultPresentation = {
  pending: {
    icon: "cloud-upload" as const,
    title: "SAVED ON DEVICE",
    classes: "border-golden bg-black/95 text-golden",
  },
  present: {
    icon: "check-circle" as const,
    title: "ATTENDANCE VERIFIED",
    classes: "border-emerald-500 bg-emerald-950/95 text-emerald-300",
  },
  late: {
    icon: "schedule" as const,
    title: "MARKED LATE",
    classes: "border-amber-500 bg-amber-950/95 text-amber-300",
  },
  incomplete: {
    icon: "timelapse" as const,
    title: "INCOMPLETE ATTENDANCE",
    classes: "border-amber-500 bg-amber-950/95 text-amber-300",
  },
  absent: {
    icon: "location-off" as const,
    title: "CHECK-IN REJECTED",
    classes: "border-red-500 bg-red-950/95 text-red-300",
  },
  disputed: {
    icon: "gavel" as const,
    title: "FLAGGED FOR REVIEW",
    classes: "border-golden bg-black/95 text-golden",
  },
};

export default function ScanScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [result, setResult] = useState<ScanResult>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [decodingImage, setDecodingImage] = useState(false);
  const [cameraPermission, requestPermission] = useCameraPermissions();
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [decodedMode, setDecodedMode] = useState<SessionMode | null>(null);
  const [pinPrompt, setPinPrompt] = useState<{
    payload: QRTokenPayload;
    token: string;
    channel: ScanInputChannel;
    operationId: number;
  } | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannedRef = useRef(false);
  const focusedRef = useRef(false);
  const scanOpRef = useRef(0);

  // Scanning laser line animation
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) return;
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
    });
    return () => animation?.stop();
  }, [scanAnim]);

  useFocusEffect(
    useCallback(() => {
      let focused = true;
      focusedRef.current = true;
      setIsFocused(true);
      void api
        .getSessions()
        .then((sessions) => {
          if (!focused) return;
          const active = sessions.filter((s) => s.isActive);
          setActiveSession(active.length === 1 ? active[0] : null);
        })
        .catch(() => {
          if (focused) setActiveSession(null);
        });
      return () => {
        focused = false;
        resetScannerOnBlur({
          timeoutRef,
          scannedRef,
          focusedRef,
          scanOpRef,
          setFocused: setIsFocused,
          setTorchOn,
          setResult,
          setShowManual,
          setManualToken,
          setDecodingImage,
        });
        setPinPrompt(null);
        setPinValue("");
        setPinError("");
        setDecodedMode(null);
      };
    }, []),
  );

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const showResult = useCallback(
    (status: NonNullable<ScanResult>["status"], message: string) => {
      if (!focusedRef.current) return;
      setResult({ status, message });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setResult(null);
        scannedRef.current = false;
      }, 5000);
    },
    [],
  );

  const submitDecodedToken = useCallback(
    async (
      payload: QRTokenPayload,
      token: string,
      inputChannel: ScanInputChannel,
      operationId: number,
      pin?: string,
    ) => {
      const stillCurrent = () =>
        isScannerOperationCurrent(focusedRef, scanOpRef, operationId);

      try {
        const user = api.getCurrentUser();
        if (!user || !("studentId" in user)) {
          showResult(
            "absent",
            "Sign in with a student account before scanning.",
          );
          return;
        }

        const session = await api.getSession(payload.sessionId);
        if (!stillCurrent()) return;
        if (!session) {
          showResult("absent", "The class session could not be found.");
          return;
        }
        setActiveSession(session);

        const online = (payload.mode ?? "in_person") === "online";
        const scannedAt = await api.getTrustedTimestamp();
        const deviceId = await getOrCreateInstallationId();
        const securitySnapshot = await getDeviceSecuritySnapshot();

        // Zero-GPS (RA 10173): online checkpoints never request location.
        let latitude: number | null = null;
        let longitude: number | null = null;
        let accuracyMeters: number | undefined;
        let locationCapturedAt: string | undefined;
        let mocked: boolean | undefined;

        if (!online) {
          const permission = await Location.requestForegroundPermissionsAsync();
          if (!stillCurrent()) return;
          if (permission.status !== "granted") {
            showResult(
              "absent",
              "Location access is required to verify that you are inside the class geofence.",
            );
            return;
          }
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });
          if (!stillCurrent()) return;
          const locationAgeMs = Math.max(0, Date.now() - location.timestamp);
          locationCapturedAt = new Date(
            new Date(scannedAt).getTime() - locationAgeMs,
          ).toISOString();
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
          accuracyMeters = location.coords.accuracy ?? undefined;
          mocked = location.mocked;
        }

        if (!stillCurrent()) return;
        // This is the last cancellable client boundary. Once the HTTP request
        // below has been sent, a blur cannot retract server-side work; the
        // generation checks prevent starting it after blur and suppress stale
        // UI after any already-sent request settles.
        const submitted = await api.submitScan(
          session.id,
          user.id,
          user.fullName,
          latitude,
          longitude,
          deviceId,
          token,
          scannedAt,
          {
            clientAttemptId: Crypto.randomUUID(),
            ...(accuracyMeters !== undefined ? { accuracyMeters } : {}),
            ...(locationCapturedAt ? { locationCapturedAt } : {}),
            ...(mocked !== undefined ? { mocked } : {}),
            inputChannel,
            deviceSecurity: securitySnapshot,
          },
          pin,
        );
        if (!stillCurrent()) return;

        if ("error" in submitted) {
          if (payload.pinRequired && pin !== undefined) {
            setPinPrompt({ payload, token, channel: inputChannel, operationId });
            setPinValue("");
            setPinError(submitted.error);
            return;
          }
          if (payload.pinRequired && pin === undefined) {
            setPinPrompt({ payload, token, channel: inputChannel, operationId });
            setPinValue("");
            setPinError("");
            return;
          }
          showResult("absent", submitted.error);
          return;
        }

        if (online) {
          const checkpoint = payload.checkpoint;
          const legStatus =
            checkpoint === "end"
              ? submitted.checkOutStatus ?? "present"
              : submitted.checkInStatus ?? submitted.status;
          const resultStatus: NonNullable<ScanResult>["status"] =
            submitted.status === "disputed" || legStatus === "disputed"
              ? "disputed"
              : submitted.isSynced === false
                ? "pending"
                : legStatus === "late"
                  ? "late"
                  : legStatus === "incomplete"
                    ? "incomplete"
                    : "present";
          showResult(
            resultStatus,
            submitted.isSynced === false
              ? checkpoint === "end"
                ? "Check-out saved offline and queued for sync."
                : "Check-in saved offline and queued for sync."
              : checkpoint === "end"
                ? "End-of-class check-out recorded."
                : resultStatus === "late"
                  ? "Start-of-class check-in recorded as late."
                  : "Start-of-class check-in recorded.",
          );
          return;
        }

        showResult(
          !submitted.isSynced
            ? "pending"
            : submitted.status === "late"
              ? "late"
              : submitted.status === "disputed"
                ? "disputed"
                : submitted.status === "pending"
                  ? "pending"
                  : submitted.status === "incomplete"
                    ? "incomplete"
                    : submitted.status === "present"
                      ? "present"
                      : "absent",
          submitted.isSynced
            ? `Attendance recorded as ${submitted.status}.`
            : "Check-in saved offline and queued for sync. Confirmation may require instructor review. Open the dashboard to check sync status.",
        );
      } catch (error) {
        if (!stillCurrent()) return;
        if (isMaintenanceError(error)) {
          showResult(
            "absent",
            "Polycheck is under scheduled maintenance. Offline attendance evidence stays securely queued on this device and will sync when servers reopen.",
          );
          return;
        }
        showResult(
          "absent",
          error instanceof Error
            ? error.message
            : "Your location could not be verified.",
        );
      }
    },
    [showResult],
  );

  const handleScanResult = useCallback(
    async (token: string, inputChannel: ScanInputChannel = "camera") => {
      if (!focusedRef.current || scannedRef.current || !token) return;
      const operationId = scanOpRef.current;
      scannedRef.current = true;
      const payload = decodeTokenPayload(token);
      if (!payload) {
        showResult(
          "absent",
          "This QR code is not a valid Polycheck attendance token.",
        );
        return;
      }
      setDecodedMode(payload.mode ?? "in_person");
      if (payload.pinRequired) {
        setPinPrompt({ payload, token, channel: inputChannel, operationId });
        setPinValue("");
        setPinError("");
        return;
      }
      await submitDecodedToken(payload, token, inputChannel, operationId);
    },
    [showResult, submitDecodedToken],
  );

  const submitPin = useCallback(() => {
    if (!pinPrompt) return;
    const pin = pinValue.trim();
    if (!/^\d{2,4}$/.test(pin)) {
      setPinError("Enter the 2–4 digit PIN announced in class.");
      return;
    }
    if (!isScannerOperationCurrent(focusedRef, scanOpRef, pinPrompt.operationId)) {
      setPinPrompt(null);
      return;
    }
    const pending = pinPrompt;
    setPinPrompt(null);
    setPinValue("");
    setPinError("");
    void submitDecodedToken(
      pending.payload,
      pending.token,
      pending.channel,
      pending.operationId,
      pin,
    );
  }, [pinPrompt, pinValue, submitDecodedToken]);

  const handleUploadQr = useCallback(async () => {
    if (!focusedRef.current || decodingImage || scannedRef.current) return;
    // Capture the focus generation before the permission request (the first
    // await). A picker opened before blur must never be reclassified as a new
    // operation merely because the user returned before it resolved.
    const operationId = scanOpRef.current;
    const stillCurrent = () =>
      isScannerOperationCurrent(focusedRef, scanOpRef, operationId);
    setDecodingImage(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!stillCurrent()) return;
      if (!permission.granted) {
        showResult("absent", "Photo access is required to select a QR image.");
        return;
      }
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });
      if (!stillCurrent()) return;
      if (selection.canceled) return;

      const codes = await scanFromURLAsync(selection.assets[0].uri, ["qr"]);
      if (!stillCurrent()) return;
      const qrCode = codes.find((code) => code.type === "qr") ?? codes[0];
      if (!qrCode?.data) {
        showResult("absent", "No QR code was found in that image.");
        return;
      }
      // handleScanResult performs network reads and ultimately submits the
      // attendance record. This guard prevents starting that chain after blur.
      await handleScanResult(qrCode.data, "image");
    } catch (error) {
      if (stillCurrent())
        showResult(
          "absent",
          error instanceof Error
            ? error.message
            : "The QR image could not be read.",
        );
    } finally {
      // Do not let a stale upload clear the busy state of a newer operation
      // started after refocus.
      if (stillCurrent()) setDecodingImage(false);
    }
  }, [decodingImage, handleScanResult, showResult]);

  const laserTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, scanSize - 4],
  });

  const presentation = result ? resultPresentation[result.status] : null;
  const cameraMounted = shouldMountScannerCamera(
    isFocused,
    cameraPermission?.granted === true,
  );
  const allowQrFallbacks = shouldShowScanFallbacks(
    allowQrFallbacksEnv,
    decodedMode ?? activeSession?.mode ?? null,
  );

  return (
    <View
      style={{ flex: 1, backgroundColor: "#0A0A0E" }}
      testID="student-scan-screen"
    >
      {/* Full-bleed Camera Viewport */}
      {cameraMounted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torchOn}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={
            showManual || decodingImage || result || pinPrompt
              ? undefined
              : ({ data }) => void handleScanResult(data, "camera")
          }
        />
      ) : null}

      {/* Top Header Overlay - Explicit dark translucent inline style */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          paddingTop: Math.max(insets.top, 12) + 8,
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: "rgba(10, 10, 14, 0.82)",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 255, 255, 0.15)",
          zIndex: 20,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 0,
                backgroundColor: "#34D399",
              }}
            />
            <View>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  color: pupColors.golden,
                }}
              >
                Polycheck Scanner
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 14,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "#FFFFFF",
                }}
              >
                {activeSession
                  ? activeSession.subjectName
                  : "Live Attendance Check"}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <CampusIconButton
              icon={torchOn ? "flash-on" : "flash-off"}
              label="Toggle flash"
              onPress={() => setTorchOn((v) => !v)}
              inverse
            />
            <CampusIconButton
              icon="close"
              label="Close scanner"
              testID="scan-close"
              onPress={() => router.replace("/(tabs)/dashboard")}
              inverse
            />
          </View>
        </View>
      </View>

      {/* Main Scanner Center Overlay */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
        }}
      >
        {cameraPermission?.granted ? (
          <View style={{ alignItems: "center" }}>
            {/* Maximized Target Frame */}
            <View
              style={{
                width: scanSize,
                height: scanSize,
                position: "relative",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.20)",
                backgroundColor: "rgba(0, 0, 0, 0.20)",
              }}
            >
              {/* Corner Bracket Guides */}
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: 40,
                  height: 40,
                  borderLeftWidth: 4,
                  borderTopWidth: 4,
                  borderColor: pupColors.golden,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: 40,
                  height: 40,
                  borderRightWidth: 4,
                  borderTopWidth: 4,
                  borderColor: pupColors.golden,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  width: 40,
                  height: 40,
                  borderBottomWidth: 4,
                  borderLeftWidth: 4,
                  borderColor: pupColors.golden,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 40,
                  height: 40,
                  borderBottomWidth: 4,
                  borderRightWidth: 4,
                  borderColor: pupColors.golden,
                }}
              />

              {/* Animated Laser Scanning Line */}
              <Animated.View
                style={{
                  transform: [{ translateY: laserTranslateY }],
                  height: 3,
                  backgroundColor: pupColors.golden,
                  shadowColor: pupColors.golden,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.9,
                  shadowRadius: 6,
                  elevation: 6,
                  marginHorizontal: 8,
                  width: "95%",
                }}
              />
            </View>

            <View
              style={{
                marginTop: 24,
                borderRadius: 0,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.20)",
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                paddingHorizontal: 20,
                paddingVertical: 10,
              }}
            >
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  color: "#FFFFFF",
                }}
              >
                Center instructor's QR code inside the frame
              </Text>
            </View>
          </View>
        ) : (
          <View
            style={{
              alignItems: "center",
              borderRadius: 0,
              borderWidth: 1,
              borderColor: "rgba(255, 223, 0, 0.30)",
              backgroundColor: "rgba(0, 0, 0, 0.85)",
              padding: 32,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 0,
                borderWidth: 2,
                borderColor: pupColors.golden,
                backgroundColor: "rgba(255, 223, 0, 0.10)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons
                name="camera-alt"
                size={32}
                color={pupColors.golden}
              />
            </View>
            <Text
              style={{
                marginTop: 20,
                fontFamily: "DMSans_700Bold",
                fontSize: 20,
                textTransform: "uppercase",
                letterSpacing: 1,
                color: "#FFFFFF",
              }}
            >
              Camera Access Needed
            </Text>
            <Text
              style={{
                marginTop: 8,
                maxWidth: 280,
                textAlign: "center",
                fontFamily: "DMSans_400Regular",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 1,
                color: "rgba(255, 255, 255, 0.70)",
              }}
            >
              Enable camera permissions to scan live class attendance codes.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enable camera access"
              onPress={requestPermission}
              style={{
                marginTop: 24,
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 0,
                backgroundColor: pupColors.golden,
                paddingHorizontal: 32,
              }}
            >
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  color: pupColors.maroonDark,
                }}
              >
                Enable Camera
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Feedback Banner Overlay */}
      {result && presentation ? (
        <View
          style={{
            position: "absolute",
            bottom: insets.bottom + 140,
            left: 16,
            right: 16,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 12,
            borderRadius: 0,
            borderWidth: 2,
            padding: 16,
            zIndex: 30,
          }}
          className={presentation.classes}
        >
          <MaterialIcons
            name={presentation.icon}
            size={24}
            color={pupColors.golden}
          />
          <View style={{ flex: 1 }}>
            <Text
              accessibilityLiveRegion="assertive"
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: 1,
                color: "#FFFFFF",
              }}
            >
              {presentation.title}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontFamily: "DMSans_400Regular",
                fontSize: 12,
                lineHeight: 20,
                color: "rgba(255, 255, 255, 0.90)",
              }}
            >
              {result.message}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Floating Bottom Control Panel - Explicit dark translucent inline style */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: Math.max(insets.bottom, 12) + 76,
          paddingHorizontal: 16,
          paddingTop: 16,
          backgroundColor: "rgba(10, 10, 14, 0.88)",
          borderTopWidth: 1,
          borderTopColor: "rgba(255, 255, 255, 0.15)",
          zIndex: 20,
        }}
      >
        {activeSession ? (
          <View
            style={{
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderRadius: 0,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.20)",
              backgroundColor: "rgba(255, 255, 255, 0.10)",
              padding: 12,
            }}
          >
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 0,
                backgroundColor: "#34D399",
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 14,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "#FFFFFF",
                }}
              >
                {activeSession.subjectName}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: "DMSans_400Regular",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "rgba(255, 255, 255, 0.70)",
                }}
              >
                {activeSession.startTime}–{activeSession.endTime} ·{" "}
                {activeSession.mode === "online"
                  ? "Online · GPS not required"
                  : `${activeSession.geofence?.radiusMeters ?? 0}m Geofence`}
              </Text>
            </View>
            <MaterialIcons
              name="verified-user"
              size={20}
              color={pupColors.golden}
            />
          </View>
        ) : (
          <View
            style={{
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderRadius: 0,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.20)",
              backgroundColor: "rgba(255, 255, 255, 0.10)",
              padding: 12,
            }}
          >
            <MaterialIcons
              name="info-outline"
              size={20}
              color={pupColors.golden}
            />
            <Text
              style={{
                flex: 1,
                fontFamily: "DMSans_400Regular",
                fontSize: 12,
                lineHeight: 20,
                color: "rgba(255, 255, 255, 0.85)",
              }}
            >
              Point your camera at your instructor’s QR code to verify
              attendance. Online classes also support a screenshot upload.
            </Text>
          </View>
        )}

        {allowQrFallbacks ? (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose a QR image"
              disabled={decodingImage}
              onPress={handleUploadQr}
              style={({ pressed }) => ({
                minHeight: 48,
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: 0,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.30)",
                backgroundColor: pressed
                  ? "rgba(255, 255, 255, 0.22)"
                  : "rgba(255, 255, 255, 0.12)",
              })}
            >
              {decodingImage ? (
                <ActivityIndicator size="small" color={pupColors.golden} />
              ) : (
                <MaterialIcons
                  name="image"
                  size={18}
                  color={pupColors.golden}
                />
              )}
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  color: "#FFFFFF",
                }}
              >
                {decodingImage ? "Reading…" : "Upload Screenshot"}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enter a QR token manually"
              testID="scan-manual-open"
              onPress={() => setShowManual(true)}
              style={({ pressed }) => ({
                minHeight: 48,
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: 0,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.30)",
                backgroundColor: pressed
                  ? "rgba(255, 255, 255, 0.22)"
                  : "rgba(255, 255, 255, 0.12)",
              })}
            >
              <MaterialIcons
                name="keyboard"
                size={18}
                color={pupColors.golden}
              />
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  color: "#FFFFFF",
                }}
              >
                Enter Code
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Manual Entry Fallback Modal */}
      <Modal
        visible={allowQrFallbacks && showManual}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManual(false)}
      >
        <KeyboardAvoidingView
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.80)",
            padding: 20,
          }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="border border-t-4 border-t-golden border-zinc-200 bg-white p-5 dark:border-white/20 dark:bg-surface-dark">
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "DMSans_700Bold",
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: isDark ? pupColors.golden : pupColors.maroon,
                  }}
                >
                  Fallback Check-in
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontFamily: "DMSans_700Bold",
                    fontSize: 22,
                    color: isDark ? "#FFFFFF" : "#211A1B",
                  }}
                >
                  Enter QR Token
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close manual entry"
                onPress={() => setShowManual(false)}
                style={{
                  width: 40,
                  height: 40,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 0,
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.15)" : "#E8E2E3",
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "#F4F4F5",
                }}
              >
                <MaterialIcons
                  name="close"
                  size={20}
                  color={isDark ? "#FFFFFF" : pupColors.maroonDark}
                />
              </Pressable>
            </View>
            <Text
              style={{
                marginTop: 8,
                fontFamily: "DMSans_400Regular",
                fontSize: 12,
                lineHeight: 18,
                color: isDark ? "rgba(255,255,255,0.65)" : "#746C6E",
              }}
            >
              Paste the token from your instructor. Live location will still be
              verified.
            </Text>
            <TextInput
              accessibilityLabel="QR token"
              testID="scan-manual-input"
              style={{
                marginTop: 16,
                minHeight: 100,
                borderRadius: 0,
                borderWidth: 1,
                borderColor: isDark ? "rgba(255,255,255,0.20)" : "#E8E2E3",
                backgroundColor: isDark
                  ? pupColors.campusDark
                  : pupColors.campus,
                padding: 16,
                fontFamily: "monospace",
                fontSize: 12,
                color: isDark ? "#FFFFFF" : "#211A1B",
                textAlignVertical: "top",
              }}
              placeholder="Paste token here"
              placeholderTextColor={
                isDark ? "rgba(255,255,255,0.40)" : pupColors.mutedLight
              }
              autoFocus
              multiline
              value={manualToken}
              onChangeText={setManualToken}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Verify and check in"
              testID="scan-manual-submit"
              disabled={!manualToken.trim()}
              style={{
                marginTop: 16,
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 0,
                backgroundColor: pupColors.maroon,
                opacity: manualToken.trim() ? 1 : 0.4,
              }}
              onPress={() => {
                const token = manualToken.trim();
                setShowManual(false);
                setManualToken("");
                void handleScanResult(token, "manual");
              }}
            >
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  color: "#FFFFFF",
                }}
              >
                Verify & Check In
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Online checkpoint meeting PIN */}
      <Modal
        visible={pinPrompt !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPinPrompt(null);
          setPinValue("");
          setPinError("");
          scannedRef.current = false;
        }}
      >
        <KeyboardAvoidingView
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.80)",
            padding: 20,
          }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="border border-t-4 border-t-golden border-zinc-200 bg-white p-5 dark:border-white/20 dark:bg-surface-dark">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="font-sans-bold text-[9px] uppercase tracking-[2px] text-maroon dark:text-golden">
                  Online checkpoint
                </Text>
                <Text className="mt-1 font-sans-bold text-xl text-maroon-ink dark:text-white">
                  Enter Meeting PIN
                </Text>
                <Text className="mt-2 font-sans text-xs leading-5 text-muted dark:text-zinc-400">
                  Announced aloud by your instructor in class.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel PIN entry"
                onPress={() => {
                  setPinPrompt(null);
                  setPinValue("");
                  setPinError("");
                  scannedRef.current = false;
                }}
                className="h-10 w-10 items-center justify-center border border-zinc-200 bg-zinc-100 dark:border-white/15 dark:bg-white/5"
              >
                <MaterialIcons
                  name="close"
                  size={20}
                  color={isDark ? "#FFFFFF" : pupColors.maroonDark}
                />
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel="Meeting PIN"
              testID="scan-pin-input"
              className="mt-4 min-h-14 w-full border border-zinc-200 bg-campus px-4 text-center font-sans-bold text-2xl tracking-[10px] text-maroon-ink dark:border-white/20 dark:bg-campus-dark dark:text-white"
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              value={pinValue}
              onChangeText={(value) =>
                setPinValue(value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="••••"
              placeholderTextColor={
                isDark ? "rgba(255,255,255,0.40)" : pupColors.mutedLight
              }
            />
            {pinError ? (
              <Text
                accessibilityLiveRegion="assertive"
                className="mt-3 font-sans text-xs font-bold text-red-600 dark:text-red-300"
              >
                {pinError}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Verify meeting PIN"
              testID="scan-pin-submit"
              disabled={!pinValue.trim()}
              onPress={submitPin}
              className="mt-4 min-h-12 items-center justify-center bg-maroon disabled:opacity-40"
            >
              <Text className="font-sans-bold text-xs uppercase tracking-[1.5px] text-white">
                Verify & Record
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
