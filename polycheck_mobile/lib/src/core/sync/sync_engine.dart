import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_models.dart';
import '../api/api_providers.dart';
import '../api/sync_api.dart';
import '../database/app_database.dart';
import '../models/attendance.dart';
import '../models/user.dart';
import '../network/api_error.dart';
import '../network/dio_client.dart';
import '../providers/session_provider.dart';
import '../utils/device_security.dart';
import 'attendance_pin_vault.dart';

/// Server batch cap (`SyncAttendanceBatchDto` `@ArrayMaxSize(100)`).
const int attendanceSyncMaxBatchSize = 100;

/// Failed rows are retried with an exponential backoff starting here.
const Duration attendanceSyncBackoffBase = Duration(seconds: 5);

/// Backoff ceiling so a long offline stretch never postpones a retry forever.
const Duration attendanceSyncBackoffCap = Duration(minutes: 5);

/// A claim older than this is assumed abandoned (process death mid-drain).
const Duration attendanceSyncStaleClaimAge = Duration(minutes: 2);

/// Why a drain stopped before the queue was empty.
enum SyncAbortReason {
  none,
  ownerChanged,
  unauthorized,

  /// The account must accept the current privacy notice before its location
  /// evidence may be uploaded (`PrivacyConsentGuard` 403). Blocking, not
  /// terminal: the queue survives and drains after consent.
  privacyConsent,
  maintenance,
  offline,
  serverError,
  rejected,
  receiptFailed,
  receiptTimeout,
}

/// Reconciliation summary for one drain pass.
@immutable
class SyncDrainReport {
  const SyncDrainReport({
    this.attempted = 0,
    this.confirmed = 0,
    this.flagged = 0,
    this.duplicates = 0,
    this.retryableFailed = 0,
    this.terminalFailed = 0,
    this.batches = 0,
    this.remaining = 0,
    this.abortReason = SyncAbortReason.none,
  });

  const SyncDrainReport.skipped()
    : attempted = 0,
      confirmed = 0,
      flagged = 0,
      duplicates = 0,
      retryableFailed = 0,
      terminalFailed = 0,
      batches = 0,
      remaining = 0,
      abortReason = SyncAbortReason.none;

  final int attempted;

  /// Rows the server accepted as a clean record.
  final int confirmed;

  /// Rows the server accepted but stamped `disputed` (instructor review).
  /// Synced — never re-queued — but never reported as a plain confirmation.
  final int flagged;
  final int duplicates;
  final int retryableFailed;
  final int terminalFailed;
  final int batches;
  final int remaining;
  final SyncAbortReason abortReason;

  bool get isEmpty => attempted == 0;
  bool get hasNeedsAttention =>
      duplicates > 0 || terminalFailed > 0 || flagged > 0;
  bool get isClean => abortReason == SyncAbortReason.none;

  SyncDrainReport copyWith({
    int? attempted,
    int? confirmed,
    int? flagged,
    int? duplicates,
    int? retryableFailed,
    int? terminalFailed,
    int? batches,
    int? remaining,
    SyncAbortReason? abortReason,
  }) {
    return SyncDrainReport(
      attempted: attempted ?? this.attempted,
      confirmed: confirmed ?? this.confirmed,
      flagged: flagged ?? this.flagged,
      duplicates: duplicates ?? this.duplicates,
      retryableFailed: retryableFailed ?? this.retryableFailed,
      terminalFailed: terminalFailed ?? this.terminalFailed,
      batches: batches ?? this.batches,
      remaining: remaining ?? this.remaining,
      abortReason: abortReason ?? this.abortReason,
    );
  }
}

/// Delay before re-attempting [failures] failed sends (1 => 5s, 2 => 10s ...).
Duration attendanceRetryBackoff(int failures) {
  if (failures <= 0) return Duration.zero;
  final exponent = math.min(failures - 1, 10);
  final millis = attendanceSyncBackoffBase.inMilliseconds * (1 << exponent);
  return Duration(
    milliseconds: math.min(millis, attendanceSyncBackoffCap.inMilliseconds),
  );
}

/// True when [row] may be attempted at [nowUtc].
bool isAttendanceRetryEligible(OfflineAttendanceQueueRow row, DateTime nowUtc) {
  if (row.syncStatus == AttendanceSyncStatus.pending) return true;
  if (row.syncStatus != AttendanceSyncStatus.failed) return false;
  final serverError = row.serverError;
  if (serverError != null && serverError.startsWith('terminal:')) return false;
  final lastSentAt = row.lastSentAt;
  if (lastSentAt == null) return true;
  final elapsed = nowUtc.difference(lastSentAt.toUtc());
  return elapsed >= attendanceRetryBackoff(row.retryCount);
}

/// Exact `ScanAttendanceDto` shape accepted by the batch endpoint.
///
/// The backend runs `forbidNonWhitelisted`, so this intentionally omits
/// `studentId` and `checkpoint` (both derive from the authenticated user and
/// the signed token). It mirrors the live `POST /attendance/scan` body one for
/// one — the replay must carry every byte of evidence the online submission
/// carried, otherwise the backend's `missingCoreEvidence` gate stamps the
/// record `disputed / missing_scan_evidence`:
///
/// * `clientAttemptId` (the queued receipt id),
/// * `inputChannel` (`camera` / `image` / `manual`) — always, for every arc,
/// * `locationCapturedAt` — in-person rows only (the column is only set for
///   them; online checkpoints stay location-free, RA 10173),
/// * `lat` / `lon` / `accuracyMeters` / `mocked` — whichever evidence the scan
///   captured,
/// * `pin` — resolved from the vault or the encrypted column,
/// * `deviceSecurity` — the anti-cheat snapshot (RN parity: the evidence rides
///   inside each queued payload so the server remains authoritative after an
///   offline replay; rooted/hooked/emulator flags dispute the row
///   server-side).
Map<String, dynamic> buildAttendanceSyncPayload(
  OfflineAttendanceQueueRow row, {
  String? deviceId,
  String? pin,
  DeviceSecurityEvidence? deviceSecurity,
}) {
  final payload = <String, dynamic>{
    'sessionId': row.sessionId,
    'qrToken': row.scannedToken,
    'scannedAt': row.scannedAtUtc.toUtc().toIso8601String(),
    'clientAttemptId': row.clientReceiptId,
  };
  final inputChannel = row.inputChannel;
  if (inputChannel != null && inputChannel.isNotEmpty) {
    payload['inputChannel'] = inputChannel;
  }
  final latitude = row.latitude;
  final longitude = row.longitude;
  if (latitude != null && longitude != null) {
    payload['lat'] = latitude;
    payload['lon'] = longitude;
  }
  final locationCapturedAt = row.locationCapturedAt;
  if (locationCapturedAt != null) {
    payload['locationCapturedAt'] = locationCapturedAt
        .toUtc()
        .toIso8601String();
  }
  if (deviceId != null && deviceId.isNotEmpty) {
    payload['deviceId'] = deviceId;
  }
  final accuracy = row.accuracy;
  if (accuracy != null) payload['accuracyMeters'] = accuracy;
  if (row.isMocked) payload['mocked'] = true;
  if (pin != null && pin.isNotEmpty) payload['pin'] = pin;
  if (deviceSecurity != null) {
    payload['deviceSecurity'] = deviceSecurity.toJson();
  }
  return payload;
}

/// Terminal evidence messages mirrored from `shared/src/utils/classify-sync-error.ts`.
const List<String> _terminalSyncFailures = <String>[
  'signature is invalid',
  'does not match this session',
  'outside the session geofence',
  'mocked locations are not accepted',
  'location accuracy is too poor',
  'location fix is stale',
  'location uncertainty extends outside',
  'scan timestamp is invalid',
  'attendance window has expired',
  'already submitted for this session',
  'not enrolled in this section',
  'clientattemptid was already used',
  'already used for a different scan payload',
];

bool isTerminalAttendanceSyncError(String message) {
  final normalized = message.toLowerCase();
  return _terminalSyncFailures.any(normalized.contains);
}

/// First-arrival-wins: the server rejected a second check-in because the
/// session roster already holds the student's attendance.
bool isDuplicateAttendanceSyncError(String message) {
  return message.toLowerCase().contains('already submitted for this session');
}

/// The only batch-level HTTP statuses that are contract-terminal: the request
/// shape itself can never be accepted for these rows.
///
/// * `400` — validation failure (`forbidNonWhitelisted` / malformed record),
/// * `409` — duplicate replay (the batch/lookup already exists server-side),
/// * `422` — unprocessable records.
///
/// Everything else (`403` privacy consent or a scope rejection, `404`, `405`,
/// `409` in-flight, `413`) must leave the evidence retryable. Terminalizing a
/// whole batch on any 4xx used to destroy up to 25 queued check-ins when
/// `PRIVACY_NOTICE_VERSION` was bumped (DD-F19).
const Set<int> terminalAttendanceSyncStatuses = <int>{400, 409, 422};

bool isTerminalAttendanceSyncStatus(int status) =>
    terminalAttendanceSyncStatuses.contains(status);

/// `403` raised by `PrivacyConsentGuard`
/// (`backend/src/common/guards/privacy-consent.guard.ts`): the account has not
/// accepted the current notice version, so the sync endpoint refuses location
/// evidence until it does. Blocking like `401`/maintenance — never terminal.
bool isPrivacyConsentSyncError(ApiRequestError error) {
  if (error.status != 403) return false;
  final code = (error.code ?? '').toLowerCase();
  final message = error.message.toLowerCase();
  return code.contains('privacy') ||
      code.contains('consent') ||
      message.contains('privacy consent');
}

class _ReceiptFailed implements Exception {
  const _ReceiptFailed();
}

class _ReceiptTimeout implements Exception {
  const _ReceiptTimeout();
}

/// Drains [OfflineAttendanceQueue] in server-sized batches and reconciles
/// per-record receipts.
///
/// * one drain at a time **per owner** (concurrent `drain` calls for the same
///   student share the in-flight future; another student's drain is never
///   joined),
/// * rows are claimed `SYNCING` and released back to `PENDING` on auth,
///   privacy-consent or maintenance aborts,
/// * transient failures stay `FAILED` with exponential backoff,
/// * only a contract-terminal batch status (400/409/422) or a per-record
///   contract rejection terminalizes evidence; every other 4xx stays
///   retryable,
/// * terminal evidence stays in the table prefixed `terminal:` / marked
///   `DISPUTED_DUPLICATE` - never deleted,
/// * a receipt that reconciles a `disputed` record marks the row
///   `CONFIRMED_FLAGGED` (synced, instructor review pending).
class SyncEngine {
  SyncEngine({
    required this.database,
    required this.transport,
    Future<String> Function()? deviceId,
    this.pinVault,
    this.deviceSecurityProber,
    this.batchSize = 25,
    this.receiptPollInterval = const Duration(milliseconds: 400),
    this.maxReceiptPolls = 30,
    DateTime Function()? now,
  }) : assert(batchSize > 0 && batchSize <= attendanceSyncMaxBatchSize),
       deviceId = deviceId ?? (() async => ''),
       now = now ?? DateTime.now;

  final AppDatabase database;
  final SyncTransport transport;
  final Future<String> Function() deviceId;
  final AttendancePinVault? pinVault;

  /// Best-effort anti-cheat snapshot re-attached to every replayed payload
  /// (the queue row does not persist evidence; the device's integrity state —
  /// a device-level property, stable relative to the scan — is what the
  /// server wants to see). A null prober skips the field entirely.
  final DeviceSecurityProber? deviceSecurityProber;
  final int batchSize;
  final Duration receiptPollInterval;
  final int maxReceiptPolls;
  final DateTime Function() now;

  /// One in-flight drain per owner. Keying on the owner (not a single slot)
  /// is what stops a new student's drain from joining — and inheriting the
  /// `ownerChanged` verdict of — the previous account's drain after an
  /// account switch (DD-F21).
  final Map<String, Future<SyncDrainReport>> _inFlight =
      <String, Future<SyncDrainReport>>{};

  bool get isDraining => _inFlight.isNotEmpty;

  /// True while [userId]'s drain is running (a different owner's drain is
  /// never joined).
  bool isDrainingFor(String userId) => _inFlight.containsKey(userId);

  /// Runs (or joins) [userId]'s active drain.
  Future<SyncDrainReport> drain({
    required String userId,
    required bool Function() isOwnerCurrent,
  }) {
    final active = _inFlight[userId];
    if (active != null) return active;
    final future = _run(userId: userId, isOwnerCurrent: isOwnerCurrent)
        .whenComplete(() {
          _inFlight.remove(userId);
        });
    _inFlight[userId] = future;
    return future;
  }

  Future<SyncDrainReport> _run({
    required String userId,
    required bool Function() isOwnerCurrent,
  }) async {
    var report = const SyncDrainReport();
    final start = now().toUtc();
    await database.resetStaleSyncingAttendance(
      userId,
      olderThan: start.subtract(attendanceSyncStaleClaimAge),
    );

    while (true) {
      if (!isOwnerCurrent()) {
        return _finish(report, userId, SyncAbortReason.ownerChanged);
      }

      final candidates = await database.drainableAttendanceQueue(userId);
      final nowUtc = now().toUtc();
      final claimed = candidates
          .where((row) => isAttendanceRetryEligible(row, nowUtc))
          .take(batchSize)
          .toList(growable: false);
      if (claimed.isEmpty) {
        return _finish(report, userId, SyncAbortReason.none);
      }

      for (final row in claimed) {
        await database.markQueueSyncing(row.clientReceiptId, sentAt: nowUtc);
      }
      if (!isOwnerCurrent()) {
        await _releasePending(claimed);
        return _finish(report, userId, SyncAbortReason.ownerChanged);
      }

      String device = '';
      try {
        device = await deviceId();
      } catch (_) {
        device = '';
      }
      if (!isOwnerCurrent()) {
        await _releasePending(claimed);
        return _finish(report, userId, SyncAbortReason.ownerChanged);
      }

      // The scan-time vault (in-memory fast path) loses to nothing: a PIN
      // vaulted for this attempt always wins, the encrypted column is the
      // cold-start path. A failed decrypt drains WITHOUT the pin and the
      // server stamps terminal `pin_required` — never a crash.
      final pins = <String, String?>{
        for (final row in claimed) row.clientReceiptId: await resolvePin(row),
      };

      // RN parity: every replayed scan payload carries the anti-cheat
      // snapshot (`scan-validator` disputes rooted/hooked/emulator replays).
      DeviceSecurityEvidence? evidence;
      if (deviceSecurityProber != null) {
        try {
          evidence = await deviceSecurityProber!.probe();
        } catch (_) {
          evidence = null;
        }
      }

      final payloads = <Map<String, dynamic>>[
        for (final row in claimed)
          buildAttendanceSyncPayload(
            row,
            deviceId: device,
            pin: pins[row.clientReceiptId],
            deviceSecurity: evidence,
          ),
      ];

      final List<SyncRecordResult>? results;
      try {
        final submission = await transport.submitBatch(payloads);
        if (!isOwnerCurrent()) {
          await _releasePending(claimed);
          return _finish(report, userId, SyncAbortReason.ownerChanged);
        }
        results = await _resolveResults(
          submission,
          isOwnerCurrent: isOwnerCurrent,
        );
      } on _OwnerAbort {
        await _releasePending(claimed);
        return _finish(report, userId, SyncAbortReason.ownerChanged);
      } on _ReceiptFailed {
        await _markRetryable(
          claimed,
          'The sync server did not accept this batch. It will retry automatically.',
        );
        return _finish(
          report.copyWith(
            retryableFailed: report.retryableFailed + claimed.length,
          ),
          userId,
          SyncAbortReason.receiptFailed,
        );
      } on _ReceiptTimeout {
        await _markRetryable(
          claimed,
          'Awaiting server confirmation. Saved check-ins will retry automatically.',
        );
        return _finish(
          report.copyWith(
            retryableFailed: report.retryableFailed + claimed.length,
          ),
          userId,
          SyncAbortReason.receiptTimeout,
        );
      } on ApiRequestError catch (error) {
        return _handleApiAbort(error, claimed, report, userId, isOwnerCurrent);
      } on Object {
        await _markRetryable(
          claimed,
          'Sync paused. Saved check-ins will retry automatically.',
        );
        return _finish(
          report.copyWith(
            retryableFailed: report.retryableFailed + claimed.length,
          ),
          userId,
          SyncAbortReason.serverError,
        );
      }

      if (!isOwnerCurrent()) {
        await _releasePending(claimed);
        return _finish(report, userId, SyncAbortReason.ownerChanged);
      }

      if (results == null) {
        await _markRetryable(
          claimed,
          'Awaiting server confirmation. Saved check-ins will retry automatically.',
        );
        return _finish(
          report.copyWith(
            retryableFailed: report.retryableFailed + claimed.length,
          ),
          userId,
          SyncAbortReason.receiptFailed,
        );
      }

      var confirmed = report.confirmed;
      var flagged = report.flagged;
      var duplicates = report.duplicates;
      var retryableFailed = report.retryableFailed;
      var terminalFailed = report.terminalFailed;

      for (var index = 0; index < claimed.length; index++) {
        final row = claimed[index];
        final result = index < results.length ? results[index] : null;
        if (result == null) {
          await database.markQueueFailed(
            row.clientReceiptId,
            serverError:
                'The sync receipt did not include a result for this check-in.',
          );
          retryableFailed++;
          continue;
        }
        switch (result) {
          case SyncRecordSuccess(:final record):
            // The server returns disputed records as success-with-record
            // (e.g. `delayed_offline_sync`). The row is synced and must never
            // be re-queued, but reporting it as a plain confirmation masks
            // the dispute (DD-F3) — flag it so the UI can say
            // "synced — flagged for instructor review".
            final disputed = record.status == AttendanceStatus.disputed;
            await database.markQueueConfirmed(
              row.clientReceiptId,
              flagged: disputed,
              serverError: disputed
                  ? 'flagged: ${record.disputeReason?.wire ?? 'disputed'}'
                  : null,
            );
            await database.clearQueuePin(row.clientReceiptId);
            await database.upsertAttendance(userId, <AttendanceRecord>[record]);
            pinVault?.forget(row.clientReceiptId);
            if (disputed) {
              flagged++;
            } else {
              confirmed++;
            }
          case SyncRecordFailure(:final error, :final retryable):
            final terminal = !retryable || isTerminalAttendanceSyncError(error);
            if (terminal) {
              if (isDuplicateAttendanceSyncError(error)) {
                await database.markQueueDisputedDuplicate(
                  row.clientReceiptId,
                  serverError: error,
                );
                duplicates++;
              } else {
                await database.markQueueFailed(
                  row.clientReceiptId,
                  serverError: 'terminal: $error',
                  incrementRetry: false,
                );
                terminalFailed++;
              }
              await database.clearQueuePin(row.clientReceiptId);
              pinVault?.forget(row.clientReceiptId);
            } else {
              await database.markQueueFailed(
                row.clientReceiptId,
                serverError: error,
              );
              retryableFailed++;
            }
        }
      }

      report = report.copyWith(
        attempted: report.attempted + claimed.length,
        confirmed: confirmed,
        flagged: flagged,
        duplicates: duplicates,
        retryableFailed: retryableFailed,
        terminalFailed: terminalFailed,
        batches: report.batches + 1,
      );
    }
  }

  /// In-memory vault first; the encrypted queue column is the cold-start
  /// path. Both may be absent (no PIN needed) or null (failed decrypt).
  Future<String?> resolvePin(OfflineAttendanceQueueRow row) async {
    final vaulted = pinVault?.pinFor(row.clientReceiptId);
    if (vaulted != null && vaulted.isNotEmpty) return vaulted;
    return database.decryptQueuePin(row);
  }

  Future<List<SyncRecordResult>?> _resolveResults(
    SyncBatchSubmitResult submission, {
    required bool Function() isOwnerCurrent,
  }) async {
    if (!submission.queued) return submission.results;
    final receiptId = submission.receiptId;
    if (receiptId == null || receiptId.isEmpty) return null;

    for (var poll = 0; poll < maxReceiptPolls; poll++) {
      if (!isOwnerCurrent()) {
        throw const _OwnerAbort();
      }
      if (poll > 0) await Future<void>.delayed(receiptPollInterval);
      final status = await transport.getBatchStatus(receiptId);
      if (status.isCompleted) return status.results;
      if (status.isFailed) throw const _ReceiptFailed();
    }
    throw const _ReceiptTimeout();
  }

  Future<SyncDrainReport> _handleApiAbort(
    ApiRequestError error,
    List<OfflineAttendanceQueueRow> claimed,
    SyncDrainReport report,
    String userId,
    bool Function() isOwnerCurrent,
  ) async {
    if (error.isUnauthorized) {
      await _releasePending(claimed);
      return _finish(report, userId, SyncAbortReason.unauthorized);
    }
    if (error.isMaintenance) {
      await _releasePending(claimed);
      return _finish(report, userId, SyncAbortReason.maintenance);
    }
    // Privacy-consent gate: a notice-version bump 403s the whole batch. Block
    // and retry after consent — terminalizing here destroyed every queued
    // check-in permanently (DD-F19).
    if (isPrivacyConsentSyncError(error)) {
      await _releasePending(claimed);
      return _finish(report, userId, SyncAbortReason.privacyConsent);
    }
    if (error.status == 429) {
      await _markRetryable(
        claimed,
        'Too many sync attempts. Saved check-ins will retry shortly.',
      );
      return _finish(
        report.copyWith(
          retryableFailed: report.retryableFailed + claimed.length,
        ),
        userId,
        SyncAbortReason.serverError,
      );
    }
    if (error.status >= 400 && error.status < 500) {
      // Only a contract-terminal set (400 invalid payload, 409 duplicate
      // replay, 422) can never be accepted. Every other 4xx — 403 scope, 404,
      // 405, 409 in-flight, 413 — leaves the claimed evidence retryable with
      // backoff instead of destroying the batch (DD-F19, locked decision 10).
      if (isTerminalAttendanceSyncStatus(error.status)) {
        for (final row in claimed) {
          await database.markQueueFailed(
            row.clientReceiptId,
            serverError: 'terminal: ${error.message}',
            incrementRetry: false,
          );
        }
        return _finish(
          report.copyWith(
            terminalFailed: report.terminalFailed + claimed.length,
          ),
          userId,
          SyncAbortReason.rejected,
        );
      }
      await _markRetryable(
        claimed,
        'Sync paused. Saved check-ins will retry automatically.',
      );
      return _finish(
        report.copyWith(
          retryableFailed: report.retryableFailed + claimed.length,
        ),
        userId,
        SyncAbortReason.serverError,
      );
    }
    final message = error.status == 0
        ? 'No connection. Saved check-ins will sync when you reconnect.'
        : 'Sync paused. Saved check-ins will retry automatically.';
    await _markRetryable(claimed, message);
    return _finish(
      report.copyWith(retryableFailed: report.retryableFailed + claimed.length),
      userId,
      error.status == 0 ? SyncAbortReason.offline : SyncAbortReason.serverError,
    );
  }

  Future<void> _releasePending(List<OfflineAttendanceQueueRow> rows) async {
    for (final row in rows) {
      await database.markQueuePending(row.clientReceiptId);
    }
  }

  Future<void> _markRetryable(
    List<OfflineAttendanceQueueRow> rows,
    String message,
  ) async {
    for (final row in rows) {
      await database.markQueueFailed(row.clientReceiptId, serverError: message);
    }
  }

  Future<SyncDrainReport> _finish(
    SyncDrainReport report,
    String userId,
    SyncAbortReason reason,
  ) async {
    // Persist the latest sync moment so dashboard panels show a live
    // "Last sync HH:MM" whenever a drain reconciled at least one record
    // (a flagged record was reconciled too — it exists server-side).
    if (report.confirmed > 0 || report.flagged > 0) {
      await database.writeLastSync(userId, DateTime.now().toUtc());
    }
    final remaining = await database.countDrainableAttendance(userId);
    return report.copyWith(remaining: remaining, abortReason: reason);
  }
}

class _OwnerAbort implements Exception {
  const _OwnerAbort();
}

/// UI-facing drain state.
@immutable
class SyncActivity {
  const SyncActivity({this.draining = false, this.lastReport});

  final bool draining;
  final SyncDrainReport? lastReport;

  SyncActivity copyWith({
    bool? draining,
    SyncDrainReport? lastReport,
    bool clearReport = false,
  }) {
    return SyncActivity(
      draining: draining ?? this.draining,
      lastReport: clearReport ? null : (lastReport ?? this.lastReport),
    );
  }
}

class SyncController extends Notifier<SyncActivity> {
  /// One in-flight drain per owner, never shared across accounts: after a
  /// switch the new student's "Sync now" must drain its own queue instead of
  /// joining the previous owner's future and inheriting its `ownerChanged`
  /// verdict (DD-F21).
  final Map<String, Future<SyncDrainReport>> _inFlight =
      <String, Future<SyncDrainReport>>{};
  bool _disposed = false;

  bool get isDraining => _inFlight.isNotEmpty;

  @override
  SyncActivity build() {
    ref.onDispose(() {
      _disposed = true;
    });
    return const SyncActivity();
  }

  /// Manual/automatic drain entry point. Only student sessions queue evidence.
  Future<SyncDrainReport> drainNow() {
    final user = ref.read(sessionProvider).user;
    if (user == null || user.role != UserRole.student) {
      return Future<SyncDrainReport>.value(const SyncDrainReport.skipped());
    }

    final active = _inFlight[user.id];
    if (active != null) return active;

    _set(state.copyWith(draining: true));
    final future = _drainFor(user.id).whenComplete(() {
      _inFlight.remove(user.id);
      _set(state.copyWith(draining: _inFlight.isNotEmpty));
    });
    _inFlight[user.id] = future;
    return future;
  }

  /// Per-row manual retry (web `OfflineSyncPanel` parity): returns the row to
  /// `PENDING` preserving every byte of evidence and the original receipt id,
  /// then runs a drain. A row waiting on backoff retries immediately; a
  /// terminal row retries once and re-stamps terminal when it still fails.
  /// Rows of other users are ignored.
  Future<SyncDrainReport> retryOne(String clientReceiptId) async {
    final user = ref.read(sessionProvider).user;
    if (user == null || user.role != UserRole.student) {
      return const SyncDrainReport.skipped();
    }
    final database = ref.read(appDatabaseProvider);
    final row = await database.attendanceQueueEntry(clientReceiptId);
    if (row == null || row.userId != user.id) {
      return const SyncDrainReport.skipped();
    }

    // A drain already running has claimed its batch: resetting the row now
    // would land under that batch, and `drainNow()` would return the in-flight
    // report without ever attempting the reset row (DD-F9). Let this owner's
    // drain settle first, then reset and re-drain.
    final active = _inFlight[user.id];
    if (active != null) {
      try {
        await active;
      } on Object catch (error) {
        // Degraded mode: the manual retry still proceeds. `_drainFor` already
        // turned a thrown drain into a typed `SyncDrainReport`.
        debugPrint('SyncController.retryOne: in-flight drain failed: $error');
      }
    }
    await database.markQueuePending(clientReceiptId);
    return drainNow();
  }

  Future<SyncDrainReport> _drainFor(String userId) async {
    final engine = ref.read(syncEngineProvider);
    SyncDrainReport report;
    try {
      report = await engine.drain(
        userId: userId,
        isOwnerCurrent: () {
          final current = ref.read(sessionProvider).user;
          return current?.id == userId && current?.role == UserRole.student;
        },
      );
    } on Object catch (error) {
      // Degraded mode: the caller gets a typed report instead of an
      // exception; the queue keeps its evidence for the next trigger.
      debugPrint('SyncController._drainFor: drain failed: $error');
      report = const SyncDrainReport(abortReason: SyncAbortReason.serverError);
    }
    _set(state.copyWith(lastReport: report));
    return report;
  }

  void _set(SyncActivity next) {
    if (_disposed) return;
    state = next;
  }
}

final syncEngineProvider = Provider<SyncEngine>((ref) {
  return SyncEngine(
    database: ref.watch(appDatabaseProvider),
    transport: ref.watch(syncApiProvider),
    deviceId: () => ref.read(deviceIdentityProvider).getOrCreate(),
    pinVault: ref.watch(attendancePinVaultProvider),
    deviceSecurityProber: ref.watch(deviceSecurityProberProvider),
  );
});

final syncControllerProvider = NotifierProvider<SyncController, SyncActivity>(
  SyncController.new,
);

/// Human-readable result for the dashboard toast.
String syncDrainMessage(SyncDrainReport report) {
  if (report.abortReason == SyncAbortReason.unauthorized) {
    return 'Sign in again to sync saved check-ins.';
  }
  if (report.abortReason == SyncAbortReason.privacyConsent) {
    return 'Accept the updated privacy notice to sync saved check-ins.';
  }
  if (report.abortReason == SyncAbortReason.maintenance) {
    return 'Polycheck is under maintenance. Saved check-ins stay on this device.';
  }
  if (report.abortReason == SyncAbortReason.ownerChanged) {
    // Never "already synced": the drain belonged to the previous account, and
    // the current one's queue was not attempted (DD-F21).
    return 'Account changed. Check-ins saved by the previous student stay on '
        'this device; sign back in as that student to sync them.';
  }
  if (report.attempted == 0) {
    if (report.abortReason == SyncAbortReason.offline) {
      return 'No connection. Saved check-ins will sync when you reconnect.';
    }
    if (report.abortReason == SyncAbortReason.serverError ||
        report.abortReason == SyncAbortReason.receiptFailed ||
        report.abortReason == SyncAbortReason.receiptTimeout) {
      return 'Sync paused. Saved check-ins will retry automatically.';
    }
    if (report.abortReason == SyncAbortReason.rejected) {
      return 'Saved check-ins could not be synced.';
    }
    return 'Everything is already synced.';
  }
  final parts = <String>[];
  if (report.confirmed > 0) {
    parts.add(
      '${report.confirmed} check-in${report.confirmed == 1 ? '' : 's'} synced',
    );
  }
  if (report.flagged > 0) {
    parts.add(
      '${report.flagged} check-in${report.flagged == 1 ? '' : 's'} synced — '
      'flagged for instructor review',
    );
  }
  if (report.duplicates > 0) {
    parts.add(
      '${report.duplicates} duplicate${report.duplicates == 1 ? '' : 's'} flagged',
    );
  }
  final failed = report.retryableFailed + report.terminalFailed;
  if (failed > 0) {
    parts.add('$failed could not be synced');
  }
  if (report.abortReason == SyncAbortReason.offline) {
    parts.add('the rest will retry when you reconnect');
  } else if (report.remaining > 0) {
    parts.add('${report.remaining} still waiting');
  }
  return '${parts.join(', ')}.';
}
