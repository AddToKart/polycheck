import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/pin_hash.dart';
import 'package:polycheck_mobile/src/core/utils/token_crypto.dart'
    show encodeBase64Url;

const int fastIterations = 10000;

List<int> Function(int) fixedRandom(int byte) =>
    (int length) => List<int>.filled(length, byte);

void main() {
  group('hashMeetingPin / verifyMeetingPin', () {
    test('produces a serialized record with the expected format', () async {
      final outcome = await hashMeetingPin(
        '83',
        randomFn: fixedRandom(7),
        iterations: fastIterations,
      );
      expect(outcome.serialized.startsWith(r'p1$pbkdf2-sha256$'), isTrue);
      expect(outcome.serialized.split(r'$'), hasLength(5));
      expect(outcome.record.iterations, fastIterations);
      expect(outcome.record.salt, hasLength(16));
      expect(outcome.record.digest, hasLength(32));
    });

    test('verifies the correct PIN and rejects a wrong PIN', () async {
      final outcome = await hashMeetingPin(
        '83',
        randomFn: fixedRandom(1),
        iterations: fastIterations,
      );
      expect(await verifyMeetingPin('83', outcome.serialized), isTrue);
      expect(await verifyMeetingPin('84', outcome.serialized), isFalse);
      expect(await verifyMeetingPin('830', outcome.serialized), isFalse);
    });

    test('same pin + salt yields the same digest; salts differ', () async {
      final first = await hashMeetingPin(
        '1234',
        salt: List<int>.filled(16, 2),
        iterations: fastIterations,
      );
      final second = await hashMeetingPin(
        '1234',
        salt: List<int>.filled(16, 2),
        iterations: fastIterations,
      );
      final third = await hashMeetingPin(
        '1234',
        salt: List<int>.filled(16, 3),
        iterations: fastIterations,
      );
      expect(
        encodePinHashRecord(first.record),
        encodePinHashRecord(second.record),
      );
      expect(
        encodePinHashRecord(first.record),
        isNot(encodePinHashRecord(third.record)),
      );
    });

    test('rejects tampered or malformed hashes', () async {
      final outcome = await hashMeetingPin(
        '45',
        randomFn: fixedRandom(4),
        iterations: fastIterations,
      );
      final serialized = outcome.serialized;
      final tail = serialized.endsWith('A') ? 'BB' : 'AA';
      final tampered = serialized.substring(0, serialized.length - 2) + tail;
      expect(await verifyMeetingPin('45', tampered), isFalse);
      expect(await verifyMeetingPin('45', 'garbage'), isFalse);
      expect(
        await verifyMeetingPin(
          '45',
          PinHashRecord(
            iterations: 1,
            salt: outcome.record.salt,
            digest: outcome.record.digest,
          ),
        ),
        isFalse,
      );
    });

    test('rejects invalid pins without touching the KDF', () async {
      final outcome = await hashMeetingPin(
        '22',
        randomFn: fixedRandom(9),
        iterations: fastIterations,
      );
      expect(await verifyMeetingPin('', outcome.serialized), isFalse);
      expect(await verifyMeetingPin('abc', outcome.serialized), isFalse);
      expect(await verifyMeetingPin('12345', outcome.serialized), isFalse);
    });

    test(
      'decodes what it encodes and rejects invalid iteration counts',
      () async {
        final outcome = await hashMeetingPin(
          '99',
          randomFn: fixedRandom(5),
          iterations: fastIterations,
        );
        final parts = outcome.serialized.split(r'$');
        final decoded = decodePinHashRecord(outcome.serialized)!;
        expect(decoded.iterations, outcome.record.iterations);
        expect(decoded.salt, outcome.record.salt);
        expect(decoded.digest, outcome.record.digest);
        expect(
          decodePinHashRecord('p1\$pbkdf2-sha256\$1\$${parts[3]}\$${parts[4]}'),
          isNull,
        );
        expect(
          decodePinHashRecord(r'p2$pbkdf2-sha256$10000$AAAA$AAAA'),
          isNull,
        );
      },
    );

    test('defaults to the production iteration count', () async {
      final outcome = await hashMeetingPin('12', randomFn: fixedRandom(6));
      expect(outcome.record.iterations, meetingPinKdfIterations);
    });

    // Cross-language parity: these digests were produced by the shared
    // TypeScript implementation (@noble/hashes PBKDF2-HMAC-SHA256) for
    // pin '83' with a 16-byte salt of 0x07.
    test('matches the TS/@noble PBKDF2 fixture vectors', () async {
      final fast = await hashMeetingPin(
        '83',
        salt: List<int>.filled(16, 7),
        iterations: 10000,
      );
      expect(
        encodeBase64Url(fast.record.digest),
        'j71kSUe03fo1pBdOGJv5OF6X5pbblmx7zy-RMxCCSJk',
      );

      final production = await hashMeetingPin(
        '83',
        salt: List<int>.filled(16, 7),
        iterations: meetingPinKdfIterations,
      );
      expect(
        encodeBase64Url(production.record.digest),
        'zFDIwa8zlR-cqk6Iq2gUMTBYjmSTajdB9sUecPT3_rk',
      );
    });
  });

  group('pin format helpers', () {
    test('accepts 2-4 digit PINs only', () {
      expect(isValidPinFormat('12'), isTrue);
      expect(isValidPinFormat('1234'), isTrue);
      expect(isValidPinFormat('1'), isFalse);
      expect(isValidPinFormat('12345'), isFalse);
      expect(isValidPinFormat('12a'), isFalse);
      expect(() => assertValidMeetingPin('123'), returnsNormally);
      expect(() => assertValidMeetingPin('12345'), throwsArgumentError);
    });
  });

  group('randomMeetingPin', () {
    test('generates the requested digit length using injected entropy', () {
      expect(randomMeetingPin(2, (_) => <int>[0, 0, 0, 5]), '05');
      expect(randomMeetingPin(3, (_) => <int>[0, 0, 0x03, 0xe7]), '999');
      expect(randomMeetingPin(4, (_) => <int>[0, 0, 0, 42]), '0042');
      expect(
        () => randomMeetingPin(5, (_) => List<int>.filled(4, 0)),
        throwsArgumentError,
      );
    });

    test('rejects a random source that returns too few bytes', () {
      expect(() => randomMeetingPin(3, (_) => <int>[1, 2]), throwsStateError);
    });
  });
}
