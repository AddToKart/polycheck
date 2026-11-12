import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/token_crypto.dart';

/// Cross-language token fixture (SW-6d).
///
/// Generated ONCE with the shared TS signer (`shared/src/utils/token.ts`
/// `signQRToken` algorithm, tweetnacl Ed25519) using a fixed seed:
///
/// ```js
/// const seed = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i)) // 0x00..0x1f
/// const pair = nacl.sign.keyPair.fromSeed(seed)
/// const payload = {
///   version: 1, sessionId: 'sess-fixture', sectionId: 'sec-fixture',
///   issuedAt: 1762764000000, validityMinutes: 15, gracePeriodMinutes: 15,
///   teacherId: 'teacher-fixture', teacherName: 'Prof. Fixture',
///   mode: 'in_person', pinRequired: false,
/// }
/// const encodedPayload = encodeBase64Url(utf8(JSON.stringify(payload)))
/// const token = `${encodedPayload}.${encodeBase64Url(nacl.sign.detached(utf8(encodedPayload), pair.secretKey))}`
/// const publicKey = encodeBase64Url(pair.publicKey)
/// ```
///
/// Re-running the snippet with the same seed and payload reproduces these
/// constants byte for byte. If the wire format ever changes, regenerate the
/// fixture from the TS signer — never hand-edit the token.
const String _fixtureToken =
    'eyJ2ZXJzaW9uIjoxLCJzZXNzaW9uSWQiOiJzZXNzLWZpeHR1cmUiLCJzZWN0aW9uSWQi'
    'OiJzZWMtZml4dHVyZSIsImlzc3VlZEF0IjoxNzYyNzY0MDAwMDAwLCJ2YWxpZGl0eU1p'
    'bnV0ZXMiOjE1LCJncmFjZVBlcmlvZE1pbnV0ZXMiOjE1LCJ0ZWFjaGVySWQiOiJ0ZWFj'
    'aGVyLWZpeHR1cmUiLCJ0ZWFjaGVyTmFtZSI6IlByb2YuIEZpeHR1cmUiLCJtb2RlIjoi'
    'aW5fcGVyc29uIiwicGluUmVxdWlyZWQiOmZhbHNlfQ'
    '.qsdq4jlPluIL5Z3Hj8jeBJIMfxxLrdWxt42YH3DnYdCJEu5NJchm2S_pWl_Y8o3VtvpJ'
    'ea6QKQhHimC74DARBA';

/// `encodeBase64Url(nacl.sign.keyPair.fromSeed(0x00..0x1f).publicKey)`.
const String _fixturePublicKey = 'A6EHv_POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg';

/// A different valid 32-byte Ed25519 public key (seed 0xff..0xe0 reversed).
const String _wrongPublicKey = 'uvxxvq06xeS2PpyCFu5xo0quxlci7tvKcotOmzzM45Y';

/// The last base64url character of a 64-byte signature only contributes 4
/// significant bits, so flip the second-to-last character instead.
String _tamperedSignature(String token) {
  final parts = token.split('.');
  final signature = parts[1];
  final index = signature.length - 2;
  final original = signature[index];
  final replacement = original == 'A' ? 'B' : 'A';
  final tampered =
      '${signature.substring(0, index)}$replacement'
      '${signature.substring(index + 1)}';
  return '${parts[0]}.$tampered';
}

void main() {
  test('a token signed by the shared TS signer verifies in Dart', () async {
    expect(await verifyToken(_fixtureToken, _fixturePublicKey), isTrue);
  });

  test('the fixture decodes to the signed payload', () {
    final payload = decodeTokenPayload(_fixtureToken);
    expect(payload, isNotNull);
    expect(payload!.sessionId, 'sess-fixture');
    expect(payload.sectionId, 'sec-fixture');
    expect(payload.teacherId, 'teacher-fixture');
    expect(payload.teacherName, 'Prof. Fixture');
    expect(payload.issuedAt, 1762764000000);
  });

  test('flipping one signature byte fails verification', () async {
    final tampered = _tamperedSignature(_fixtureToken);
    expect(tampered, isNot(_fixtureToken));
    expect(await verifyToken(tampered, _fixturePublicKey), isFalse);
  });

  test(
    'the correct signature under a different key fails verification',
    () async {
      expect(await verifyToken(_fixtureToken, _wrongPublicKey), isFalse);
    },
  );

  test('malformed tokens fail closed', () async {
    expect(await verifyToken('not-a-token', _fixturePublicKey), isFalse);
    expect(await verifyToken('a.b.c', _fixturePublicKey), isFalse);
  });
}
