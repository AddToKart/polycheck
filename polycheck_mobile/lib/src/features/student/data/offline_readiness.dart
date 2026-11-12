import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/core/sync/readiness.dart';

import 'student_cache.dart';

/// Pre-session offline preparation (`preSyncOfflineData` parity — web
/// `frontend/src/lib/api-client.ts:2106-2131`, gap report B-10/B-11).
///
/// One run: refreshes the trusted clock offset, hands the queue a drain
/// window, and refreshes every cache the offline scanner needs (subjects,
/// enrolled sections + their sessions, and the student's own attendance).
/// Every step records a typed failure instead of swallowing it; the caller
/// decides what to surface (the chip toasts, the panel lists the queue).
///
/// `CachedMeta.lastPreparedAt` does not exist as a column (core/database is
/// frozen for this wave), so the stamp persists through the owner-scoped
/// schedule-cache store (`AppDatabase.putScheduleCache`) under a dedicated
/// range key — the same owner-scoped drift store contract.
const String offlinePreparedCacheKey = 'offline-prepared-at';

enum OfflinePrepStep {
  clock,
  drain,
  subjects,
  sections,
  sessions,
  attendance,

  /// Teacher verification keys for the cached today/tomorrow sessions are
  /// missing (SW-6): the scan gate would fail closed offline.
  teacherKey,
}

/// One step-specific typed failure. Never thrown to the caller — failures
/// ride on [OfflinePreparationResult.failures] so partial progress is never
/// swallowed by an offline transport outage.
@immutable
class OfflinePrepFailure implements Exception {
  const OfflinePrepFailure(this.step, this.error);

  final OfflinePrepStep step;
  final ApiRequestError error;

  @override
  String toString() => 'OfflinePrepFailure(${step.name}: ${error.message})';
}

/// Summary of one preparation run: counts cached + typed failures
/// (web `preSyncOfflineData` throws on non-network failures; the mobile run
/// keeps its partial writes and reports the failures in-band instead).
@immutable
class OfflinePreparationResult {
  const OfflinePreparationResult({
    required this.preparedAt,
    required this.enrolledSectionIds,
    required this.subjectsCached,
    required this.sectionsCached,
    required this.sessionsCached,
    required this.attendanceCached,
    required this.clockOffsetPresent,
    required this.drainReport,
    required this.failures,
  });

  final DateTime preparedAt;
  final List<String> enrolledSectionIds;
  final int subjectsCached;
  final int sectionsCached;
  final int sessionsCached;
  final int attendanceCached;
  final bool clockOffsetPresent;
  final SyncDrainReport? drainReport;
  final List<OfflinePrepFailure> failures;

  bool get isComplete => failures.isEmpty;

  int get totalCached =>
      subjectsCached + sectionsCached + sessionsCached + attendanceCached;

  OfflinePrepFailure? get firstFailure =>
      failures.isEmpty ? null : failures.first;
}

/// Reads the persisted preparation stamp (owner-scoped, device UTC).
Future<DateTime?> readOfflineLastPreparedAt(
  AppDatabase database,
  String userId,
) async {
  final rows = await database.readScheduleCache(
    userId,
    offlinePreparedCacheKey,
  );
  for (final raw in rows ?? const <Object?>[]) {
    if (raw is String) {
      final parsed = DateTime.tryParse(raw);
      if (parsed != null) return parsed;
    }
  }
  return null;
}

/// Queue issue label (web `OfflineSyncPanel.tsx:23-36` mapping; the drift
/// queue stores attendance kinds only, so unknown kinds stay "Check-in").
String offlineQueueIssueLabel(String? kind) {
  return switch (kind) {
    'attendance_scan' || 'scan_attempt' || 'attendance_queue' => 'Check-in',
    'attendance_manual' || 'attendance_status' => 'Manual attendance',
    'session_activation' => 'QR activation',
    'session_end' => 'Session end',
    _ => 'Check-in',
  };
}

/// `Last sync HH:MM` / `Not synced yet` (web `OfflineSyncPanel.tsx:16-21`).
String formatOfflineLastSync(DateTime? at) {
  if (at == null) return 'Not synced yet';
  final local = at.toUtc().toLocal();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return 'Last sync $hour:$minute';
}

/// The preparation orchestrator. All collaborators are injectable so the
/// wave contracts under hermetic tests (drift memory DB + stub APIs).
class OfflinePreparation {
  OfflinePreparation({
    required this.database,
    required this.subjectsApi,
    required this.sectionsApi,
    required this.sessionsApi,
    required this.attendanceApi,
    this.refreshClock,
    this.drain,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final AppDatabase database;
  final SubjectsApi subjectsApi;
  final SectionsApi sectionsApi;
  final SessionsApi sessionsApi;
  final AttendanceApi attendanceApi;

  /// `/health` offset refresh (provider wiring reads the trusted clock).
  /// Returns whether an offset is persisted after the attempt.
  final Future<bool> Function()? refreshClock;

  /// Drain hint. Never a hard requirement — the queue keeps its own
  /// lifecycle triggers (resume/connectivity regain/30 s foreground timer).
  final Future<SyncDrainReport> Function()? drain;

  final DateTime Function() _now;

  /// Records a step failure for ANY error type. Steps 3–6 used to catch only
  /// [ApiRequestError], so a decode/type/cache failure escaped `prepare`
  /// entirely and the chip reported nothing at all (DD-F16).
  void _recordFailure(
    List<OfflinePrepFailure> failures,
    OfflinePrepStep step,
    Object error,
  ) {
    failures.add(
      OfflinePrepFailure(
        step,
        error is ApiRequestError
            ? error
            : ApiRequestError(message: '$error', status: 0),
      ),
    );
  }

  Future<OfflinePreparationResult> prepareForOfflineClass(User user) async {
    final failures = <OfflinePrepFailure>[];
    final userId = user.id;

    // 1. Trusted clock — the online window for the offset probe.
    var clockOffsetPresent = await database.readClockOffsetMs() != null;
    final refresh = refreshClock;
    if (refresh != null) {
      try {
        clockOffsetPresent = await refresh() || clockOffsetPresent;
      } on Object catch (error) {
        _recordFailure(failures, OfflinePrepStep.clock, error);
      }
    }

    // 2. Drain hint (the queue owes nothing to this run).
    SyncDrainReport? drainReport;
    final drainHint = drain;
    if (drainHint != null) {
      try {
        drainReport = await drainHint();
      } on Object catch (error) {
        _recordFailure(failures, OfflinePrepStep.drain, error);
      }
    }

    // 3. Subjects (course-level lookups for class cards).
    var subjectsCached = 0;
    try {
      final subjects = await subjectsApi.getSubjects();
      await database.replaceSubjects(userId, subjects);
      subjectsCached = subjects.length;
    } on Object catch (error) {
      _recordFailure(failures, OfflinePrepStep.subjects, error);
    }

    // 4. Enrolled sections + roster ids.
    var sectionsCached = 0;
    var enrolledSectionIds = await database.readEnrolledSectionIds(userId);
    try {
      final sections = await sectionsApi.getStudentSections(userId);
      await database.replaceSections(userId, sections);
      enrolledSectionIds = <String>[for (final section in sections) section.id];
      await database.writeEnrolledSectionIds(userId, enrolledSectionIds);
      sectionsCached = sections.length;
    } on Object catch (error) {
      _recordFailure(failures, OfflinePrepStep.sections, error);
    }

    // 5. Sessions: the global role-scoped fetch first (web parity); when it
    //    fails, fall back to the per-section fetches so an already-synced
    //    roster still refreshes section by section.
    var sessionsCached = 0;
    var sessionsFetched = false;
    try {
      final sessions = await sessionsApi.getSessions();
      await database.upsertSessions(userId, sessions);
      sessionsCached = sessions.length;
      sessionsFetched = true;
    } on Object catch (error) {
      _recordFailure(failures, OfflinePrepStep.sessions, error);
    }
    if (!sessionsFetched) {
      for (final sectionId in enrolledSectionIds) {
        try {
          final sessions = await sessionsApi.getSectionSessions(sectionId);
          await database.replaceSessionsForSection(userId, sectionId, sessions);
          sessionsCached += sessions.length;
        } on Object catch (error) {
          _recordFailure(failures, OfflinePrepStep.sessions, error);
        }
      }
    }

    // 6. My attendance history (offline duplicate guards read from this).
    var attendanceCached = 0;
    try {
      final records = await attendanceApi.getAttendanceForStudent(userId);
      await database.replaceAttendanceForStudent(userId, userId, records);
      attendanceCached = records.length;
    } on Object catch (error) {
      _recordFailure(failures, OfflinePrepStep.attendance, error);
    }

    // 7. Teacher verification keys for the pre-session window. An offline scan
    //    fails closed without the cached key, so preparation reports the gap
    //    as a typed failure instead of leaving READY to contradict the scan
    //    (SW-6). Not thrown: the rest of the cache still becomes usable.
    try {
      final keylessSessions = upcomingCachedSessions(
        cachedSessions: await readCachedSessions(database, userId),
        today: _now(),
      ).where((session) => !hasVerifiableTeacherKey(session)).toList();
      if (keylessSessions.isNotEmpty) {
        failures.add(
          OfflinePrepFailure(
            OfflinePrepStep.teacherKey,
            ApiRequestError(
              message:
                  '${keylessSessions.length} class(es) in the next two days have '
                  'no offline verification key. Reconnect and prepare again.',
              status: 0,
            ),
          ),
        );
      }
    } on Object catch (error) {
      _recordFailure(failures, OfflinePrepStep.teacherKey, error);
    }

    final preparedAt = _now();
    await database.putScheduleCache(userId, offlinePreparedCacheKey, <Object?>[
      preparedAt.toUtc().toIso8601String(),
    ]);

    return OfflinePreparationResult(
      preparedAt: preparedAt,
      enrolledSectionIds: List<String>.unmodifiable(enrolledSectionIds),
      subjectsCached: subjectsCached,
      sectionsCached: sectionsCached,
      sessionsCached: sessionsCached,
      attendanceCached: attendanceCached,
      clockOffsetPresent: clockOffsetPresent,
      drainReport: drainReport,
      failures: List<OfflinePrepFailure>.unmodifiable(failures),
    );
  }
}

/// Wires the orchestrator to the live collaborators: the real APIs, the
/// trusted-clock notifier, and W1's queue controller (`SyncController`).
final offlinePreparationProvider = Provider<OfflinePreparation>((ref) {
  return OfflinePreparation(
    database: ref.watch(appDatabaseProvider),
    subjectsApi: ref.watch(subjectsApiProvider),
    sectionsApi: ref.watch(sectionsApiProvider),
    sessionsApi: ref.watch(sessionsApiProvider),
    attendanceApi: ref.watch(attendanceApiProvider),
    refreshClock: () async {
      await ref.read(trustedClockProvider.notifier).refresh();
      return await ref.read(appDatabaseProvider).readClockOffsetMs() != null;
    },
    drain: () => ref.read(syncControllerProvider.notifier).drainNow(),
  );
});

/// Current offline readiness snapshot for the dashboard chip (B-11). Loading
/// and failure both read as "checking" — the chip renders nothing meanwhile,
/// matching web `OfflineReadinessChip` `checking → hidden`.
final offlineReadinessProvider = FutureProvider<OfflineReadiness>((ref) async {
  final user = ref.watch(sessionProvider).user;
  if (user == null) {
    throw const ApiRequestError(
      message: 'Sign in before preparing for offline classes.',
      status: 401,
    );
  }
  final database = ref.watch(appDatabaseProvider);
  return evaluateOfflineReadiness(
    cachedSessions: await readCachedSessions(database, user.id),
    enrolledSectionIds: await database.readEnrolledSectionIds(user.id),
    hasTrustedClockOffset: await database.readClockOffsetMs() != null,
    today: ref.read(deviceNowProvider)(),
  );
});
