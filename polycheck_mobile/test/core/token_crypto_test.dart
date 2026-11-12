import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/session.dart';
import 'package:polycheck_mobile/src/core/models/support/unknown_api_value.dart';
import 'package:polycheck_mobile/src/core/utils/token_crypto.dart';

QRTokenPayload makePayload([QRTokenPayload? overrides]) {
  return overrides ??
      const QRTokenPayload(
        version: 1,
        sessionId: 'ses-123',
        sectionId: 'sec-456',
        issuedAt: 1000000000000,
        validityMinutes: 30,
        gracePeriodMinutes: 15,
        teacherId: 'tch-789',
        teacherName: 'Dr. Ada Lovelace',
        mode: SessionMode.inPerson,
        pinRequired: false,
      );
}

QRTokenPayload payloadWith({
  int? issuedAt,
  int? validityMinutes,
  int? gracePeriodMinutes,
  int? validitySeconds,
  SessionMode? mode,
  CheckpointType? checkpoint,
  String? teacherName,
  int? version,
}) {
  return QRTokenPayload(
    version: version ?? 1,
    sessionId: 'ses-123',
    sectionId: 'sec-456',
    issuedAt: issuedAt ?? 1000000000000,
    validityMinutes: validityMinutes ?? 30,
    gracePeriodMinutes: gracePeriodMinutes ?? 15,
    teacherId: 'tch-789',
    teacherName: teacherName ?? 'Dr. Ada Lovelace',
    mode: mode ?? SessionMode.inPerson,
    checkpoint: checkpoint,
    pinRequired: false,
    validitySeconds: validitySeconds,
  );
}

void main() {
  group('encodeBase64Url / decodeBase64Url', () {
    test('round trips byte arrays of every padding length', () {
      final cases = <List<int>>[
        <int>[],
        <int>[0],
        <int>[0, 1],
        <int>[0, 1, 2],
        <int>[0, 1, 2, 3],
        <int>[0xff, 0x00, 0x80, 0x7f, 0x3c],
        <int>[251, 109, 204, 33, 7, 254, 0, 90, 128],
      ];
      for (final bytes in cases) {
        final encoded = encodeBase64Url(bytes);
        expect(encoded.contains('='), isFalse);
        expect(decodeBase64Url(encoded), bytes);
      }
    });

    test('produces the expected base64url encoding for a known input', () {
      expect(encodeBase64Url(<int>[0x3f, 0x3f, 0x3f]), 'Pz8_');
      expect(decodeBase64Url('Pz8_'), <int>[0x3f, 0x3f, 0x3f]);
    });
  });

  group('encodeTokenPayload / decodeTokenPayload', () {
    test('round trips the payload exactly', () {
      final payload = makePayload();
      expect(decodeTokenPayload(encodeTokenPayload(payload)), payload);
    });

    test('round trips Unicode payload strings', () {
      final payload = payloadWith(
        teacherName: 'María José García-Delgado ✓ 日本語テスト',
      );
      expect(decodeTokenPayload(encodeTokenPayload(payload)), payload);
    });

    test('decodes the payload part of a signed token', () {
      final payload = makePayload();
      final token = '${encodeTokenPayload(payload)}.c2lnbmF0dXJl';
      expect(decodeTokenPayload(token), payload);
    });

    test('returns null for garbage', () {
      expect(decodeTokenPayload('not-valid-base64-!'), isNull);
      expect(decodeTokenPayload(''), isNull);
    });

    test('returns null for a payload with version != 1', () {
      final payload = payloadWith(version: 2);
      expect(decodeTokenPayload(encodeTokenPayload(payload)), isNull);
    });
  });

  group('createQRTokenData', () {
    test('includes all fields and is deterministic for a fixed issuedAt', () {
      const issuedAtMs = 1234567890123;
      const expected = QRTokenPayload(
        version: 1,
        sessionId: 'ses-abc',
        sectionId: 'sec-def',
        issuedAt: issuedAtMs,
        validityMinutes: 45,
        gracePeriodMinutes: 10,
        teacherId: 'tch-ghi',
        teacherName: 'Prof. José Rizal',
        mode: SessionMode.inPerson,
        pinRequired: false,
      );
      final first = createQRTokenData(
        'ses-abc',
        'sec-def',
        'tch-ghi',
        'Prof. José Rizal',
        45,
        10,
        issuedAtMs: issuedAtMs,
      );
      final second = createQRTokenData(
        'ses-abc',
        'sec-def',
        'tch-ghi',
        'Prof. José Rizal',
        45,
        10,
        issuedAtMs: issuedAtMs,
      );
      expect(first, second);
      expect(decodeTokenPayload(first), expected);
    });

    test('carries online checkpoint extras', () {
      final encoded = createQRTokenData(
        'ses-abc',
        'sec-def',
        'tch-ghi',
        'Prof. José Rizal',
        2,
        0,
        issuedAtMs: 1234567890123,
        extras: const QRTokenExtras(
          mode: SessionMode.online,
          checkpoint: CheckpointType.end,
          pinRequired: true,
          pinHash: 'hash-here',
          validitySeconds: 90,
        ),
      );
      final payload = decodeTokenPayload(encoded)!;
      expect(payload.mode, SessionMode.online);
      expect(payload.checkpoint, CheckpointType.end);
      expect(payload.pinRequired, isTrue);
      expect(payload.pinHash, 'hash-here');
      expect(payload.validitySeconds, 90);
    });
  });

  group('legacy token normalization', () {
    test('defaults missing mode and pinRequired to in-person/false', () {
      final legacyJson =
          '{'
          '"version":1,'
          '"sessionId":"ses-legacy",'
          '"sectionId":"sec-legacy",'
          '"issuedAt":1000,'
          '"validityMinutes":5,'
          '"gracePeriodMinutes":5,'
          '"teacherId":"tch-legacy",'
          '"teacherName":"Legacy Teacher"'
          '}';
      final legacy = encodeBase64Url(List<int>.from(legacyJson.codeUnits));
      final payload = decodeTokenPayload(legacy);
      expect(payload, isNotNull);
      expect(payload!.mode, SessionMode.inPerson);
      expect(payload.pinRequired, isFalse);
    });
  });

  group('unknown enum values', () {
    test('a token with an unknown mode throws a typed error', () {
      final json =
          '{"version":1,"sessionId":"s","sectionId":"c","issuedAt":1,'
          '"validityMinutes":5,"gracePeriodMinutes":5,"teacherId":"t",'
          '"teacherName":"T","mode":"teleport","pinRequired":false}';
      final encoded = encodeBase64Url(List<int>.from(json.codeUnits));
      expect(
        () => decodeTokenPayload(encoded),
        throwsA(isA<UnknownApiValue>()),
      );
    });
  });

  group('isTokenInValidityWindow', () {
    const issuedAt = 1000000000000;
    const validityMinutes = 30;
    const gracePeriodMinutes = 15;
    const validityEnd = issuedAt + validityMinutes * 60 * 1000;
    const graceEnd = validityEnd + gracePeriodMinutes * 60 * 1000;
    final payload = payloadWith(
      issuedAt: issuedAt,
      validityMinutes: validityMinutes,
      gracePeriodMinutes: gracePeriodMinutes,
    );

    test('is valid (not in grace) exactly at the end of validity', () {
      expect(
        isTokenInValidityWindow(payload, validityEnd),
        const TokenValidity(valid: true, inGrace: false),
      );
    });

    test('is in grace immediately after the validity window ends', () {
      expect(
        isTokenInValidityWindow(payload, validityEnd + 1),
        const TokenValidity(valid: true, inGrace: true),
      );
    });

    test('is in grace exactly at the end of the grace period', () {
      expect(
        isTokenInValidityWindow(payload, graceEnd),
        const TokenValidity(valid: true, inGrace: true),
      );
    });

    test('is invalid just past the grace period', () {
      expect(
        isTokenInValidityWindow(payload, graceEnd + 1),
        const TokenValidity(valid: false, inGrace: false),
      );
    });

    test('is still valid before issuance (now <= validityEnd)', () {
      expect(
        isTokenInValidityWindow(payload, issuedAt - 1),
        const TokenValidity(valid: true, inGrace: false),
      );
    });

    test('is valid inside the validity window', () {
      expect(
        isTokenInValidityWindow(payload, issuedAt + 60 * 1000),
        const TokenValidity(valid: true, inGrace: false),
      );
    });

    test('prefers validitySeconds for online checkpoints', () {
      final onlinePayload = payloadWith(
        issuedAt: issuedAt,
        validityMinutes: 2,
        validitySeconds: 90,
        gracePeriodMinutes: 0,
        mode: SessionMode.online,
        checkpoint: CheckpointType.end,
      );
      expect(
        isTokenInValidityWindow(onlinePayload, issuedAt + 89000),
        const TokenValidity(valid: true, inGrace: false),
      );
      expect(
        isTokenInValidityWindow(onlinePayload, issuedAt + 90000),
        const TokenValidity(valid: true, inGrace: false),
      );
      expect(
        isTokenInValidityWindow(onlinePayload, issuedAt + 90001),
        const TokenValidity(valid: false, inGrace: false),
      );
    });
  });
}
