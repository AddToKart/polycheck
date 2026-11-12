import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/session.dart';
import 'package:polycheck_mobile/src/core/sync/readiness.dart';

/// Base64url of 32 zero bytes — a decodable Ed25519-shaped public key.
const String _publicKey32 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

Session _session({
  required String date,
  String id = 'sess-1',
  String? teacherPublicKey = _publicKey32,
}) {
  return Session(
    id: id,
    sectionId: 'sec-1',
    date: date,
    startTime: '08:00',
    endTime: '09:00',
    teacherId: 'teacher-1',
    teacherPublicKey: teacherPublicKey,
  );
}

void main() {
  final today = DateTime(2026, 11, 10, 14); // Tuesday afternoon, local.

  test(
    'ready when today or tomorrow is cached, sections exist, offset known',
    () {
      final readiness = evaluateOfflineReadiness(
        cachedSessions: [_session(date: '2026-11-10')],
        enrolledSectionIds: const <String>['sec-1'],
        hasTrustedClockOffset: true,
        today: today,
      );

      expect(readiness.isReady, isTrue);
      expect(
        readiness,
        const OfflineReadiness(
          hasClassScheduleCached: true,
          hasEnrolledSections: true,
          hasTrustedClockOffset: true,
          hasVerifiableKeys: true,
        ),
      );
    },
  );

  test('tomorrow qualifies (a student preps the night before)', () {
    final readiness = evaluateOfflineReadiness(
      cachedSessions: [_session(date: '2026-11-11', id: 'sess-tomorrow')],
      enrolledSectionIds: const <String>['sec-2'],
      hasTrustedClockOffset: true,
      today: today,
    );

    expect(readiness.isReady, isTrue);
  });

  test(
    'a session three days out does not count ("today or tomorrow" web logic)',
    () {
      final readiness = evaluateOfflineReadiness(
        cachedSessions: [_session(date: '2026-11-13', id: 'sess-later')],
        enrolledSectionIds: const <String>['sec-1'],
        hasTrustedClockOffset: true,
        today: today,
      );

      expect(readiness.hasClassScheduleCached, isFalse);
      expect(readiness.isReady, isFalse);
    },
  );

  test('keys: a missing or malformed teacher key blocks readiness (SW-6)', () {
    final noKey = evaluateOfflineReadiness(
      cachedSessions: [_session(date: '2026-11-10', teacherPublicKey: null)],
      enrolledSectionIds: const <String>['sec-1'],
      hasTrustedClockOffset: true,
      today: today,
    );
    expect(noKey.hasClassScheduleCached, isTrue);
    expect(noKey.hasVerifiableKeys, isFalse);
    expect(noKey.keyCoverageMissing, isTrue);
    expect(noKey.isReady, isFalse);

    final wrongLength = evaluateOfflineReadiness(
      cachedSessions: [_session(date: '2026-11-11', teacherPublicKey: 'AAAA')],
      enrolledSectionIds: const <String>['sec-1'],
      hasTrustedClockOffset: true,
      today: today,
    );
    expect(wrongLength.hasVerifiableKeys, isFalse);
    expect(wrongLength.isReady, isFalse);

    // One keyless class in the window taints the readiness claim even when
    // the other cached session carries a valid key.
    final mixed = evaluateOfflineReadiness(
      cachedSessions: [
        _session(date: '2026-11-10'),
        _session(date: '2026-11-11', id: 'sess-2', teacherPublicKey: ''),
      ],
      enrolledSectionIds: const <String>['sec-1'],
      hasTrustedClockOffset: true,
      today: today,
    );
    expect(mixed.hasVerifiableKeys, isFalse);
    expect(mixed.keyCoverageMissing, isTrue);
  });

  test(
    'keys: no session in the window is vacuously key-covered but not ready',
    () {
      final later = evaluateOfflineReadiness(
        cachedSessions: [_session(date: '2026-11-13', teacherPublicKey: null)],
        enrolledSectionIds: const <String>['sec-1'],
        hasTrustedClockOffset: true,
        today: today,
      );
      expect(later.hasVerifiableKeys, isTrue);
      expect(later.keyCoverageMissing, isFalse);
      expect(later.isReady, isFalse);
    },
  );

  test('each missing ingredient fails readiness with the exact reason', () {
    final noSchedule = evaluateOfflineReadiness(
      cachedSessions: const <Session>[],
      enrolledSectionIds: const <String>['sec-1'],
      hasTrustedClockOffset: true,
      today: today,
    );
    expect(noSchedule.isReady, isFalse);
    expect(noSchedule.hasClassScheduleCached, isFalse);

    final noSections = evaluateOfflineReadiness(
      cachedSessions: [_session(date: '2026-11-10')],
      enrolledSectionIds: const <String>[],
      hasTrustedClockOffset: true,
      today: today,
    );
    expect(noSections.isReady, isFalse);
    expect(noSections.hasEnrolledSections, isFalse);

    final noClock = evaluateOfflineReadiness(
      cachedSessions: [_session(date: '2026-11-10')],
      enrolledSectionIds: const <String>['sec-1'],
      hasTrustedClockOffset: false,
      today: today,
    );
    expect(noClock.isReady, isFalse);
    expect(noClock.hasTrustedClockOffset, isFalse);
  });
}
