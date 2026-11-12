import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/core/sync/readiness.dart';
import 'package:polycheck_mobile/src/core/utils/device_security.dart';
import 'package:uuid/uuid.dart';

import 'scan_cache.dart';
import 'student_cache.dart';

class ScanLocation {
  const ScanLocation({
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
    required this.isMocked,
    required this.capturedAt,
    this.deviceNowAtFix,
  });

  final double latitude;
  final double longitude;
  final double accuracyMeters;
  final bool isMocked;

  /// The reader's fix epoch (`position.timestamp`, GNSS/device clock).
  final DateTime capturedAt;

  /// The device wall clock right after the fix resolved. Age math cancels
  /// device drift: `trustedCapturedAt = trustedScannedAt − (deviceNowAtFix −
  /// capturedAt)` — both operands are the device clock. Null on fakes that
  /// predate trust math (then the captured value is trusted as-is).
  final DateTime? deviceNowAtFix;
}

class ScanLocationException implements Exception {
  const ScanLocationException(this.message);

  final String message;

  @override
  String toString() => message;
}

abstract interface class ScanLocationReader {
  Future<ScanLocation> current();
}

/// High-accuracy, mock-aware geolocation.
///
/// Gates (gap report A-a/A-c parity):
/// * `bestForNavigation` with a 20 s limit — kept;
/// * fixes worse than **50 m** are rejected with the server's
///   `poor_location_accuracy` copy (mobile cap `MAX_LOCATION_ACCURACY_METERS
///   = 50`, `backend/src/attendance/types.ts:7`) — a 50–100 m fix used to
///   pass Flutter locally and then get disputed server-side;
/// * a slow fix surfaces "GPS was slow" instead of the generic message.
class GeolocatorScanLocationReader implements ScanLocationReader {
  const GeolocatorScanLocationReader();

  @override
  Future<ScanLocation> current() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw const ScanLocationException(
          'Turn on location services to verify that you are inside the class geofence.',
        );
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw const ScanLocationException(
          'Location access is required to verify that you are inside the class geofence.',
        );
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: bestForNavigationAccuracy,
          timeLimit: locationFixTimeLimit,
        ),
      );
      if (position.accuracy > maxScanLocationAccuracyMeters) {
        throw const ScanLocationException(
          'Location accuracy is too poor to verify attendance',
        );
      }
      return ScanLocation(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMeters: position.accuracy,
        isMocked: position.isMocked,
        capturedAt: position.timestamp.toUtc(),
        deviceNowAtFix: DateTime.now().toUtc(),
      );
    } on TimeoutException {
      // The GNSS fix never landed within the 20 s budget (RN parity: expo
      // waits indefinitely; Flutter surfaces the slowness instead).
      throw const ScanLocationException('GPS was slow — try again.');
    } on ScanLocationException {
      rethrow;
    } on Object {
      throw const ScanLocationException(
        'Your location could not be verified. Turn on GPS and try again.',
      );
    }
  }
}

/// Live accuracy cap — the server's mobile cap
/// (`backend/src/attendance/types.ts:7`); fixes at or better than this pass
/// locally *and* survive server validation.
const double maxScanLocationAccuracyMeters = 50;

/// GNSS acquisition budget (`Location.Accuracy.BestForNavigation` + 20 s,
/// `android/app/(tabs)/scan.tsx:251-253` parity).
const LocationAccuracy bestForNavigationAccuracy =
    LocationAccuracy.bestForNavigation;
const Duration locationFixTimeLimit = Duration(seconds: 20);

/// Server staleness bounds (`backend/src/attendance/types.ts:6`): a fix is
/// stale when its age is outside the accepted window; the server grants a
/// −30 s tolerance for a fix timestamped moments after the reference.
const Duration maxLocationAgeMs = Duration(minutes: 2);
const Duration locationStalenessTolerance = Duration(seconds: 30);

/// Server parity of the staleness decision: age < −30 s (fix "in the future")
/// or age > 2 min (RN copy: "Location fix is stale. Acquire a fresh location
/// and try again.").
///
/// The tolerance applies to the **clock-ahead side only** — the server's
/// `scan-validator.service.ts:243` checks `age < -30_000 || age >
/// MAX_LOCATION_AGE_MS`, so a fix aged 120–150 s passes here and is then
/// disputed server-side as `stale_location` (DD-F20).
bool isLocationFixStale({
  required DateTime trustedReference,
  required DateTime locationCapturedAt,
  Duration tolerance = locationStalenessTolerance,
}) {
  final age = trustedReference.difference(locationCapturedAt);
  return age < -tolerance || age > maxLocationAgeMs;
}

String staleLocationMessage() =>
    'Location fix is stale. Acquire a fresh location and try again.';

/// Converts a GNSS fix epoch into the trusted-clock space:
/// `trustedCapturedAt = trustedNow − (deviceNowAtFix − fixEpoch)` (gap report
/// A-k; both device operands cancel drift, the reference is trusted).
DateTime trustedLocationCapturedAt({
  required ScanLocation location,
  required DateTime trustedNow,
}) {
  final deviceNowAtFix = location.deviceNowAtFix;
  if (deviceNowAtFix == null) {
    // No device-clock anchor (unit-test fakes): trust the captured value.
    return location.capturedAt;
  }
  final fixAgeMs =
      deviceNowAtFix.millisecondsSinceEpoch -
      location.capturedAt.millisecondsSinceEpoch;
  return DateTime.fromMillisecondsSinceEpoch(
    trustedNow.millisecondsSinceEpoch - fixAgeMs,
    isUtc: true,
  );
}

/// Web already-saved guard (`frontend/src/lib/api-client.ts:1353-1368`
/// parity): online scans count per checkpoint leg, in-person scans count any
/// record for the student in the session.
bool attendanceAlreadySavedOnDevice({
  required List<AttendanceRecord> cachedRecords,
  required String studentId,
  required bool online,
  String? checkpoint,
}) {
  if (online) {
    return cachedRecords.any(
      (record) =>
          record.studentId == studentId &&
          (checkpoint == 'end'
              ? (record.checkOutTime ?? '').isNotEmpty ||
                    record.checkOutStatus != null
              : (record.checkInTime ?? '').isNotEmpty ||
                    record.checkInStatus != null),
    );
  }
  return cachedRecords.any((record) => record.studentId == studentId);
}

/// Web/RN already-saved short-circuit copy.
const String alreadySavedOnDeviceMessage =
    'Attendance for this session was already saved on this device.';

/// Web/RN queue-side accuracy assertion copy (`api-client.ts:1334-1337`).
const String poorLocationAccuracyMessage =
    'Location accuracy is too poor to verify attendance';

/// Web/RN offline signature-rejection copy (`api-client.ts:1295-1299`).
const String qrTokenSignatureInvalidMessage = 'QR token signature is invalid';

/// Offline no-key rejection copy (SW-6). The fail-closed policy is unchanged
/// (RN parity); only the diagnosis is honest: the cached session simply never
/// carried the instructor's public key, so "signature invalid" would send the
/// student chasing the wrong problem.
const String offlineVerificationKeyMissingMessage =
    'This class has no offline verification key on this device. Reconnect '
    'once and run Prepare for offline class.';

final scanLocationReaderProvider = Provider<ScanLocationReader>(
  (ref) => const GeolocatorScanLocationReader(),
);

enum ScanOutcomeKind { success, offlineQueued, rejected, error, pinRequired }

class StudentScanOutcome {
  const StudentScanOutcome({
    required this.kind,
    required this.title,
    required this.message,
    this.status,
  });

  final ScanOutcomeKind kind;
  final String title;
  final String message;
  final AttendanceStatus? status;

  bool get isPositive =>
      kind == ScanOutcomeKind.success || kind == ScanOutcomeKind.offlineQueued;
}

String sanitizeScannedToken(String raw) {
  var token = raw.trim();
  while (token.length >= 2 &&
      ((token.startsWith('"') && token.endsWith('"')) ||
          (token.startsWith("'") && token.endsWith("'")))) {
    token = token.substring(1, token.length - 1).trim();
  }
  return token.replaceAll(RegExp(r'\s+'), '');
}

/// The full student scan pipeline: decode -> trusted-clock window -> mode ->
/// PIN -> geolocation/geofence -> device-security evidence -> POST ->
/// encrypted offline queue on transport failure (with local Ed25519
/// verification, the web already-saved guard, and the queue-side
/// accuracy/staleness assertions). UI-free so it can be unit-tested without
/// a camera.
class StudentScanService {
  StudentScanService({
    required this.attendanceApi,
    required this.sessionsApi,
    required this.database,
    required this.trustedClock,
    required this.locationReader,
    required this.deviceId,
    required this.deviceNow,
    this.pinVault,
    this.deviceSecurityProber,
    String Function()? newReceiptId,
  }) : newReceiptId = newReceiptId ?? const Uuid().v4;

  final AttendanceApi attendanceApi;
  final SessionsApi sessionsApi;
  final AppDatabase database;
  final TrustedClock trustedClock;
  final ScanLocationReader locationReader;
  final Future<String> Function() deviceId;
  final DateTime Function() deviceNow;
  final AttendancePinVault? pinVault;

  /// On-device anti-cheat capture; null prober disables evidence gathering
  /// (tests may inject a scripted prober).
  final DeviceSecurityProber? deviceSecurityProber;
  final String Function() newReceiptId;

  Future<StudentScanOutcome> submitToken({
    required String rawToken,
    required User student,
    required ScanInputChannel channel,
    String? pin,
  }) async {
    final token = sanitizeScannedToken(rawToken);
    if (token.isEmpty) {
      return _rejected('Scan an instructor QR code to check in.');
    }

    final payload = decodeTokenPayload(token);
    if (payload == null) {
      return _rejected(
        'This QR code is not a valid Polycheck attendance token.',
      );
    }

    final trustedNowMs = trustedClock.nowMs(deviceNow: deviceNow);
    final validity = isTokenInValidityWindow(payload, trustedNowMs);
    if (!validity.valid) {
      return _rejected(
        'This QR code has expired. Ask your instructor to generate a new one.',
      );
    }

    if (payload.pinRequired) {
      if (pin == null || pin.trim().isEmpty) {
        return const StudentScanOutcome(
          kind: ScanOutcomeKind.pinRequired,
          title: 'MEETING PIN REQUIRED',
          message: 'Enter the 2–4 digit PIN announced in class.',
        );
      }
      if (!isValidPinFormat(pin.trim())) {
        return _rejected('Enter the 2–4 digit PIN announced in class.');
      }
    }

    Session? session;
    try {
      session = await sessionsApi.getSession(payload.sessionId);
      await database.upsertSessions(student.id, <Session>[session]);
    } catch (_) {
      session = await readCachedSession(
        database,
        student.id,
        payload.sessionId,
      );
    }

    final online =
        payload.mode == SessionMode.online ||
        session?.mode == SessionMode.online;

    double? latitude;
    double? longitude;
    double? accuracyMeters;
    double? haversineMeters;
    bool? mocked;
    DateTime? locationCapturedAt;

    if (!online) {
      ScanLocation location;
      try {
        location = await locationReader.current();
      } on ScanLocationException catch (error) {
        return _rejected(error.message);
      } on Object {
        return _rejected(
          'Your location could not be verified. Turn on GPS and try again.',
        );
      }
      if (location.isMocked) {
        return _rejected(
          'Mock location detected. Turn off any location-spoofing app and try again.',
        );
      }

      final trustedNow = DateTime.fromMillisecondsSinceEpoch(
        trustedNowMs,
        isUtc: true,
      );
      if (isLocationFixStale(
        trustedReference: trustedNow,
        locationCapturedAt: trustedLocationCapturedAt(
          location: location,
          trustedNow: trustedNow,
        ),
      )) {
        return _rejected(staleLocationMessage());
      }

      final geofence = session?.geofence;
      if (geofence != null) {
        final distance = haversineDistance(
          location.latitude,
          location.longitude,
          geofence.latitude,
          geofence.longitude,
        );
        haversineMeters = distance;
        if (distance > geofence.radiusMeters) {
          return _rejected(
            'You are ${distance.round()} m from the class location '
            '(${geofence.radiusMeters.round()} m geofence). Move closer and try again.',
          );
        }
      }

      latitude = location.latitude;
      longitude = location.longitude;
      accuracyMeters = location.accuracyMeters;
      mocked = location.isMocked;
      locationCapturedAt = trustedLocationCapturedAt(
        location: location,
        trustedNow: trustedNow,
      );
    }

    // Web already-saved guard (A-f): a second survey of the device cache
    // deflects a check-in that would only become a server duplicate.
    try {
      final cachedRecords = await readCachedAttendanceForSession(
        database,
        student.id,
        payload.sessionId,
      );
      if (attendanceAlreadySavedOnDevice(
        cachedRecords: cachedRecords,
        studentId: student.id,
        online: online,
        checkpoint: payload.checkpoint?.wire,
      )) {
        return _rejected(alreadySavedOnDeviceMessage);
      }
    } on Object {
      // A cache read failure must never block a live submission.
    }

    final scannedAt = DateTime.fromMillisecondsSinceEpoch(
      trustedNowMs,
      isUtc: true,
    );
    final clientAttemptId = newReceiptId();
    var deviceIdValue = '';
    try {
      deviceIdValue = await deviceId();
    } catch (_) {
      deviceIdValue = '';
    }

    // Anti-cheat snapshot (A-x): rooted/hooked/emulator evidence rides on
    // every submission so the server can dispute (`rooted_device` /
    // `hook_detected` / `emulator_detected`); probe failures are closed safe.
    DeviceSecurityEvidence? deviceEvidence;
    try {
      deviceEvidence = await deviceSecurityProber?.probe();
    } on Object {
      deviceEvidence = null;
    }

    final evidence = ScanEvidenceInput(
      clientAttemptId: clientAttemptId,
      accuracyMeters: accuracyMeters,
      locationCapturedAt: locationCapturedAt?.toIso8601String(),
      mocked: mocked,
      inputChannel: channel,
      deviceSecurity: deviceEvidence,
    );

    try {
      final record = await attendanceApi.submitScan(
        sessionId: payload.sessionId,
        studentId: student.id,
        studentName: student.fullName,
        lat: latitude,
        lon: longitude,
        deviceId: deviceIdValue,
        qrToken: token,
        scannedAt: scannedAt.toIso8601String(),
        evidence: evidence,
        pin: pin?.trim(),
      );
      return _successOutcome(record, payload);
    } on ApiRequestError catch (error) {
      if (error.isNetworkFailure) {
        // A-h parity: the offline path verifies the scanned token against the
        // cached teacher public key *before* queueing an invalid signature
        // (`api-client.ts:1295-1299`). Both a missing key and a failing
        // signature still fail closed exactly like the RN clients — only the
        // diagnosis splits (SW-6): no cached key means the device was never
        // prepared for this class, not that the token was forged.
        final publicKey = session?.teacherPublicKey?.trim() ?? '';
        if (!isVerifiableTeacherPublicKey(publicKey)) {
          return _rejected(offlineVerificationKeyMissingMessage);
        }
        final verified = await verifyToken(token, publicKey);
        if (!verified) {
          return _rejected(qrTokenSignatureInvalidMessage);
        }

        if (payload.pinRequired) {
          final pinHash = payload.pinHash;
          final verifiedPin =
              pinHash != null &&
              pinHash.isNotEmpty &&
              await verifyMeetingPin(pin!.trim(), pinHash);
          if (!verifiedPin) {
            return _rejected(
              'The meeting PIN could not be verified offline. Reconnect and try again.',
            );
          }
        }

        // Queue-side assertions (RN `api-client.ts:1329-1368` parity): the
        // same accuracy + staleness walls the live check enforced, since a
        // queued scan replays the *captured* evidence later.
        if (!online && (accuracyMeters ?? 0) > maxScanLocationAccuracyMeters) {
          return _rejected(poorLocationAccuracyMessage);
        }
        if (!online &&
            isLocationFixStale(
              trustedReference: scannedAt,
              locationCapturedAt: locationCapturedAt!,
            )) {
          return _rejected(staleLocationMessage());
        }

        try {
          await database.enqueueAttendanceScan(
            clientReceiptId: clientAttemptId,
            userId: student.id,
            sessionId: payload.sessionId,
            studentId: student.id,
            scannedToken: token,
            checkpoint: payload.checkpoint?.wire,
            inputChannel: channel.wire,
            pinHash: payload.pinRequired ? payload.pinHash : null,
            pin: payload.pinRequired ? pin?.trim() : null,
            latitude: latitude,
            longitude: longitude,
            accuracy: accuracyMeters,
            // In-person only: `locationCapturedAt` is null for online
            // checkpoints (RA 10173), so the replay stays location-free.
            locationCapturedAt: locationCapturedAt,
            haversineDistance: haversineMeters,
            isMocked: mocked ?? false,
            scannedAtUtc: scannedAt,
          );
          if (payload.pinRequired && pin != null) {
            // Memory lane: process lifetime fast-path; the queue row also
            // carries an AES-GCM encrypted copy (cold-start parity B-7).
            pinVault?.remember(clientAttemptId, pin);
          }
        } catch (_) {
          return const StudentScanOutcome(
            kind: ScanOutcomeKind.error,
            title: 'CHECK-IN NOT SAVED',
            message:
                'The check-in could not be submitted or saved on this device. Try again.',
          );
        }
        final flagged = isDeviceSecurityFlagged(deviceEvidence);
        return StudentScanOutcome(
          kind: ScanOutcomeKind.offlineQueued,
          title: 'SAVED ON DEVICE',
          message: flagged
              ? 'Offline — Pending Sync. Check-in saved securely on this device '
                    'and queued for sync. This device was flagged for review, so '
                    'your instructor will verify the evidence after sync.'
              : 'Offline — Pending Sync. Check-in saved securely on this device and queued for sync. Confirmation may require instructor review. Open your dashboard to check sync status.',
        );
      }
      return _rejected(
        error.message.trim().isEmpty
            ? 'Your check-in was rejected.'
            : error.message.trim(),
      );
    } on Object {
      return const StudentScanOutcome(
        kind: ScanOutcomeKind.error,
        title: 'CHECK-IN FAILED',
        message: 'Something went wrong while submitting your check-in.',
      );
    }
  }

  StudentScanOutcome _successOutcome(
    AttendanceRecord record,
    QRTokenPayload payload,
  ) {
    final isOnline = payload.mode == SessionMode.online;
    final legStatus = isOnline && payload.checkpoint == CheckpointType.end
        ? record.checkOutStatus ?? record.status
        : record.checkInStatus ?? record.status;

    if (record.status == AttendanceStatus.disputed ||
        legStatus == AttendanceStatus.disputed) {
      return const StudentScanOutcome(
        kind: ScanOutcomeKind.success,
        title: 'FLAGGED FOR REVIEW',
        message: 'This check-in was flagged for instructor review.',
        status: AttendanceStatus.disputed,
      );
    }
    if (!record.isSynced) {
      return const StudentScanOutcome(
        kind: ScanOutcomeKind.offlineQueued,
        title: 'SAVED ON DEVICE',
        message:
            'Offline — Pending Sync. Check-in saved securely on this device and queued for sync. Confirmation may require instructor review. Open your dashboard to check sync status.',
      );
    }
    if (legStatus == AttendanceStatus.late) {
      return const StudentScanOutcome(
        kind: ScanOutcomeKind.success,
        title: 'MARKED LATE',
        message: 'Attendance recorded as late.',
        status: AttendanceStatus.late,
      );
    }
    if (legStatus == AttendanceStatus.incomplete) {
      return const StudentScanOutcome(
        kind: ScanOutcomeKind.success,
        title: 'INCOMPLETE ATTENDANCE',
        message:
            'Your check-in was recorded. Remember to scan the end-of-class code.',
        status: AttendanceStatus.incomplete,
      );
    }
    if (legStatus == AttendanceStatus.pending) {
      return const StudentScanOutcome(
        kind: ScanOutcomeKind.success,
        title: 'CHECK-IN RECORDED',
        message:
            'Your check-in was recorded. Scan the next checkpoint when announced.',
        status: AttendanceStatus.pending,
      );
    }
    if (legStatus == AttendanceStatus.absent) {
      return const StudentScanOutcome(
        kind: ScanOutcomeKind.rejected,
        title: 'CHECK-IN REJECTED',
        message: 'The server did not accept this check-in.',
        status: AttendanceStatus.absent,
      );
    }
    return StudentScanOutcome(
      kind: ScanOutcomeKind.success,
      title: 'ATTENDANCE VERIFIED',
      message: isOnline && payload.checkpoint == CheckpointType.end
          ? 'End-of-class check-out recorded.'
          : isOnline
          ? 'Start-of-class check-in recorded.'
          : 'Attendance recorded as present.',
      status: AttendanceStatus.present,
    );
  }

  StudentScanOutcome _rejected(String message) {
    return StudentScanOutcome(
      kind: ScanOutcomeKind.rejected,
      title: 'CHECK-IN REJECTED',
      message: message,
    );
  }
}

final studentScanServiceProvider = Provider<StudentScanService>((ref) {
  return StudentScanService(
    attendanceApi: ref.watch(attendanceApiProvider),
    sessionsApi: ref.watch(sessionsApiProvider),
    database: ref.watch(appDatabaseProvider),
    trustedClock: ref.watch(trustedClockProvider),
    locationReader: ref.watch(scanLocationReaderProvider),
    deviceId: () => ref.read(deviceIdentityProvider).getOrCreate(),
    deviceNow: ref.watch(deviceNowProvider),
    pinVault: ref.watch(attendancePinVaultProvider),
    deviceSecurityProber: ref.watch(deviceSecurityProberProvider),
  );
});
