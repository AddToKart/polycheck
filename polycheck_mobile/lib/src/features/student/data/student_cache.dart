import 'package:drift/drift.dart';

import 'dart:convert';

import 'package:polycheck_mobile/src/core/polycheck_core.dart';

Map<String, dynamic> decodeCachedPayload(String raw) {
  final decoded = jsonDecode(raw);
  if (decoded is Map<String, dynamic>) return decoded;
  if (decoded is Map) return decoded.cast<String, dynamic>();
  throw const FormatException('Cached payload is not a JSON object');
}

Future<Section?> readCachedSection(
  AppDatabase database,
  String userId,
  String sectionId,
) async {
  final row =
      await (database.select(database.cachedSections)..where(
            (candidate) =>
                candidate.userId.equals(userId) &
                candidate.id.equals(sectionId),
          ))
          .getSingleOrNull();
  if (row == null) return null;
  try {
    return Section.fromJson(decodeCachedPayload(row.payloadJson));
  } catch (_) {
    return null;
  }
}

Future<Session?> readCachedSession(
  AppDatabase database,
  String userId,
  String sessionId,
) async {
  final row =
      await (database.select(database.cachedSessions)..where(
            (candidate) =>
                candidate.userId.equals(userId) &
                candidate.id.equals(sessionId),
          ))
          .getSingleOrNull();
  if (row == null) return null;
  try {
    return Session.fromJson(decodeCachedPayload(row.payloadJson));
  } catch (_) {
    return null;
  }
}

Future<List<Session>> readCachedSessions(
  AppDatabase database,
  String userId, {
  String? sectionId,
  String? date,
}) async {
  final rows =
      await (database.select(database.cachedSessions)..where((row) {
            final owner = row.userId.equals(userId);
            if (sectionId != null) {
              return owner & row.sectionId.equals(sectionId);
            }
            return owner;
          }))
          .get();
  final sessions = <Session>[];
  for (final row in rows) {
    try {
      final session = Session.fromJson(decodeCachedPayload(row.payloadJson));
      if (date != null && session.date != date) continue;
      sessions.add(session);
    } catch (_) {
      // Skip a corrupt cache row instead of hiding every session.
    }
  }
  return sessions;
}
