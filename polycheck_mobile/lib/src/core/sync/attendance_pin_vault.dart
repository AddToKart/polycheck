import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../utils/token_crypto.dart' show decodeBase64Url, encodeBase64Url;

/// Process-lifetime memory for meeting PINs that must accompany a queued
/// attendance scan on replay.
///
/// The scan pipeline keeps a PIN here for the lifetime of the process so a
/// reconnect during the same class session can still drain the scan.
///
/// RN parity (gap report A-j/B-7): the plaintext PIN is *also* persisted
/// encrypted at rest inside the offline queue row (`pinEncrypted` column,
/// AES-GCM key from secure storage) so a PIN-protected scan survives a cold
/// start instead of draining into a terminal `pin_required`. The vault remains
/// the in-memory fast path; the encrypted column is the durable path (see
/// `AppDatabase.decryptQueuePin`).
class AttendancePinVault {
  final Map<String, String> _pins = <String, String>{};

  /// Stores the PIN for [clientReceiptId] (empty values are ignored).
  void remember(String clientReceiptId, String pin) {
    final trimmed = pin.trim();
    if (clientReceiptId.isEmpty || trimmed.isEmpty) return;
    _pins[clientReceiptId] = trimmed;
  }

  /// Returns the in-memory PIN for [clientReceiptId], if still available.
  String? pinFor(String clientReceiptId) => _pins[clientReceiptId];

  /// Drops the PIN once the queue row reached a terminal reconciliation.
  void forget(String clientReceiptId) {
    _pins.remove(clientReceiptId);
  }

  /// Clears every retained PIN (sign-out / session eviction).
  void clear() {
    _pins.clear();
  }

  /// Number of retained PINs (test/diagnostics only).
  int get length => _pins.length;
}

final attendancePinVaultProvider = Provider<AttendancePinVault>(
  (ref) => AttendancePinVault(),
);

/// Secure-storage contract for the offline PIN encryption key (injectable so
/// tests never touch platform channels).
abstract interface class PinKeyStore {
  Future<String?> read();

  Future<void> write(String value);
}

/// `FlutterSecureStorage`-backed key store under the RN client's storage key
/// (naming parity: `android/services/offline-crypto.ts` `STORAGE_KEY`).
class SecurePinKeyStore implements PinKeyStore {
  const SecurePinKeyStore([this._storage = const FlutterSecureStorage()]);

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read() async {
    try {
      return await _storage.read(key: offlinePinEncryptionKey);
    } catch (_) {
      // An unreadable keystore yields no key; encryption fails closed to a
      // queue row without a persisted PIN (server then resolves the replay as
      // pin_required evidence instead of crashing).
      return null;
    }
  }

  @override
  Future<void> write(String value) async {
    try {
      await _storage.write(key: offlinePinEncryptionKey, value: value);
    } catch (_) {
      // Generation succeeds for this process; without persistence the next
      // cold start rotates the key and stale ciphertexts decrypt to null.
    }
  }
}

/// RN-client storage-key parity (`android/services/offline-crypto.ts:5`).
const String offlinePinEncryptionKey = 'polycheck.offline-encryption-key.v1';

/// Versioned ciphertext envelope: `v1.<nonce b64url>.<secretbox b64url>` where
/// the secretbox bytes are ciphertext+MAC concatenated (`SecretBox
/// concatenation` — tamper-evident).
const String pinCiphertextPrefix = 'v1';

/// AES-256-GCM cipher for queue-rest PIN persistence.
///
/// * key: 256-bit, generated once with a CSPRNG and persisted in [PinKeyStore]
///   (`offline-crypto.ts:20-37` parity — one key per installation);
/// * envelope: fresh nonce per row; a wrong key, tampered MAC or foreign
///   ciphertext decrypts to `null` and the queue drains *without* the PIN
///   (server then rejects with terminal `pin_required`, evidence retained —
///   the drain never crashes).
abstract interface class AttendancePinCipher {
  Future<String> encrypt(String plaintext);

  Future<String?> decrypt(String ciphertext);
}

/// Production cipher over secure storage + `cryptography` AES-GCM.
class SecureAttendancePinCipher implements AttendancePinCipher {
  SecureAttendancePinCipher({PinKeyStore? keyStore})
    : _keyStore = keyStore ?? const SecurePinKeyStore();

  final PinKeyStore _keyStore;
  final AesGcm _algorithm = AesGcm.with256bits();

  Future<List<int>> _key() async {
    final stored = await _keyStore.read();
    if (stored != null && stored.isNotEmpty) {
      try {
        final decoded = decodeBase64Url(stored);
        if (decoded.length == 32) return decoded;
      } on Object {
        // Fall through and rotate an unusable key instead of rejecting every
        // future encryption.
      }
    }
    final generated = SecretKeyData.random(length: 32);
    final bytes = await generated.extractBytes();
    await _keyStore.write(encodeBase64Url(bytes));
    return bytes;
  }

  @override
  Future<String> encrypt(String plaintext) async {
    final box = await _algorithm.encrypt(
      utf8.encode(plaintext),
      secretKey: SecretKey(await _key()),
    );
    return '$pinCiphertextPrefix.'
        '${encodeBase64Url(box.nonce)}.'
        '${encodeBase64Url(box.concatenation())}';
  }

  @override
  Future<String?> decrypt(String ciphertext) async {
    if (ciphertext.isEmpty) return null;
    try {
      final parts = ciphertext.split('.');
      if (parts.length != 3 || parts[0] != pinCiphertextPrefix) return null;
      final box = SecretBox.fromConcatenation(
        decodeBase64Url(parts[2]),
        nonceLength: _algorithm.nonceLength,
        macLength: _algorithm.macAlgorithm.macLength,
      );
      final clear = await _algorithm.decrypt(
        box,
        secretKey: SecretKey(await _key()),
      );
      return utf8.decode(clear);
    } on Object {
      return null;
    }
  }
}

/// In-memory AES-GCM cipher with a process-fixed key: real crypto, no
/// platform channels — hermetic for tests and for a corrupted-row simulation
/// (tests tamper the ciphertext directly).
class InMemoryAttendancePinCipher implements AttendancePinCipher {
  InMemoryAttendancePinCipher({List<int>? key})
    : _keyBytes = key ?? List<int>.filled(32, 11);

  final List<int> _keyBytes;
  final AesGcm _algorithm = AesGcm.with256bits();

  @override
  Future<String> encrypt(String plaintext) async {
    final box = await _algorithm.encrypt(
      utf8.encode(plaintext),
      secretKey: SecretKey(_keyBytes),
    );
    return '$pinCiphertextPrefix.'
        '${encodeBase64Url(box.nonce)}.'
        '${encodeBase64Url(box.concatenation())}';
  }

  @override
  Future<String?> decrypt(String ciphertext) async {
    if (ciphertext.isEmpty) return null;
    try {
      final parts = ciphertext.split('.');
      if (parts.length != 3 || parts[0] != pinCiphertextPrefix) return null;
      final box = SecretBox.fromConcatenation(
        decodeBase64Url(parts[2]),
        nonceLength: _algorithm.nonceLength,
        macLength: _algorithm.macAlgorithm.macLength,
      );
      final clear = await _algorithm.decrypt(
        box,
        secretKey: SecretKey(_keyBytes),
      );
      return utf8.decode(clear);
    } on Object {
      return null;
    }
  }
}

final attendancePinCipherProvider = Provider<AttendancePinCipher>(
  (ref) => SecureAttendancePinCipher(),
);
