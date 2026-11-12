import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/session.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/utils/pin_hash.dart';
import 'package:polycheck_mobile/src/core/utils/token_crypto.dart';
import 'package:polycheck_mobile/src/features/faculty/data/teacher_signing_key.dart';

final _seed = List<int>.generate(32, (index) => index);
final _algorithm = Ed25519();

Future<({String publicKey, String secretKey, SimplePublicKey public})>
_keyPair() async {
  final pair = await _algorithm.newKeyPairFromSeed(_seed);
  final data = await pair.extract();
  return (
    publicKey: encodeBase64Url(data.publicKey.bytes),
    secretKey: encodeBase64Url(_seed),
    public: data.publicKey,
  );
}

Session _session({SessionMode mode = SessionMode.inPerson}) => Session(
  id: 'sess-1',
  sectionId: 'sec-1',
  subjectName: 'Software Engineering',
  date: '2026-11-13',
  startTime: '09:00',
  endTime: '10:30',
  mode: mode,
  teacherId: 'teacher-1',
);

const _teacher = User(
  id: 'teacher-1',
  fullName: 'Prof. Cruz',
  role: UserRole.teacher,
);

void main() {
  group('secure storage contract', () {
    test('sanitizes account ids and mirrors the RN SecureStore keys', () {
      expect(
        TeacherSigningKeyService.sanitizeAccount('teacher/1 a'),
        'teacher_1_a',
      );
      final keys = TeacherSigningKeyService.storageKeys('prof.cruz@pup.edu.ph');
      expect(
        keys.secret,
        'polycheck.teacher-signing-secret.prof.cruz_pup.edu.ph',
      );
      expect(
        keys.public,
        'polycheck.teacher-signing-public.prof.cruz_pup.edu.ph',
      );
      expect(
        () => TeacherSigningKeyService.storageKeys(''),
        throwsArgumentError,
      );
    });

    test('generates and persists a key pair once', () async {
      final store = InMemorySigningKeyStore();
      final service = TeacherSigningKeyService(store: store);
      final first = await service.getOrCreate('teacher-1');
      final second = await service.getOrCreate('teacher-1');
      expect(first.publicKey, second.publicKey);
      expect(first.secretKey, second.secretKey);
      final keys = TeacherSigningKeyService.storageKeys('teacher-1');
      expect(store.values[keys.secret], first.secretKey);
      expect(store.values[keys.public], first.publicKey);

      // Public key must correspond to the stored seed.
      final pair = await _algorithm.newKeyPairFromSeed(
        decodeBase64Url(first.secretKey),
      );
      final extracted = await pair.extract();
      expect(encodeBase64Url(extracted.publicKey.bytes), first.publicKey);
    });

    test('incomplete storage fails closed', () async {
      final store = InMemorySigningKeyStore();
      final keys = TeacherSigningKeyService.storageKeys('teacher-1');
      await store.write(keys.secret, 'only-secret');
      final service = TeacherSigningKeyService(store: store);
      expect(service.getOrCreate('teacher-1'), throwsStateError);
    });
  });

  group('canonical sign format', () {
    test(
      'signs utf8(base64url payload json) + "." + base64url signature',
      () async {
        final keyPair = await _keyPair();
        final service = TeacherSigningKeyService(
          store: InMemorySigningKeyStore(),
        );
        final payload = buildInPersonTokenPayload(
          session: _session(),
          teacher: _teacher,
          issuedAtMs: 1762934400000,
          validityMinutes: 5,
          gracePeriodMinutes: 15,
        );
        final token = await service.signPayload(
          payload,
          TeacherSigningKey(
            publicKey: keyPair.publicKey,
            secretKey: keyPair.secretKey,
          ),
        );

        final parts = token.split('.');
        expect(parts, hasLength(2));

        // The payload half is exactly `encodeTokenPayload` (shared contract).
        expect(parts[0], encodeTokenPayload(payload));
        final decodedJson =
            jsonDecode(utf8.decode(decodeBase64Url(parts[0])))
                as Map<String, dynamic>;
        expect(decodedJson['version'], 1);
        expect(decodedJson['sessionId'], 'sess-1');
        expect(decodedJson['sectionId'], 'sec-1');
        expect(decodedJson['teacherId'], 'teacher-1');
        expect(decodedJson['teacherName'], 'Prof. Cruz');
        expect(decodedJson['issuedAt'], 1762934400000);
        expect(decodedJson['validityMinutes'], 5);
        expect(decodedJson['gracePeriodMinutes'], 15);
        expect(decodedJson['mode'], 'in_person');
        expect(decodedJson['pinRequired'], isFalse);

        final signature = Signature(
          decodeBase64Url(parts[1]),
          publicKey: keyPair.public,
        );
        expect(
          await _algorithm.verify(utf8.encode(parts[0]), signature: signature),
          isTrue,
        );
        expect(await service.verifyToken(token, keyPair.publicKey), isTrue);

        // Tampering with either half invalidates verification.
        final tampered =
            '${parts[0].substring(0, parts[0].length - 2)}AA.${parts[1]}';
        expect(await service.verifyToken(tampered, keyPair.publicKey), isFalse);
        expect(
          await service.verifyToken('$token.extra', keyPair.publicKey),
          isFalse,
        );
      },
    );

    test('accepts the legacy 64-byte nacl secret (seed || public)', () async {
      final keyPair = await _keyPair();
      final service = TeacherSigningKeyService(
        store: InMemorySigningKeyStore(),
      );
      final payload = buildInPersonTokenPayload(
        session: _session(),
        teacher: _teacher,
        issuedAtMs: 1762934400000,
        validityMinutes: 5,
        gracePeriodMinutes: 15,
      );
      final seedToken = await service.signPayload(
        payload,
        TeacherSigningKey(
          publicKey: keyPair.publicKey,
          secretKey: keyPair.secretKey,
        ),
      );
      final legacySecret = encodeBase64Url([
        ..._seed,
        ...decodeBase64Url(keyPair.publicKey),
      ]);
      final legacyToken = await service.signPayload(
        payload,
        TeacherSigningKey(
          publicKey: keyPair.publicKey,
          secretKey: legacySecret,
        ),
      );
      expect(legacyToken, seedToken);
    });

    test('rejects malformed secret material', () async {
      final service = TeacherSigningKeyService(
        store: InMemorySigningKeyStore(),
      );
      final payload = buildInPersonTokenPayload(
        session: _session(),
        teacher: _teacher,
        issuedAtMs: 1762934400000,
        validityMinutes: 5,
        gracePeriodMinutes: 15,
      );
      expect(
        () => service.signPayload(
          payload,
          const TeacherSigningKey(publicKey: 'abc', secretKey: 'abc'),
        ),
        throwsStateError,
      );
    });
  });

  group('payload builders', () {
    test('in-person payload enforces K5 caps', () {
      expect(
        () => buildInPersonTokenPayload(
          session: _session(),
          teacher: _teacher,
          issuedAtMs: 0,
          validityMinutes: 0,
          gracePeriodMinutes: 10,
        ),
        throwsArgumentError,
      );
      expect(
        () => buildInPersonTokenPayload(
          session: _session(),
          teacher: _teacher,
          issuedAtMs: 0,
          validityMinutes: 15,
          gracePeriodMinutes: 61,
        ),
        throwsArgumentError,
      );
    });

    test('checkpoint payload mirrors the web token fields', () {
      final payload = buildCheckpointTokenPayload(
        session: _session(mode: SessionMode.online),
        teacher: _teacher,
        issuedAtMs: 1762934400000,
        checkpoint: CheckpointType.start,
        validitySeconds: 90,
        graceMinutes: 10,
        pinHash: 'p1\$pbkdf2-sha256\$100000\$abc\$def',
      );
      expect(payload.mode, SessionMode.online);
      expect(payload.checkpoint, CheckpointType.start);
      expect(payload.validitySeconds, 90);
      // Web sends ceil(seconds / 60).
      expect(payload.validityMinutes, 2);
      expect(payload.gracePeriodMinutes, 10);
      expect(payload.pinRequired, isTrue);
      expect(payload.pinHash, 'p1\$pbkdf2-sha256\$100000\$abc\$def');
    });

    test('end checkpoint has zero grace and no PIN by default', () {
      final payload = buildCheckpointTokenPayload(
        session: _session(mode: SessionMode.online),
        teacher: _teacher,
        issuedAtMs: 0,
        checkpoint: CheckpointType.end,
        validitySeconds: 300,
        graceMinutes: 30,
      );
      expect(payload.gracePeriodMinutes, 0);
      expect(payload.validityMinutes, 5);
      expect(payload.pinRequired, isFalse);
      expect(payload.pinHash, isNull);
    });

    test('checkpoint validity is capped at 60-300 seconds', () {
      expect(
        () => buildCheckpointTokenPayload(
          session: _session(mode: SessionMode.online),
          teacher: _teacher,
          issuedAtMs: 0,
          checkpoint: CheckpointType.start,
          validitySeconds: 59,
        ),
        throwsArgumentError,
      );
      expect(
        () => buildCheckpointTokenPayload(
          session: _session(mode: SessionMode.online),
          teacher: _teacher,
          issuedAtMs: 0,
          checkpoint: CheckpointType.start,
          validitySeconds: 301,
        ),
        throwsArgumentError,
      );
    });
  });

  group('meeting PIN wiring', () {
    test(
      'generated PIN hashes and verifies through the shared PBKDF2',
      () async {
        final pin = generateMeetingPin(3);
        expect(RegExp(r'^\d{3}$').hasMatch(pin), isTrue);
        final outcome = await hashMeetingPin(pin);
        expect(outcome.serialized.startsWith('p1\$pbkdf2-sha256\$'), isTrue);
        expect(await verifyMeetingPin(pin, outcome.serialized), isTrue);
        final wrong = pin == '000' ? '111' : '000';
        expect(await verifyMeetingPin(wrong, outcome.serialized), isFalse);
      },
    );

    test('checkpoint payload carries the serialized pin hash', () async {
      final pin = '2468';
      final hash = (await hashMeetingPin(pin)).serialized;
      final payload = buildCheckpointTokenPayload(
        session: _session(mode: SessionMode.online),
        teacher: _teacher,
        issuedAtMs: 0,
        checkpoint: CheckpointType.start,
        validitySeconds: 120,
        pinHash: hash,
      );
      expect(payload.pinRequired, isTrue);
      expect(payload.pinHash, hash);
      expect(await verifyMeetingPin(pin, payload.pinHash), isTrue);
    });
  });
}
