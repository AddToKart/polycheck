import 'package:drift/drift.dart';

import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import 'student_cache.dart';

/// Reads the student's cached attendance rows for one session
/// (`CachedAttendance` reader used by the web's already-saved guard,
/// `frontend/src/lib/api-client.ts:1353-1368` parity).
///
/// A corrupt cache row is skipped instead of hiding the whole session's
/// history (same policy as [readCachedSessions]).
Future<List<AttendanceRecord>> readCachedAttendanceForSession(
  AppDatabase database,
  String userId,
  String sessionId,
) async {
  final rows =
      await (database.select(database.cachedAttendance)..where(
            (candidate) =>
                candidate.userId.equals(userId) &
                candidate.sessionId.equals(sessionId),
          ))
          .get();
  final records = <AttendanceRecord>[];
  for (final row in rows) {
    try {
      records.add(
        AttendanceRecord.fromJson(decodeCachedPayload(row.payloadJson)),
      );
    } catch (_) {
      // Skip a corrupt cache row instead of hiding the scan guard.
    }
  }
  return records;
}
