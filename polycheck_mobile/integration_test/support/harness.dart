import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/models/session.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/network/api_events.dart';
import 'package:polycheck_mobile/src/core/network/dio_client.dart';
import 'package:polycheck_mobile/src/core/network/secure_token_store.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/sync/sync_engine.dart';
import 'package:polycheck_mobile/src/core/utils/device_security.dart';
import 'package:polycheck_mobile/src/features/student/data/student_scan_service.dart';
import 'package:polycheck_mobile/src/features/surface/data/outage_demo.dart';
import 'package:polycheck_mobile/src/features/surface/presentation/widgets/outage_widgets.dart';

import 'api_helpers.dart';
import 'env.dart';

/// Drives the real app graph (Riverpod container + on-device Drift database +
/// the app's own Dio client) from a test process.
///
/// Only two providers are overridden, and only where a device cannot supply
/// the input:
/// * `scanLocationReaderProvider` — an emulator has no dependable GNSS fix, so
///   the harness returns a deterministic fix at the fixture geofence centre.
///   Everything downstream (accuracy cap, staleness math, haversine geofence,
///   evidence capture) still runs for real.
/// * `deviceSecurityProberProvider` — a CI emulator would otherwise report
///   `emulatorDetected: true` and the server would (correctly) dispute every
///   scan as `emulator_detected`. The harness supplies a clean snapshot from
///   the app's own prober with the platform sweeps stubbed out.
class AppHarness {
  AppHarness._(this.container) : remote = FixtureApi();

  /// Real container: `appDatabaseProvider` is untouched, so this is the
  /// production `AppDatabase.open()` on the device filesystem.
  final ProviderContainer container;

  /// Fixture/admin HTTP, with its own token jar.
  final FixtureApi remote;

  /// Boots the app graph.
  ///
  /// [resetToken] clears the persisted bearer token first, so
  /// `SessionController.restore()` short-circuits to `signedOut` instead of
  /// racing a `/auth/me` call against the login this spec is about. Without it a
  /// token left behind by an earlier test in the same file would make every
  /// spec depend on run order.
  static Future<AppHarness> boot({bool resetToken = true}) async {
    IntegrationEnv.assertAppClientTargetsHarness();
    if (resetToken) await SecureTokenStore().clear();
    final harness = AppHarness._(
      ProviderContainer(
        overrides: [
          scanLocationReaderProvider.overrideWithValue(
            FixedScanLocationReader(
              latitude: IntegrationEnv.campusLatitude,
              longitude: IntegrationEnv.campusLongitude,
              accuracyMeters: IntegrationEnv.campusAccuracyMeters,
            ),
          ),
          deviceSecurityProberProvider.overrideWithValue(
            const DefaultDeviceSecurityProber(
              readFingerprint: _noFingerprint,
              pathProbe: _nothingOnDisk,
              hookPortProbe: _noHookPort,
            ),
          ),
        ],
      ),
    );
    // The app installs this on its own Dio at the surface shell; a headless
    // test never mounts that shell, so install it explicitly. It is a no-op
    // unless `ENABLE_OUTAGE_SIMULATOR=true`.
    SurfaceOutageInterceptor.install(harness.dio);
    return harness;
  }

  AppDatabase get database => container.read(appDatabaseProvider);

  Dio get dio => container.read(dioProvider);

  SessionController get session => container.read(sessionProvider.notifier);

  // ── Outage simulation ───────────────────────────────────────────────────

  /// Fails the test with an actionable message instead of silently running
  /// online when the define is missing.
  static void requireOutageSimulator() {
    if (!OutageDemo.enabled) {
      throw StateError(
        'This spec drives the offline path; pass '
        '--dart-define=ENABLE_OUTAGE_SIMULATOR=true.',
      );
    }
  }

  void armOutage() {
    requireOutageSimulator();
    OutageDemo.arm();
  }

  void disarmOutage() => OutageDemo.disarm();

  // ── Auth ────────────────────────────────────────────────────────────────

  /// Signs in through the app's own session controller (device identity,
  /// secure token store, profile cache), exactly like the login screen does.
  Future<User> signInStudent({
    required String studentId,
    required String password,
  }) {
    return session.loginStudent(studentId: studentId, password: password);
  }

  /// `SyncController`/`SyncEngine` are consent-gated server-side. A brand-new
  /// fixture account has no consent version, so accept the current notice the
  /// same way the app's privacy gate does.
  Future<void> acceptPrivacyNotice() async {
    final api = container.read(sessionApiProvider);
    final notice = await api.getPrivacyNotice();
    await api.acceptPrivacyConsent(notice.version);
  }

  /// Programmatic/authoritative sign-out (replaced session, forced re-auth).
  ///
  /// This is the path the offline queue must survive: `clearOwner(...,
  /// preserveAttendanceQueue: true)`.
  Future<void> expireSession() {
    return session.handleSessionExpired(
      SessionExpiredEvent(
        at: DateTime.now().toUtc(),
        method: 'GET',
        path: '/integration-test/forced-expiry',
        message: 'Integration-test authoritative session replacement',
      ),
    );
  }

  /// User-initiated sign-out, which intentionally purges the offline store.
  Future<void> signOut() => session.logout();

  // ── Cached session (offline verification key) ───────────────────────────

  /// Fetches a session online and writes it into the cache under [userId].
  ///
  /// The offline scan path verifies the token against
  /// `cachedSession.teacherPublicKey`, so this must happen while the network is
  /// still up — it is the "prepared device" precondition.
  Future<Session> cacheSession(String userId, String sessionId) async {
    final session = await container
        .read(sessionsApiProvider)
        .getSession(sessionId);
    await database.upsertSessions(userId, <Session>[session]);
    return session;
  }

  // ── Scan + drain ────────────────────────────────────────────────────────

  Future<StudentScanOutcome> scan({
    required String rawToken,
    required User student,
    ScanInputChannel channel = ScanInputChannel.camera,
    String? pin,
  }) {
    return container
        .read(studentScanServiceProvider)
        .submitToken(
          rawToken: rawToken,
          student: student,
          channel: channel,
          pin: pin,
        );
  }

  Future<List<OfflineAttendanceQueueRow>> queueRows(String userId) =>
      database.pendingAttendanceQueue(userId);

  Future<OfflineAttendanceQueueRow?> queueRow(String clientReceiptId) =>
      database.attendanceQueueEntry(clientReceiptId);

  /// Reads back every queue row for [userId] regardless of sync status, so a
  /// spec can prove a terminal/confirmed row was retained, not deleted.
  Future<List<OfflineAttendanceQueueRow>> allQueueRows(String userId) {
    return (database.select(
      database.offlineAttendanceQueue,
    )..where((row) => row.userId.equals(userId))).get();
  }

  /// Drains the real sync engine for [userId] with the real ownership
  /// predicate (a drain aborts if the account changed underneath it).
  Future<SyncDrainReport> drain(String userId) {
    return container
        .read(syncEngineProvider)
        .drain(
          userId: userId,
          isOwnerCurrent: () =>
              container.read(sessionProvider).user?.id == userId,
        );
  }

  Future<void> dispose() async {
    disarmOutage();
    remote.close();
    container.dispose();
  }
}

/// Deterministic GNSS fixture.
///
/// Emits a fix "right now" from both clocks, so the age math
/// (`trustedLocationCapturedAt`) resolves to zero skew and the 2-minute
/// staleness wall passes for the honest reason.
class FixedScanLocationReader implements ScanLocationReader {
  FixedScanLocationReader({
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
  });

  final double latitude;
  final double longitude;
  final double accuracyMeters;

  int fixCount = 0;

  @override
  Future<ScanLocation> current() async {
    fixCount++;
    final now = DateTime.now().toUtc();
    return ScanLocation(
      latitude: latitude,
      longitude: longitude,
      accuracyMeters: accuracyMeters,
      isMocked: false,
      capturedAt: now,
      deviceNowAtFix: now,
    );
  }
}

String _noFingerprint() => '';

bool _nothingOnDisk(String path) => false;

bool _noHookPort(int port) => false;
