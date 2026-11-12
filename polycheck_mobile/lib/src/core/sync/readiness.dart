import '../models/session.dart';
import '../utils/calendar_utils.dart';
import '../utils/token_crypto.dart';

/// Pure offline-readiness predicate (web `OfflineReadinessChip.tsx:31-47`
/// parity, gap report B-11) — the shared seam between this hardening wave
/// and the dashboard UX wave.
///
/// A device is "ready for offline class" when:
/// * the cached sessions include **today or tomorrow** (the pre-session sync
///   window a student needs before walking into class),
/// * the student is enrolled in at least one section,
/// * a trusted-clock offset is persisted (window maths stays server-true
///   without a network round trip), and
/// * every cached session in that window carries a valid 32-byte teacher
///   verification key (SW-6: an offline scan without one fails closed, so
///   READY must never claim otherwise).
///
/// The web chip's states/consumers:
/// * `ready`            → `Ready for offline class` pill,
/// * needs-sync (`!ready`) → `Prepare for offline class` action, which runs
///   the pre-sync (drain + cache refresh + clock probe) and re-evaluates.
///
/// Pure inputs only: no provider, repository, or IO dependency — tests feed
/// fixture lists directly.
class OfflineReadiness {
  const OfflineReadiness({
    required this.hasClassScheduleCached,
    required this.hasEnrolledSections,
    required this.hasTrustedClockOffset,
    required this.hasVerifiableKeys,
  });

  /// Cached sessions cover today or tomorrow's class days.
  final bool hasClassScheduleCached;

  /// At least one enrolled section id is cached.
  final bool hasEnrolledSections;

  /// A server clock offset (`/health` midpoint math) is persisted.
  final bool hasTrustedClockOffset;

  /// Every cached session occurring today or tomorrow carries a non-empty
  /// `teacherPublicKey` that base64url-decodes to exactly 32 bytes.
  ///
  /// Vacuously true when no session is cached in the window — the other
  /// flags already report "not ready", and there is nothing to verify.
  final bool hasVerifiableKeys;

  bool get isReady =>
      hasClassScheduleCached &&
      hasEnrolledSections &&
      hasTrustedClockOffset &&
      hasVerifiableKeys;

  /// Schedule and enrollment coverage exist, but at least one today/tomorrow
  /// session cannot be verified offline. The chip must say KEY MISSING instead
  /// of claiming readiness (SW-6).
  bool get keyCoverageMissing =>
      hasClassScheduleCached && hasEnrolledSections && !hasVerifiableKeys;

  @override
  bool operator ==(Object other) =>
      other is OfflineReadiness &&
      other.hasClassScheduleCached == hasClassScheduleCached &&
      other.hasEnrolledSections == hasEnrolledSections &&
      other.hasTrustedClockOffset == hasTrustedClockOffset &&
      other.hasVerifiableKeys == hasVerifiableKeys;

  @override
  int get hashCode => Object.hash(
    hasClassScheduleCached,
    hasEnrolledSections,
    hasTrustedClockOffset,
    hasVerifiableKeys,
  );

  @override
  String toString() =>
      'OfflineReadiness(schedule: $hasClassScheduleCached, '
      'sections: $hasEnrolledSections, clock: $hasTrustedClockOffset, '
      'keys: $hasVerifiableKeys)';
}

/// True when the value is a teacher key the local Ed25519 verifier can use:
/// non-empty and base64url-decoding to exactly 32 bytes.
///
/// This is the same decoder `verifyToken` uses, so readiness, preparation, and
/// the scan gate can never disagree about what a usable key looks like.
bool isVerifiableTeacherPublicKey(String? value) {
  final raw = value?.trim() ?? '';
  if (raw.isEmpty) return false;
  try {
    return decodeBase64Url(raw).length == 32;
  } on Object {
    return false;
  }
}

/// Convenience for a cached session's key.
bool hasVerifiableTeacherKey(Session session) =>
    isVerifiableTeacherPublicKey(session.teacherPublicKey);

/// Cached sessions inside the pre-session window (today or tomorrow), using
/// the same campus-date convention as the cache rows.
List<Session> upcomingCachedSessions({
  required List<Session> cachedSessions,
  required DateTime today,
}) {
  final todayDate = formatCampusDate(today);
  final tomorrowDate = formatCampusDate(
    DateTime(today.year, today.month, today.day).add(const Duration(days: 1)),
  );
  return <Session>[
    for (final session in cachedSessions)
      if (session.date == todayDate || session.date == tomorrowDate) session,
  ];
}

/// Evaluates readiness against a cached session list (RN/web parity:
/// "cached sessions containing today or tomorrow").
///
/// [today] is the device-local "now"; both dates are formatted with the same
/// campus-date convention used by the cache rows.
OfflineReadiness evaluateOfflineReadiness({
  required List<Session> cachedSessions,
  required List<String> enrolledSectionIds,
  required bool hasTrustedClockOffset,
  required DateTime today,
}) {
  final upcoming = upcomingCachedSessions(
    cachedSessions: cachedSessions,
    today: today,
  );
  return OfflineReadiness(
    hasClassScheduleCached: upcoming.isNotEmpty,
    hasEnrolledSections: enrolledSectionIds.isNotEmpty,
    hasTrustedClockOffset: hasTrustedClockOffset,
    hasVerifiableKeys: upcoming.every(hasVerifiableTeacherKey),
  );
}
