import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/sync/attendance_pin_vault.dart';

/// Key store seam with fault injection, so the decrypt/encrypt split can be
/// asserted without platform channels.
class _FakePinKeyStore implements PinKeyStore {
  _FakePinKeyStore([this.value]);

  String? value;
  int reads = 0;
  int writes = 0;
  bool failReads = false;
  bool failWrites = false;

  @override
  Future<String?> read() async {
    reads += 1;
    if (failReads) throw StateError('keystore temporarily unavailable');
    return value;
  }

  @override
  Future<void> write(String next) async {
    writes += 1;
    if (failWrites) throw StateError('keystore write failed');
    value = next;
  }
}

void main() {
  group('SecureAttendancePinCipher key resolution (FLR-04)', () {
    test('encrypt creates and persists the key exactly once', () async {
      final store = _FakePinKeyStore();
      final cipher = SecureAttendancePinCipher(keyStore: store);

      final first = await cipher.encrypt('1234');
      final persisted = store.value;
      final second = await cipher.encrypt('5678');

      expect(persisted, isNotNull);
      expect(store.writes, 1, reason: 'one key, one write');
      expect(store.value, persisted, reason: 'never rotated');
      expect(first, isNot(second), reason: 'a fresh nonce per envelope');
    });

    test('encrypt then decrypt round-trips through the same key', () async {
      final store = _FakePinKeyStore();
      final cipher = SecureAttendancePinCipher(keyStore: store);

      final envelope = await cipher.encrypt('2468');
      expect(await cipher.decrypt(envelope), '2468');
      expect(store.writes, 1);
    });

    test('decrypt never writes, even when the keystore read throws', () async {
      final store = _FakePinKeyStore();
      final cipher = SecureAttendancePinCipher(keyStore: store);
      final envelope = await cipher.encrypt('1234');
      final persisted = store.value;
      final writesAfterEncrypt = store.writes;

      // A transiently unreadable keystore used to rotate the key here, which
      // permanently orphaned every envelope already on the offline queue.
      store.failReads = true;
      expect(await cipher.decrypt(envelope), isNull);

      expect(store.writes, writesAfterEncrypt, reason: 'decrypt is read-only');
      expect(store.value, persisted, reason: 'the stored key is untouched');
    });

    test(
      'a previously encrypted envelope still decrypts after a failed read',
      () async {
        final store = _FakePinKeyStore();
        final cipher = SecureAttendancePinCipher(keyStore: store);
        final envelope = await cipher.encrypt('4321');

        store.failReads = true;
        expect(await cipher.decrypt(envelope), isNull);

        // Recovery: the same envelope decrypts once the keystore is readable.
        store.failReads = false;
        expect(await cipher.decrypt(envelope), '4321');
        expect(store.writes, 1, reason: 'no rotation happened in between');
      },
    );

    test(
      'decrypt with no stored key answers null without creating one',
      () async {
        final store = _FakePinKeyStore();
        final cipher = SecureAttendancePinCipher(keyStore: store);

        expect(await cipher.decrypt('v1.bm9uY2U.c2VjcmV0Ym94'), isNull);
        expect(store.writes, 0);
        expect(store.value, isNull);
      },
    );

    test('a corrupt stored key is not overwritten by decrypt', () async {
      final store = _FakePinKeyStore('not-a-valid-base64-key');
      final cipher = SecureAttendancePinCipher(keyStore: store);

      expect(await cipher.decrypt('v1.bm9uY2U.c2VjcmV0Ym94'), isNull);
      expect(store.writes, 0);
      expect(store.value, 'not-a-valid-base64-key');
    });

    test('a corrupt stored key is replaced on the encrypt path', () async {
      final store = _FakePinKeyStore('not-a-valid-base64-key');
      final cipher = SecureAttendancePinCipher(keyStore: store);

      final envelope = await cipher.encrypt('1111');
      expect(store.writes, 1);
      expect(store.value, isNot('not-a-valid-base64-key'));
      expect(await cipher.decrypt(envelope), '1111');
    });

    test('a failed key write on encrypt surfaces the failure', () async {
      final store = _FakePinKeyStore()..failWrites = true;
      final cipher = SecureAttendancePinCipher(keyStore: store);

      await expectLater(cipher.encrypt('1234'), throwsA(isA<StateError>()));
      expect(store.writes, 1);
    });
  });
}
